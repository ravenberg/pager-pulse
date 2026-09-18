import 'reflect-metadata';
import { SignedUrls, createKeyRing } from 'nestjs-mvc';
import { DataSource } from 'typeorm';
import { entities } from '../database/database.module.js';
import { type Incident, StatusSubscriber } from '../database/entities/index.js';
import type { Email, MailService } from '../mail/mail.service.js';
import { SubscriptionsService } from './subscriptions.service.js';

const APP = 'https://status.example.com';

describe('SubscriptionsService', () => {
  let db: DataSource;
  let sent: Email[];
  let service: SubscriptionsService;

  beforeEach(async () => {
    process.env.APP_URL = APP;
    db = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities,
      synchronize: true,
    }).initialize();
    sent = [];
    const links = new SignedUrls(
      createKeyRing(['a-test-key-that-is-at-least-32-characters']),
      { url: APP },
    );
    service = new SubscriptionsService(
      links,
      { send: async (email: Email) => void sent.push(email) } as MailService,
      db.getRepository(StatusSubscriber),
    );
  });

  afterEach(async () => {
    delete process.env.APP_URL;
    await db.destroy();
  });

  /** The first absolute link in an email. */
  const linkIn = (email: Email, path: string) =>
    email.text.match(new RegExp(`${APP}${path}[^\\s]*`))?.[0];

  it('emails an absolute confirmation link that works once', async () => {
    const subscriber = await service.subscribe('reader@example.com');
    const link = linkIn(sent[0], '/status/subscriptions/');
    expect(link).toMatch(/\/confirm\?expires=\d+&signature=/);

    expect(service.checkConfirmation(link!, subscriber)).toBe('valid');
    await service.confirm(subscriber);
    // Confirming changed what the link is bound to.
    expect(service.checkConfirmation(link!, subscriber)).toBe('invalid');
  });

  it('refuses a confirmation link that was tampered with', async () => {
    const subscriber = await service.subscribe('reader@example.com');
    const link = linkIn(sent[0], '/status/subscriptions/')!;
    const other = link.replace('/subscriptions/1/', '/subscriptions/2/');
    expect(service.checkConfirmation(other, subscriber)).toBe('invalid');
  });

  it('sends public updates to confirmed subscribers only', async () => {
    await service.confirm(await service.subscribe('yes@example.com'));
    await service.subscribe('pending@example.com');
    sent = [];

    await service.notify(
      { id: 7, title: 'API errors' } as Incident,
      'We are investigating.',
    );

    expect(sent.map((email) => email.to)).toEqual(['yes@example.com']);
    expect(sent[0].text).toContain('We are investigating.');
    expect(sent[0].text).toContain(`${APP}/status/incidents/7`);
    expect(linkIn(sent[0], '/status/subscriptions/1/unsubscribe')).toMatch(
      /signature=/,
    );
  });
});
