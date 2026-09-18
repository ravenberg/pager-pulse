import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { hashPassword } from '../auth/passwords.js';
import {
  FollowUp,
  Incident,
  type IncidentStatus,
  Schedule,
  ScheduleMember,
  Service,
  type Severity,
  TimelineEntry,
  User,
} from './entities/index.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const PEOPLE = [
  { name: 'Ada Lovelace', email: 'ada@pagerpulse.dev', role: 'admin' },
  { name: 'Grace Hopper', email: 'grace@pagerpulse.dev', role: 'responder' },
  { name: 'Linus Torvalds', email: 'linus@pagerpulse.dev', role: 'responder' },
  {
    name: 'Margaret Hamilton',
    email: 'margaret@pagerpulse.dev',
    role: 'responder',
  },
  { name: 'Ken Thompson', email: 'ken@pagerpulse.dev', role: 'responder' },
  { name: 'Barbara Liskov', email: 'barbara@pagerpulse.dev', role: 'viewer' },
] as const;

const SERVICES = [
  { name: 'API', description: 'Public REST API' },
  { name: 'Dashboard', description: 'The web app' },
  { name: 'Webhooks', description: 'Outgoing event delivery' },
  { name: 'Payments', description: 'Billing and checkout' },
  { name: 'Notifications', description: 'Email, SMS and push' },
];

const TITLES = [
  'Elevated 5xx rate on API gateway',
  'Webhook deliveries delayed',
  'Checkout failing for EU customers',
  'Dashboard slow to load',
  'SMS notifications not delivered',
  'Database replica lag above threshold',
  'Login page returning 502',
  'Search results out of date',
  'Push notifications duplicated',
  'Card payments declined by processor',
  'Memory leak in worker pool',
  'Certificate expiry on status subdomain',
];

/**
 * Fills an empty database with a team, services, a history of incidents and
 * two on-call rotations, so the demo has something to show on first start.
 * Everyone's password is `password`.
 */
@Injectable()
export class DatabaseSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeeder.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async onApplicationBootstrap() {
    if ((await this.db.getRepository(User).count()) > 0) return;
    this.logger.log('Seeding the demo database…');

    const passwordHash = await hashPassword('password');
    const users = await this.db
      .getRepository(User)
      .save(PEOPLE.map((person) => ({ ...person, passwordHash })));
    const responders = users.filter((user) => user.role !== 'viewer');

    const services = await this.db
      .getRepository(Service)
      .save(SERVICES.map((service, position) => ({ ...service, position })));

    let seed = 42;
    const random = () =>
      ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const pick = <T>(items: readonly T[]) =>
      items[Math.floor(random() * items.length)];

    const now = Date.now();
    for (let i = 0; i < 48; i++) {
      // The two most recent incidents are still open, the rest are history.
      const open = i >= 46;
      const declaredAt = new Date(now - (48 - i) * 2.7 * DAY - random() * DAY);
      if (open) declaredAt.setTime(now - (i === 47 ? 0.6 : 3.5) * HOUR);
      const severity: Severity = open
        ? i === 47
          ? 'major'
          : 'minor'
        : pick(['critical', 'major', 'minor', 'minor']);
      const status: IncidentStatus = open
        ? i === 47
          ? 'investigating'
          : 'monitoring'
        : 'resolved';
      const lead = pick(responders);
      const reporter = pick(responders);

      const incident = await this.db.getRepository(Incident).save({
        title: TITLES[i % TITLES.length],
        summary: 'Customers are affected. We are looking into the cause.',
        severity,
        status,
        isPublic: severity !== 'minor' || open,
        lead,
        reporter,
        services: [
          pick(services),
          ...(random() > 0.6 ? [pick(services)] : []),
        ].filter((service, index, all) => all.indexOf(service) === index),
        declaredAt,
        resolvedAt:
          status === 'resolved'
            ? new Date(declaredAt.getTime() + (1 + random() * 5) * HOUR)
            : null,
      });

      const at = (hours: number) =>
        new Date(declaredAt.getTime() + hours * HOUR);
      const entries: Partial<TimelineEntry>[] = [
        {
          kind: 'declared',
          author: reporter,
          body: `Declared as ${severity}.`,
          createdAt: at(0),
        },
        {
          kind: 'update',
          author: lead,
          body: 'We are investigating reports of degraded service.',
          isPublic: true,
          createdAt: at(0.1),
        },
      ];
      if (status !== 'investigating') {
        entries.push(
          {
            kind: 'status',
            author: lead,
            body: 'Status changed to identified.',
            createdAt: at(0.5),
          },
          {
            kind: 'update',
            author: lead,
            body: 'The cause has been identified and a fix is being rolled out.',
            isPublic: true,
            createdAt: at(0.55),
          },
          {
            kind: 'status',
            author: lead,
            body: 'Status changed to monitoring.',
            createdAt: at(0.9),
          },
        );
      }
      if (status === 'resolved') {
        entries.push(
          {
            kind: 'status',
            author: lead,
            body: 'Status changed to resolved.',
            createdAt: incident.resolvedAt!,
          },
          {
            kind: 'update',
            author: lead,
            body: 'This incident has been resolved.',
            isPublic: true,
            createdAt: incident.resolvedAt!,
          },
        );
      }
      await this.db
        .getRepository(TimelineEntry)
        .save(entries.map((entry) => ({ ...entry, incident })));

      if (status === 'resolved' && random() > 0.4) {
        await this.db.getRepository(FollowUp).save([
          {
            incident,
            title: 'Add alerting for this failure mode',
            assignee: pick(responders),
            completedAt: random() > 0.5 ? at(48) : null,
          },
          {
            incident,
            title: 'Write the post-mortem',
            assignee: lead,
            completedAt: i < 40 ? at(72) : null,
          },
        ]);
      }
    }

    const monday = new Date(now - ((new Date(now).getDay() + 6) % 7) * DAY);
    monday.setHours(9, 0, 0, 0);
    await this.db.getRepository(Schedule).save([
      {
        name: 'Primary',
        startsAt: new Date(monday.getTime() - 4 * 7 * DAY),
        shiftHours: 168,
        members: responders.map(
          (user, position) => ({ user, position }) as ScheduleMember,
        ),
      },
      {
        name: 'Payments escalation',
        startsAt: new Date(monday.getTime() - 3 * DAY),
        shiftHours: 24,
        members: responders
          .slice(1, 4)
          .map((user, position) => ({ user, position }) as ScheduleMember),
      },
    ]);

    this.logger.log(
      'Seeded. Log in as ada@pagerpulse.dev with password "password".',
    );
  }
}
