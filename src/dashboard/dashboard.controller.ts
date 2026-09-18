import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { View, defer } from 'nestjs-mvc';
import { IsNull, Not, Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { FollowUp, Incident, User } from '../database/entities/index.js';
import { followUp, incidentRow } from '../incidents/serializers.js';
import {
  onVisibleIncident,
  visibleWhere,
} from '../incidents/incidents.service.js';
import { OnCallService } from '../oncall/oncall.service.js';
import { InsightsService, RANGES } from './insights.service.js';

const DAY = 24 * 60 * 60 * 1000;

@Controller()
export class DashboardController {
  constructor(
    private readonly oncall: OnCallService,
    @InjectRepository(Incident)
    private readonly incidents: Repository<Incident>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    private readonly insights: InsightsService,
  ) {}

  @Get()
  @View('Dashboard')
  async index(@CurrentUser() user: User, @Query('days') daysQuery?: string) {
    const days = RANGES.find((d) => String(d) === daysQuery) ?? 30;
    const since = new Date(Date.now() - days * DAY);
    const load = () => this.insights.load(user, days);
    return {
      active: (
        await this.incidents.find({
          where: visibleWhere(user, { status: Not('resolved') }),
          relations: { lead: true, services: true },
          order: { declaredAt: 'DESC' },
        })
      ).map(incidentRow),
      onCall: await this.oncall.now(),
      myFollowUps: (
        await this.followUps.find({
          where: onVisibleIncident(user, {
            assignee: { id: user.id },
            completedAt: IsNull(),
          }),
          relations: { incident: true, assignee: true },
          order: { createdAt: 'DESC' },
          take: 5,
        })
      ).map(followUp),
      // How it's going, over a period the page picks. Four blocks, each a
      // deferred prop in its own group: the page paints straight away, and
      // each block arrives in its own request as soon as its queries are done.
      days,
      ranges: RANGES,
      summary: defer(
        async () => this.insights.summary(await load(), user),
        'summary',
      ),
      weekly: defer(
        async () => this.insights.weekly(await load(), since),
        'weekly',
      ),
      breakdown: defer(
        async () => this.insights.breakdown(await load()),
        'breakdown',
      ),
      people: defer(async () => this.insights.people(await load()), 'people'),
    };
  }
}
