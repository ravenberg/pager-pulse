import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { DataSource } from 'typeorm';

/**
 * The whole app against a fresh in-memory database, seeded as on first start.
 * Requests speak the Inertia protocol the way the browser client does.
 * CSRF protection is off under NODE_ENV=test, as nestjs-mvc does by default.
 */
let app: INestApplication;
let db: DataSource;

beforeAll(async () => {
  process.env.DATABASE_PATH = ':memory:';
  // Imported late: the database module reads DATABASE_PATH when it loads.
  const { AppModule } = await import('../src/app.module.js');
  const { configureApp } = await import('../src/app.setup.js');
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = configureApp(module.createNestApplication());
  await app.init();
  db = app.get(DataSource);
});

afterAll(() => app?.close());

/** A browser: keeps cookies and the page version the server last answered with. */
function browser() {
  const agent = request.agent(app.getHttpServer());
  let version = '';

  /** An Inertia visit; a 409 (new version or new user) is retried once, as the client reloads. */
  async function visit(
    url: string,
    headers: Record<string, string> = {},
  ): Promise<request.Response> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await agent
        .get(url)
        .set({ 'X-Inertia': 'true', 'X-Inertia-Version': version, ...headers });
      if (response.status !== 409) return response;
      version = response.headers['x-inertia-version'] ?? '';
    }
    throw new Error(`${url} kept answering 409`);
  }

  async function login(email: string) {
    await agent
      .post('/login')
      .send({ email, password: 'password' })
      .expect(302);
  }

  return { agent: agent as TestAgent, visit, login };
}

describe('pages', () => {
  it('sends a guest to the login page', async () => {
    const guest = browser();
    const response = await guest.agent
      .get('/incidents')
      .set('Accept', 'text/html');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/login');
  });

  it('renders the public status page on the server', async () => {
    const response = await request(app.getHttpServer())
      .get('/status')
      .set('Accept', 'text/html')
      .expect(200);
    // Text from the React tree: only there when it was rendered server-side.
    expect(response.text).toContain('PagerPulse status');
    expect(response.text).toContain('Subscribe to updates');
  });

  it('paints the dashboard first and sends the stats in a follow-up request', async () => {
    const ada = browser();
    await ada.login('ada@pagerpulse.dev');

    const page = (await ada.visit('/')).body;
    expect(page.component).toBe('Dashboard');
    expect(page.props.stats).toBeUndefined();
    expect(page.deferredProps).toEqual({ default: ['stats'] });

    const deferred = (
      await ada.visit('/', {
        'X-Inertia-Partial-Component': 'Dashboard',
        'X-Inertia-Partial-Data': 'stats',
      })
    ).body;
    expect(Object.keys(deferred.props)).toContain('stats');
    expect(deferred.props.stats.total).toBeGreaterThan(0);
    expect(deferred.props.active).toBeUndefined();
  });

  it('sends a once() list only until the browser says it has it', async () => {
    const ada = browser();
    await ada.login('ada@pagerpulse.dev');

    const first = (await ada.visit('/incidents/create')).body;
    expect(first.props.users.length).toBeGreaterThan(0);
    expect(first.onceProps.people.prop).toBe('users');

    const again = (
      await ada.visit('/incidents/create', {
        'X-Inertia-Except-Once-Props': 'people',
      })
    ).body;
    expect(again.props.users).toBeUndefined();
  });
});

describe('private incidents', () => {
  it('are there for admins and answer 404 to everyone else', async () => {
    const [secret] = await db.query(
      'SELECT id FROM incident WHERE isPrivate = 1 LIMIT 1',
    );
    expect(secret).toBeDefined();

    const ada = browser();
    await ada.login('ada@pagerpulse.dev');
    expect((await ada.visit(`/incidents/${secret.id}`)).status).toBe(200);

    const barbara = browser();
    await barbara.login('barbara@pagerpulse.dev');
    const response = await barbara.visit(`/incidents/${secret.id}`);
    expect(response.status).toBe(404);
    expect(response.body.props.reason).toBe(
      `There is no incident INC-${secret.id}.`,
    );
  });
});

describe('forms', () => {
  it('validates live (Precognition) without running the handler', async () => {
    const ada = browser();
    await ada.login('ada@pagerpulse.dev');
    const before = await db.query('SELECT COUNT(*) AS n FROM incident');

    const invalid = await ada.agent
      .post('/incidents')
      .set({ Precognition: 'true', 'Precognition-Validate-Only': 'title' })
      .send({ title: 'x' });
    expect(invalid.status).toBe(422);
    expect(invalid.body.errors).toEqual({
      title: 'Give the incident a title of at least 3 characters.',
    });

    const valid = await ada.agent
      .post('/incidents')
      .set({ Precognition: 'true' })
      .send({ title: 'Checkout is slow', severity: 'minor' });
    expect(valid.status).toBe(204);
    expect(valid.headers['precognition-success']).toBe('true');

    expect(await db.query('SELECT COUNT(*) AS n FROM incident')).toEqual(
      before,
    );
  });

  it('exports the filtered list as CSV', async () => {
    const ada = browser();
    await ada.login('ada@pagerpulse.dev');
    const response = await ada.agent
      .get('/incidents/export?state=resolved&severity=critical')
      .expect(200);
    expect(response.headers['content-type']).toContain('text/csv');
    const [header, ...rows] = response.text.trim().split('\r\n');
    expect(header).toBe(
      'Reference,Title,Severity,Status,Services,Lead,Declared,Resolved,Minutes to resolve',
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row).toContain(',critical,resolved,');
  });
});

describe('alert ingestion', () => {
  it('takes alerts from a tool with a source token, and deduplicates them', async () => {
    const [source] = await db.query('SELECT token FROM alert_source LIMIT 1');
    const server = app.getHttpServer();
    const alert = { title: 'Queue depth above 10k', dedupKey: 'queue-depth' };

    await request(server).post('/alerts/ingest').send(alert).expect(401);

    const first = await request(server)
      .post('/alerts/ingest')
      .set('Authorization', `Bearer ${source.token}`)
      .send(alert)
      .expect(202);
    expect(first.body).toMatchObject({ outcome: 'created' });

    const again = await request(server)
      .post('/alerts/ingest')
      .set('Authorization', `Bearer ${source.token}`)
      .send(alert)
      .expect(202);
    expect(again.body).toMatchObject({
      outcome: 'deduplicated',
      alert: { id: first.body.alert.id, occurrences: 2 },
    });
  });
});
