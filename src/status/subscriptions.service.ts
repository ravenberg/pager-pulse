import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AnyRequest, SignedUrls } from 'nestjs-mvc';
import { Not, IsNull, Repository } from 'typeorm';
import { type Incident, StatusSubscriber } from '../database/entities/index.js';
import { appUrl } from '../common/app-url.js';
import { MailService } from '../mail/mail.service.js';

const DAY = 24 * 60 * 60;

/**
 * Status page subscriptions, with links that need no table of tokens:
 * nestjs-mvc signs them with the app's key, and the signature is the proof.
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly links: SignedUrls,
    private readonly mail: MailService,
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
  checkConfirmation(link: AnyRequest | string, subscriber: StatusSubscriber) {
    return this.links.check(link, { bind: this.bindingOf(subscriber) });
  }

  async subscribe(email: string) {
    const subscriber =
      (await this.subscribers.findOneBy({ email })) ??
      (await this.subscribers.save(this.subscribers.create({ email })));
    if (subscriber.confirmedAt) return subscriber;
    await this.mail.send({
      to: email,
      subject: 'Confirm your PagerPulse status updates',
      text: [
        'Someone, hopefully you, asked for an email whenever PagerPulse posts a status update.',
        '',
        `Confirm within a day (the link works once): ${this.confirmUrl(subscriber)}`,
        '',
        'If it was not you, ignore this email.',
      ].join('\n'),
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
      await this.mail.send({
        to: subscriber.email,
        subject: `[PagerPulse status] ${incident.title}`,
        text: [
          update,
          '',
          `Follow it on the status page: ${appUrl()}/status/incidents/${incident.id}`,
          '',
          `Unsubscribe: ${this.unsubscribeUrl(subscriber)}`,
        ].join('\n'),
      });
    }
  }
}
