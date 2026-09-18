import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AnyRequest, type SignatureVerdict, SignedUrls } from 'nestjs-mvc';
import { Not, IsNull, Repository } from 'typeorm';
import { type Incident, StatusSubscriber } from '../database/entities/index.js';
import { MailboxService } from '../mailbox/mailbox.service.js';

const DAY = 24 * 60 * 60;

/**
 * Status page subscriptions, with links that need no table of tokens:
 * nestjs-mvc signs them with the app's key, and the signature is the proof.
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly links: SignedUrls,
    private readonly mailbox: MailboxService,
    @InjectRepository(StatusSubscriber)
    private readonly subscribers: Repository<StatusSubscriber>,
  ) {}

  async find(id: number) {
    const subscriber = await this.subscribers.findOneBy({ id });
    if (!subscriber)
      throw new NotFoundException('That subscription no longer exists.');
    return subscriber;
  }

  /**
   * The confirmation link is bound to the subscriber's confirmation state:
   * the moment it is used, the state changes and the signature no longer
   * matches. Single use, and nothing stored to make it so.
   */
  private bindingOf(subscriber: StatusSubscriber) {
    return `${subscriber.email}:${subscriber.confirmedAt?.getTime() ?? 'pending'}`;
  }

  confirmUrl(subscriber: StatusSubscriber) {
    return this.links.sign(`/status/subscriptions/${subscriber.id}/confirm`, {
      expiresIn: DAY,
      bind: this.bindingOf(subscriber),
    });
  }

  /** Never expires: every email carries one, and it must keep working. */
  unsubscribeUrl(subscriber: StatusSubscriber) {
    return this.links.sign(
      `/status/subscriptions/${subscriber.id}/unsubscribe`,
    );
  }

  /** Why a confirmation link is not accepted, or `valid`. */
  checkConfirmation(req: AnyRequest, subscriber: StatusSubscriber) {
    return this.links.check(req, {
      bind: this.bindingOf(subscriber),
    }) as SignatureVerdict;
  }

  async subscribe(email: string) {
    const subscriber =
      (await this.subscribers.findOneBy({ email })) ??
      (await this.subscribers.save(this.subscribers.create({ email })));
    if (subscriber.confirmedAt) return subscriber;
    await this.mailbox.send({
      to: email,
      subject: 'Confirm your PagerPulse status updates',
      body: 'Someone, hopefully you, asked for an email whenever PagerPulse posts a status update. Confirm within a day; the link works once.',
      links: [{ label: 'Confirm', url: this.confirmUrl(subscriber) }],
    });
    return subscriber;
  }

  async confirm(subscriber: StatusSubscriber) {
    subscriber.confirmedAt = new Date();
    await this.subscribers.save(subscriber);
  }

  async unsubscribe(subscriber: StatusSubscriber) {
    await this.subscribers.remove(subscriber);
  }

  /** Emails every confirmed subscriber about a public update. */
  async notify(incident: Incident, update: string) {
    const subscribers = await this.subscribers.findBy({
      confirmedAt: Not(IsNull()),
    });
    for (const subscriber of subscribers) {
      await this.mailbox.send({
        to: subscriber.email,
        subject: `[PagerPulse status] ${incident.title}`,
        body: update,
        links: [
          {
            label: 'View on the status page',
            url: `/status/incidents/${incident.id}`,
          },
          { label: 'Unsubscribe', url: this.unsubscribeUrl(subscriber) },
        ],
      });
    }
  }
}
