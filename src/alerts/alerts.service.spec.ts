import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { entities } from '../database/database.module.js';
import { Alert, AlertSource } from '../database/entities/index.js';
import type { IncidentsService } from '../incidents/incidents.service.js';
import { IngestSchema } from './alerts.schemas.js';
import { AlertsService } from './alerts.service.js';

describe('AlertsService.ingest', () => {
  let db: DataSource;
  let alerts: AlertsService;
  let source: AlertSource;

  beforeEach(async () => {
    db = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities,
      synchronize: true,
    }).initialize();
    alerts = new AlertsService(
      {} as IncidentsService,
      db.getRepository(Alert),
      db.getRepository(AlertSource),
    );
    source = await db
      .getRepository(AlertSource)
      .save({ name: 'Prometheus', token: 'pp_test' });
  });

  afterEach(() => db.destroy());

  const ingest = (payload: object) =>
    alerts.ingest(source, IngestSchema.parse(payload));

  it('counts the same open dedupKey as another occurrence', async () => {
    const first = await ingest({ title: 'Lag', dedupKey: 'lag' });
    const again = await ingest({ title: 'Lag (worse)', dedupKey: 'lag' });

    expect(first.outcome).toBe('created');
    expect(again).toMatchObject({
      outcome: 'deduplicated',
      alert: { id: first.alert!.id, occurrences: 2, title: 'Lag (worse)' },
    });
  });

  it('resolves the open alert, and fires a new one after that', async () => {
    const first = await ingest({ title: 'Lag', dedupKey: 'lag' });
    const resolved = await ingest({
      title: 'Lag',
      dedupKey: 'lag',
      status: 'resolved',
    });
    const next = await ingest({ title: 'Lag', dedupKey: 'lag' });

    expect(resolved).toMatchObject({
      outcome: 'resolved',
      alert: { id: first.alert!.id, status: 'resolved' },
    });
    expect(next.outcome).toBe('created');
    expect(next.alert!.id).not.toBe(first.alert!.id);
  });

  it('ignores a resolve for an alert it never saw open', async () => {
    expect(
      await ingest({ title: 'Lag', dedupKey: 'nope', status: 'resolved' }),
    ).toEqual({ alert: null, outcome: 'ignored' });
  });

  it('never deduplicates alerts without a key', async () => {
    const a = await ingest({ title: 'Disk full' });
    const b = await ingest({ title: 'Disk full' });
    expect(b.outcome).toBe('created');
    expect(b.alert!.id).not.toBe(a.alert!.id);
  });
});
