import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { View, ViewService } from 'nestjs-mvc';
import { IsNull, Not, Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Responder } from '../auth/roles.decorator.js';
import { FollowUp, User } from '../database/entities/index.js';
import { followUp } from './serializers.js';

@Controller('follow-ups')
export class FollowUpsController {
  constructor(
    private readonly view: ViewService,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
  ) {}

  @Get()
  @View('FollowUps/Index')
  async index(
    @CurrentUser() user: User,
    @Query('scope') scope = 'mine',
    @Query('state') state = 'open',
  ) {
    const items = await this.followUps.find({
      where: {
        ...(scope === 'mine' ? { assignee: { id: user.id } } : {}),
        completedAt: state === 'open' ? IsNull() : Not(IsNull()),
      },
      relations: { assignee: true, incident: true },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return {
      filters: { scope, state },
      followUps: items.map(followUp),
      canRespond: user.role !== 'viewer',
    };
  }

  /** Ticks a follow-up off, or reopens it. */
  @Patch(':id/toggle')
  @Responder()
  async toggle(@Param('id', ParseIntPipe) id: number) {
    const item = await this.followUps.findOneBy({ id });
    if (!item) throw new NotFoundException('That follow-up no longer exists.');
    await this.followUps.update(id, {
      completedAt: item.completedAt ? null : new Date(),
    });
    return this.view.back();
  }
}
