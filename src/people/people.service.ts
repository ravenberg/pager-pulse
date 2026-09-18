import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SignedUrls, ValidationException } from 'nestjs-mvc';
import { Repository } from 'typeorm';
import { hashPassword } from '../auth/passwords.js';
import { type Role, User } from '../database/entities/index.js';

const WEEK = 7 * 24 * 60 * 60;

/**
 * Who can use PagerPulse. An admin adds someone and shares the invitation
 * link with them however they like (a chat message will do). Nothing secret
 * is stored: the link is signed.
 */
@Injectable()
export class PeopleService {
  constructor(
    private readonly links: SignedUrls,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async find(id: number) {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('There is no such person.');
    return user;
  }

  /**
   * The link carries the moment the invitation was made (`v`). The signature
   * covers it, so it can't be changed; accepting clears that moment and a new
   * link replaces it, so a link works once and only the newest one works.
   */
  invitationUrl(user: User) {
    return this.links.sign(
      `/invitations/${user.id}?v=${user.invitedAt?.getTime()}`,
      { expiresIn: WEEK },
    );
  }

  /** Whether a link with this `v` is the invitation that's open now. */
  isOpenInvitation(user: User, v: string | undefined) {
    return !!user.invitedAt && v === String(user.invitedAt.getTime());
  }

  async invite(input: { name: string; email: string; role: Role }) {
    if (await this.users.existsBy({ email: input.email }))
      throw new ValidationException({
        email: 'Someone with that address is already here.',
      });
    return this.users.save(
      this.users.create({ ...input, invitedAt: new Date() }),
    );
  }

  /** A fresh link; the old one stops working. */
  async renew(user: User) {
    user.invitedAt = new Date();
    await this.users.update(user.id, { invitedAt: user.invitedAt });
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
