import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { View, ViewService } from 'nestjs-mvc';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { User } from '../database/entities/index.js';
import { InviteSchema, RoleSchema } from './people.schemas.js';
import { PeopleService } from './people.service.js';

const stateOf = (user: User) =>
  user.deactivatedAt ? 'deactivated' : user.invitedAt ? 'invited' : 'active';

/**
 * Admins manage who can use PagerPulse. After anything that changes who is
 * here, `view.refresh('people')` makes every page that keeps the once()
 * list of people send it again.
 */
@Roles('admin')
@Controller('people')
export class PeopleController {
  constructor(
    private readonly people: PeopleService,
    private readonly view: ViewService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Get()
  @View('People/Index')
  async index(@CurrentUser() me: User) {
    const users = await this.users.find({ order: { name: 'ASC' } });
    return {
      people: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        state: stateOf(user),
        since: (user.invitedAt ?? user.createdAt).toISOString(),
        isYou: user.id === me.id,
      })),
    };
  }

  @Post()
  async invite(
    @Body({ schema: InviteSchema }) body: z.infer<typeof InviteSchema>,
  ) {
    const user = await this.people.invite(body);
    this.view.refresh('people');
    return this.shareLink(user);
  }

  @Patch(':id')
  async changeRole(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: RoleSchema }) body: z.infer<typeof RoleSchema>,
    @CurrentUser() me: User,
  ) {
    const user = await this.someoneElse(id, me);
    await this.people.changeRole(user, body.role);
    return this.view
      .flash('success', `${user.name} is now ${body.role}.`)
      .back();
  }

  /** A lost link can't be shown again (it isn't stored): make a new one. */
  @Post(':id/link')
  async newLink(@Param('id', ParseIntPipe) id: number) {
    const user = await this.people.find(id);
    if (!user.invitedAt)
      throw new ForbiddenException(`${user.name} has already joined.`);
    await this.people.renew(user);
    return this.shareLink(user);
  }

  /**
   * The link goes back as flash data: on the page right after the redirect,
   * once, for the admin to copy into a chat. It is in no prop, no database
   * and no history entry.
   */
  private shareLink(user: User) {
    return this.view
      .flash('invitation', {
        name: user.name,
        url: this.people.invitationUrl(user),
      })
      .back();
  }

  @Post(':id/deactivate')
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() me: User,
  ) {
    const user = await this.someoneElse(id, me);
    await this.people.deactivate(user);
    this.view.refresh('people');
    return this.view
      .flash('success', `${user.name} can no longer log in.`)
      .back();
  }

  @Post(':id/reactivate')
  async reactivate(@Param('id', ParseIntPipe) id: number) {
    const user = await this.people.find(id);
    await this.people.reactivate(user);
    this.view.refresh('people');
    return this.view.flash('success', `${user.name} is back.`).back();
  }

  /**
   * Your own role and access are for another admin to change, which also
   * means there is always an admin left.
   */
  private async someoneElse(id: number, me: User) {
    if (id === me.id)
      throw new ForbiddenException(
        'Ask another admin to change your own role or access.',
      );
    return this.people.find(id);
  }
}
