import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { entities } from '../database/database.module.js';
import { Incident, User } from '../database/entities/index.js';
import { canSee, restrictVisible, visibleWhere } from './incidents.service.js';

describe('private incidents', () => {
  let db: DataSource;
  let admin: User, reporter: User, lead: User, other: User;

  beforeEach(async () => {
    db = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities,
      synchronize: true,
    }).initialize();
    const users = db.getRepository(User);
    [admin, reporter, lead, other] = await users.save([
      { name: 'Admin', email: 'a@x', role: 'admin' },
      { name: 'Reporter', email: 'r@x', role: 'responder' },
      { name: 'Lead', email: 'l@x', role: 'responder' },
      { name: 'Other', email: 'o@x', role: 'responder' },
    ]);
    await db.getRepository(Incident).save([
      { title: 'Open to all', severity: 'minor', reporter, lead },
      { title: 'Secret', severity: 'major', isPrivate: true, reporter, lead },
    ]);
  });

  afterEach(() => db.destroy());

  const titles = async (user: User) =>
    (
      await db
        .getRepository(Incident)
        .find({ where: visibleWhere(user), order: { id: 'ASC' } })
    ).map((incident) => incident.title);

  it('shows a private incident to admins, its reporter and its lead only', async () => {
    expect(await titles(admin)).toEqual(['Open to all', 'Secret']);
    expect(await titles(reporter)).toEqual(['Open to all', 'Secret']);
    expect(await titles(lead)).toEqual(['Open to all', 'Secret']);
    expect(await titles(other)).toEqual(['Open to all']);
  });

  it('applies the same rule to query builders', async () => {
    const query = restrictVisible(
      db.getRepository(Incident).createQueryBuilder('incident'),
      other,
    );
    expect((await query.getMany()).map((i) => i.title)).toEqual([
      'Open to all',
    ]);
  });

  it('answers per incident the same way', async () => {
    const secret = await db.getRepository(Incident).findOneOrFail({
      where: { title: 'Secret' },
      relations: { reporter: true, lead: true },
    });
    expect(
      [admin, reporter, lead, other].map((u) => canSee(secret, u)),
    ).toEqual([true, true, true, false]);
  });
});
