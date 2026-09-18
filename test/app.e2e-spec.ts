import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

/**
 * The whole app against a fresh in-memory database, seeded as on first start.
 * Requests speak the Inertia protocol the way the browser client does.
 * CSRF protection is off under NODE_ENV=test, as nestjs-mvc does by default.
 */
let app: INestApplication;
let db: DataSource;
/** Stands in for the providers' status pages: no network in tests. */
const upstream = {
  down: false,
  async statuses() {
    if (this.down) throw new Error('No status page answered.');
    return [
      {
        name: 'GitHub',
        url: 'https://www.githubstatus.com',
        indicator: 'none',
        description: 'All Systems Operational',
      },
    ];
  },
};

beforeAll(async () => {
  process.env.DATABASE_PATH = ':memory:';
  // Imported late: the database module reads DATABASE_PATH when it loads.
  const { AppModule } = await import('../src/app.module.js');
  const { configureApp } = await import('../src/app.setup.js');
  const { UpstreamService } =
    await import('../src/dashboard/upstream.service.js');
  const module = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(UpstreamService)
    .useValue(upstream)
    .compile();
  app = configureApp(module.createNestApplication());
  await app.init();
  db = app.get(DataSource);
});

afterAll(() => app?.close());

/** A browser: keeps cookies and the page version the server last answered with. */
function browser() {
  const agent = request.agent(app.getHttpServer());
  let version = '';

  /**
   * A page visit. A 409 (a new version, then possibly a new user) is retried
   * with the version the server sent, as the browser reloads.
   */
  async function visit(
    url: string,
    headers: Record<string, string> = {},
  ): Promise<request.Response> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await agent
        .get(url)
        .set({ 'X-Inertia': 'true', 'X-Inertia-Version': version, ...headers });
      if (response.status !== 409) return response;
      version = response.headers['x-inertia-version'] ?? '';
    }
    throw new Error(`${url} kept answering 409`);
  }

  async function login(email: string, password = 'password') {
    await agent.post('/login').send({ email, password }).expect(302);
  }

  /** The headers the Inertia client sends with a form submission. */
  const inertia = () => ({ 'X-Inertia': 'true', 'X-Inertia-Version': version });

  return { agent: agent as TestAgent, visit, login, inertia };
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

  it('renders a public incident on the server for guests only (disableSsr)', async () => {
    const [incident] = await db.query(
      'SELECT id, title FROM incident WHERE isPublic = 1 AND isPrivate = 0 LIMIT 1',
    );
    const html = (who: TestAgent) =>
      who.get(`/status/incidents/${incident.id}`).set('Accept', 'text/html');

    const guest = await html(browser().agent).expect(200);
    expect(guest.text).toContain('Current status');
    expect(guest.text).not.toContain('Open in PagerPulse');

    const ada = browser();
    await ada.login('ada@pagerpulse.dev');
    const teammate = await html(ada.agent).expect(200);
    // The same page, rendered in the browser: only the page object is sent.
    expect(teammate.text).not.toContain('Current status');
    expect(teammate.text).toContain(
      `"internalUrl":"\\/incidents\\/${incident.id}"`,
    );
  });

  it('paints the dashboard first and sends each block of numbers after it', async () => {
    const ada = browser();
    await ada.login('ada@pagerpulse.dev');

    const page = (await ada.visit('/')).body;
    expect(page.component).toBe('Dashboard');
    expect(page.props.active.length).toBeGreaterThan(0);
    expect(page.props.summary).toBeUndefined();
    // One group per block: five follow-up requests, in parallel.
    expect(page.deferredProps).toEqual({
      summary: ['summary'],
      weekly: ['weekly'],
      breakdown: ['breakdown'],
      people: ['people'],
      upstream: ['upstream'],
    });

    const block = (
      await ada.visit('/?days=90', {
        'X-Inertia-Partial-Component': 'Dashboard',
        'X-Inertia-Partial-Data': 'summary',
      })
    ).body;
    expect(block.props.summary.total).toBeGreaterThan(0);
    expect(block.props.active).toBeUndefined();
  });

  it('leaves out a widget whose source is down, instead of failing (rescue)', async () => {
    const ada = browser();
    await ada.login('ada@pagerpulse.dev');
    const widget = {
      'X-Inertia-Partial-Component': 'Dashboard',
      'X-Inertia-Partial-Data': 'upstream',
    };

    const up = (await ada.visit('/', widget)).body;
    expect(up.props.upstream[0].name).toBe('GitHub');
    expect(up.rescuedProps ?? []).toEqual([]);

    upstream.down = true;
    try {
      const down = await ada.visit('/', widget);
      expect(down.status).toBe(200);
      expect(down.body.props.upstream).toBeUndefined();
      expect(down.body.rescuedProps).toEqual(['upstream']);
    } finally {
      upstream.down = false;
    }
  });

  it('leaves similar incidents out until the card asks for them (WhenVisible)', async () => {
    const [incident] = await db.query(
      `SELECT id, title FROM incident WHERE title IN
         (SELECT title FROM incident GROUP BY title HAVING COUNT(*) > 1)
       ORDER BY id DESC LIMIT 1`,
    );
    const ada = browser();
    await ada.login('ada@pagerpulse.dev');

    const page = (await ada.visit(`/incidents/${incident.id}`)).body;
    expect(page.props.related).toBeUndefined();

    const related = (
      await ada.visit(`/incidents/${incident.id}`, {
        'X-Inertia-Partial-Component': 'Incidents/Show',
        'X-Inertia-Partial-Data': 'related',
      })
    ).body.props.related;
    expect(related.length).toBeGreaterThan(0);
    expect(related[0]).toMatchObject({
      title: incident.title,
      sameTitle: true,
    });
    expect(related.map((r: { id: number }) => r.id)).not.toContain(incident.id);
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

  it('searches by title or by number', async () => {
    const ada = browser();
    await ada.login('ada@pagerpulse.dev');
    const search = async (term: string) =>
      (
        await ada.visit(
          `/incidents?state=all&search=${encodeURIComponent(term)}`,
        )
      ).body.props.incidents.data.map(
        (i: { reference: string }) => i.reference,
      );

    expect(await search('no such incident')).toEqual([]);
    expect(await search('INC-3')).toContain('INC-3');
    expect((await search('memory leak')).length).toBeGreaterThan(0);
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

describe('people', () => {
  /** The invitation link an admin is shown once, as flash data, after a change. */
  const flashedLink = async (admin: ReturnType<typeof browser>) => {
    const { flash } = (await admin.visit('/people')).body;
    const url = new URL(flash.invitation.url);
    return url.pathname + url.search;
  };

  it('is for admins only', async () => {
    const grace = browser();
    await grace.login('grace@pagerpulse.dev');
    expect((await grace.visit('/people')).status).toBe(403);
  });

  it('adds someone, who joins through a shared link that works once', async () => {
    const ada = browser();
    await ada.login('ada@pagerpulse.dev');
    await ada.visit('/people');
    const invite = (email: string) =>
      ada.agent
        .post('/people')
        .set({
          ...ada.inertia(),
          Referer: '/people',
          'X-Inertia-Error-Bag': 'invite',
        })
        .send({ name: 'Radia Perlman', email, role: 'responder' });

    await invite('grace@pagerpulse.dev').expect(302);
    expect((await ada.visit('/people')).body.props.errors).toEqual({
      invite: { email: 'Someone with that address is already here.' },
    });

    await invite(' Radia@PagerPulse.dev ').expect(302);
    const first = await flashedLink(ada);
    expect(first).toMatch(/^\/invitations\/\d+\?expires=\d+&signature=/);
    // Flash: shown once, then gone.
    const people = (await ada.visit('/people')).body.props.people;
    expect(people).toContainEqual(
      expect.objectContaining({
        email: 'radia@pagerpulse.dev',
        state: 'invited',
      }),
    );
    expect((await ada.visit('/people')).body.flash ?? {}).toEqual({});

    // A new link replaces the old one: the first stops working.
    const radiaId = people.find(
      (p: { email: string }) => p.email === 'radia@pagerpulse.dev',
    ).id;
    await ada.agent
      .post(`/people/${radiaId}/link`)
      .set({ ...ada.inertia(), Referer: '/people' })
      .expect(302);
    const link = await flashedLink(ada);
    expect(link).not.toBe(first);

    const radia = browser();
    expect((await radia.visit(first)).body.props.state).toBe('invalid');
    expect((await radia.visit(link)).body.props).toMatchObject({
      state: 'valid',
      name: 'Radia Perlman',
    });

    await radia.agent
      .post(link)
      .set({ ...radia.inertia(), Referer: link })
      .send({ password: 'short', confirmation: 'short' })
      .expect(302);
    expect((await radia.visit(link)).body.props.errors).toEqual({
      password: 'Use at least 10 characters.',
    });

    const joined = await radia.agent
      .post(link)
      .set({ ...radia.inertia(), Referer: link })
      .send({ password: 'correct horse', confirmation: 'correct horse' });
    expect(joined.status).toBe(302);
    expect(joined.headers.location).toBe('/');
    expect((await radia.visit('/')).body.props.auth.user.name).toBe(
      'Radia Perlman',
    );
    // Used: the link no longer works.
    expect((await browser().visit(link)).body.props.state).toBe('invalid');
  });

  it("ends a deactivated person's session at once", async () => {
    const ken = browser();
    await ken.login('ken@pagerpulse.dev');
    expect((await ken.visit('/')).status).toBe(200);

    const ada = browser();
    await ada.login('ada@pagerpulse.dev');
    await ada.visit('/people');
    const [{ id }] = await db.query(
      "SELECT id FROM user WHERE email = 'ken@pagerpulse.dev'",
    );
    // Not your own access, though.
    const [{ id: adaId }] = await db.query(
      "SELECT id FROM user WHERE email = 'ada@pagerpulse.dev'",
    );
    const self = await ada.agent
      .post(`/people/${adaId}/deactivate`)
      .set({ ...ada.inertia(), Referer: '/people' });
    expect(self.status).toBe(403);

    await ada.agent
      .post(`/people/${id}/deactivate`)
      .set({ ...ada.inertia(), Referer: '/people' })
      .expect(302);
    const out = await ken.agent.get('/').set('Accept', 'text/html');
    expect(out.status).toBe(302);
    expect(out.headers.location).toBe('/login');
    // And can't log in again (a JSON client gets the validation error).
    await browser()
      .agent.post('/login')
      .send({ email: 'ken@pagerpulse.dev', password: 'password' })
      .expect(400);

    await ada.agent
      .post(`/people/${id}/reactivate`)
      .set({ ...ada.inertia(), Referer: '/people' })
      .expect(302);
    await ken.login('ken@pagerpulse.dev');
    expect((await ken.visit('/')).status).toBe(200);
  });
});

describe('your account', () => {
  it('keeps profile and password errors apart, and checks the password as you type', async () => {
    const margaret = browser();
    await margaret.login('margaret@pagerpulse.dev');
    await margaret.visit('/account');
    const put = (url: string, bag: string, body: object) =>
      margaret.agent
        .put(url)
        .set({
          ...margaret.inertia(),
          Referer: '/account',
          'X-Inertia-Error-Bag': bag,
        })
        .send(body);

    // Errors are flashed for the next page only: look after each form.
    await put('/account', 'profile', {
      name: 'Margaret Hamilton',
      email: 'ada@pagerpulse.dev',
    }).expect(303);
    expect((await margaret.visit('/account')).body.props.errors).toEqual({
      profile: { email: 'Someone else already uses that address.' },
    });
    await put('/account/password', 'password', {
      current: 'wrong',
      password: 'a new password',
      confirmation: 'a new password',
    }).expect(303);
    expect((await margaret.visit('/account')).body.props.errors).toEqual({
      password: { current: 'That is not your current password.' },
    });

    // Precognition: only the field asked about, and the handler never runs.
    const live = await margaret.agent
      .put('/account/password')
      .set({ Precognition: 'true', 'Precognition-Validate-Only': 'password' })
      .send({ password: 'aaaaaaaaaaaa', confirmation: '' });
    expect(live.status).toBe(422);
    expect(live.body.errors).toEqual({
      password: 'Not one character over and over.',
    });

    await put('/account/password', 'password', {
      current: 'password',
      password: 'apollo guidance',
      confirmation: 'apollo guidance',
    }).expect(303);
    const again = browser();
    await again.login('margaret@pagerpulse.dev', 'apollo guidance');
    expect((await again.visit('/account')).status).toBe(200);
  });
});

describe('incident call', () => {
  it('sends the browser to the call with view.location(), starting it once', async () => {
    const [incident] = await db.query(
      "SELECT id FROM incident WHERE status != 'resolved' AND isPrivate = 0 AND callUrl IS NULL LIMIT 1",
    );
    const url = `/incidents/${incident.id}/call`;
    const referer = `/incidents/${incident.id}`;

    // A viewer can join a call, not start one.
    const barbara = browser();
    await barbara.login('barbara@pagerpulse.dev');
    await barbara.visit(referer);
    const none = await barbara.agent
      .post(url)
      .set({ ...barbara.inertia(), Referer: referer });
    expect(none.status).toBe(302);
    expect(none.headers.location).toBe(referer);

    // An Inertia visit gets 409 + X-Inertia-Location: go there yourself.
    const grace = browser();
    await grace.login('grace@pagerpulse.dev');
    await grace.visit(referer);
    const started = await grace.agent
      .post(url)
      .set({ ...grace.inertia(), Referer: referer });
    expect(started.status).toBe(409);
    const call = started.headers['x-inertia-location'];
    expect(call).toMatch(
      new RegExp(`^https://meet\\.jit\\.si/PagerPulse-INC-${incident.id}-`),
    );

    // Anyone joining later lands in the same call; the timeline says it once.
    const joined = await barbara.agent
      .post(url)
      .set({ ...barbara.inertia(), Referer: referer });
    expect(joined.headers['x-inertia-location']).toBe(call);
    const [{ n }] = await db.query(
      "SELECT COUNT(*) AS n FROM timeline_entry WHERE incidentId = ? AND kind = 'call'",
      [incident.id],
    );
    expect(n).toBe(1);

    // Without Inertia it is a plain redirect.
    const plain = await grace.agent.post(url).set('Referer', referer);
    expect([302, 303]).toContain(plain.status);
    expect(plain.headers.location).toBe(call);
  });
});

describe('saved views', () => {
  it('keeps named filters per person, and refuses a name twice on its own form', async () => {
    const grace = browser();
    await grace.login('grace@pagerpulse.dev');
    await grace.visit('/incidents');
    const save = (name: string) =>
      grace.agent
        .post('/incidents/views')
        .set({
          ...grace.inertia(),
          Referer: '/incidents',
          'X-Inertia-Error-Bag': 'saveView',
        })
        .send({
          name,
          filters: { state: 'all', severity: 'major', search: '' },
          columns: ['status', 'lead'],
        });

    await save('Major').expect(302);
    await save('Major').expect(302);
    // The form follows the redirect as a partial reload, as the page does.
    const back = (
      await grace.visit('/incidents', {
        'X-Inertia-Partial-Component': 'Incidents/Index',
        'X-Inertia-Partial-Data': 'views,errors',
      })
    ).body;
    expect(back.props.errors).toEqual({
      saveView: { name: 'You already have a view with that name.' },
    });
    const page = (await grace.visit('/incidents')).body;
    expect(page.props.views).toEqual([
      expect.objectContaining({
        name: 'Major',
        filters: { state: 'all', severity: 'major', search: '' },
        columns: ['status', 'lead'],
      }),
    ]);

    // Someone else's view is not there to remove.
    const ada = browser();
    await ada.login('ada@pagerpulse.dev');
    await ada.visit('/incidents');
    const removed = await ada.agent
      .delete(`/incidents/views/${page.props.views[0].id}`)
      .set({ ...ada.inertia(), Referer: '/incidents' });
    expect(removed.status).toBe(404);
  });
});

describe('incident board', () => {
  it('moves a card with a PATCH whose answer carries only the board', async () => {
    const [incident] = await db.query(
      "SELECT id FROM incident WHERE status = 'investigating' LIMIT 1",
    );
    const board = {
      'X-Inertia-Partial-Component': 'Dashboard',
      'X-Inertia-Partial-Data': 'active,openIncidents',
    };

    // A viewer is refused (the board doesn't let them drag in the first place).
    const barbara = browser();
    await barbara.login('barbara@pagerpulse.dev');
    await barbara.visit('/');
    const refused = await barbara.agent
      .patch(`/incidents/${incident.id}`)
      .set({ ...barbara.inertia(), ...board, Referer: '/' })
      .send({ status: 'identified' });
    expect(refused.status).toBe(403);

    const grace = browser();
    await grace.login('grace@pagerpulse.dev');
    await grace.visit('/');
    const moved = await grace.agent
      .patch(`/incidents/${incident.id}`)
      .set({ ...grace.inertia(), ...board, Referer: '/' })
      .send({ status: 'identified' });
    expect(moved.status).toBe(303);
    expect(moved.headers.location).toBe('/');

    // The redirect is followed with the same headers: just the board.
    const page = (await grace.visit('/', board)).body;
    expect(Object.keys(page.props)).not.toContain('summary');
    expect(Object.keys(page.props)).not.toContain('onCall');
    expect(
      page.props.active.find((i: { id: number }) => i.id === incident.id),
    ).toMatchObject({ status: 'identified' });
  });
});

describe('search palette', () => {
  it('answers useHttp with JSON, without private incidents for those who may not see them', async () => {
    const [secret] = await db.query(
      'SELECT id, title FROM incident WHERE isPrivate = 1 LIMIT 1',
    );
    const search = (who: ReturnType<typeof browser>, q: string) =>
      who.agent
        .get(`/search?q=${encodeURIComponent(q)}`)
        .set('Accept', 'application/json');

    // No page, no redirect: a JSON client gets a status code.
    expect((await search(browser(), 'api')).status).toBe(401);

    const ada = browser();
    await ada.login('ada@pagerpulse.dev');
    const found = (await search(ada, `INC-${secret.id}`)).body;
    expect(found.incidents.map((i: { id: number }) => i.id)).toContain(
      secret.id,
    );
    expect(
      (await search(ada, 'api')).body.services.map(
        (s: { name: string }) => s.name,
      ),
    ).toContain('API');

    const barbara = browser();
    await barbara.login('barbara@pagerpulse.dev');
    const hidden = (await search(barbara, secret.title)).body;
    expect(hidden.incidents.map((i: { id: number }) => i.id)).not.toContain(
      secret.id,
    );
  });
});

describe('catalog', () => {
  it('sends the kept services list again after a change (view.refresh)', async () => {
    const ada = browser();
    await ada.login('ada@pagerpulse.dev');
    const kept = { 'X-Inertia-Except-Once-Props': 'services,people' };

    // The browser says it has the list: the server leaves it out.
    expect(
      (await ada.visit('/catalog', kept)).body.props.services,
    ).toBeUndefined();

    await ada.agent
      .post('/catalog/services')
      .set({ ...ada.inertia(), Referer: '/catalog' })
      .send({ name: 'Search', description: 'Full-text search' })
      .expect(302);

    // The render after the change sends it anyway, with the new service…
    const after = (await ada.visit('/catalog', kept)).body.props.services;
    expect(after.map((s: { name: string }) => s.name)).toContain('Search');
    // …and the one after that trusts the browser's copy again.
    expect(
      (await ada.visit('/catalog', kept)).body.props.services,
    ).toBeUndefined();
  });
});

describe('attachments', () => {
  it('uploads a file, refuses a wrong one on its form field, and serves it back', async () => {
    process.env.STORAGE_PATH = await mkdtemp(join(tmpdir(), 'pager-pulse-'));
    const ada = browser();
    await ada.login('ada@pagerpulse.dev');
    const [incident] = await db.query('SELECT id FROM incident LIMIT 1');
    const url = `/incidents/${incident.id}/attachments`;
    await ada.visit(`/incidents/${incident.id}`);

    await ada.agent
      .post(url)
      .set({
        ...ada.inertia(),
        Referer: `/incidents/${incident.id}`,
        'X-Inertia-Error-Bag': 'attachment',
      })
      .attach('file', Buffer.from('MZ'), {
        filename: 'tool.exe',
        contentType: 'application/x-msdownload',
      })
      .expect(302);
    const refused = (await ada.visit(`/incidents/${incident.id}`)).body;
    expect(refused.props.errors).toEqual({
      attachment: { file: 'Images, text, CSV, JSON, PDF and archives only.' },
    });

    await ada.agent
      .post(url)
      .set({ ...ada.inertia(), Referer: `/incidents/${incident.id}` })
      .attach('file', Buffer.from('{"ok":true}'), {
        filename: 'dump.json',
        contentType: 'application/json',
      })
      .expect(302);
    const page = (await ada.visit(`/incidents/${incident.id}`)).body;
    const [file] = page.props.attachments;
    expect(file).toMatchObject({ filename: 'dump.json', size: 11 });

    const download = await ada.agent.get(`${url}/${file.id}`).expect(200);
    expect(download.headers['content-disposition']).toBe(
      'attachment; filename="dump.json"',
    );
    expect(download.text).toBe('{"ok":true}');
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
