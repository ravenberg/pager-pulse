import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AnyRequest, SignedUrls, ValidationException } from 'nestjs-mvc';
import { Repository } from 'typeorm';
import { hashPassword } from '../auth/passwords.js';
import { type Role, User } from '../database/entities/index.js';
import { MailService } from '../mail/mail.service.js';

const WEEK = 7 * 24 * 60 * 60;

/**
 * Who can use PagerPulse. Invitations are signed links bound to the moment
 * they were sent: accepting clears it and sending again replaces it, so each
 * link works once and only the newest one works at all.
 */
@Injectable()
export class PeopleService {
  constructor(
    private readonly links: SignedUrls,
    private readonly mail: MailService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async find(id: number) {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('There is no such person.');
    return user;
  }

  private bindingOf(user: User) {
    return `${user.email}:${user.invitedAt?.getTime() ?? 'accepted'}`;
  }

  invitationUrl(user: User) {
    return this.links.sign(`/invitations/${user.id}`, {
      expiresIn: WEEK,
      bind: this.bindingOf(user),
    });
  }

  /** `valid`, `expired` or `invalid`; an accepted invitation is `invalid`. */
  checkInvitation(link: AnyRequest | string, user: User) {
    if (!user.invitedAt) return 'invalid' as const;
    return this.links.check(link, { bind: this.bindingOf(user) });
  }

  async invite(
    input: { name: string; email: string; role: Role },
    by: User,
  ): Promise<User> {
    if (await this.users.existsBy({ email: input.email }))
      throw new ValidationException({
        email: 'Someone with that address is already here.',
      });
    const user = await this.users.save(
      this.users.create({ ...input, invitedAt: new Date() }),
    );
    await this.sendInvitation(user, by);
    return user;
  }

  /** A fresh link; the old one stops working. */
  async resend(user: User, by: User) {
    user.invitedAt = new Date();
    await this.users.update(user.id, { invitedAt: user.invitedAt });
    await this.sendInvitation(user, by);
  }

  private sendInvitation(user: User, by: User) {
    return this.mail.send({
      to: user.email,
      subject: `${by.name} invited you to PagerPulse`,
      text: [
        `Hi ${user.name.split(' ')[0]},`,
        '',
        `${by.name} added you to PagerPulse as ${user.role}. Choose a password to get started (the link works once, for a week):`,
        '',
        this.invitationUrl(user),
      ].join('\n'),
    });
  }

  async accept(user: User, password: string) {
    await this.users.update(user.id, {
      passwordHash: await hashPassword(password),
      invitedAt: null,
    });
  }

  async changeRole(user: User, role: Role) {
    await this.users.update(user.id, { role });
  }

  async deactivate(user: User) {
    await this.users.update(user.id, { deactivatedAt: new Date() });
  }

  async reactivate(user: User) {
    await this.users.update(user.id, { deactivatedAt: null });
  }
}
