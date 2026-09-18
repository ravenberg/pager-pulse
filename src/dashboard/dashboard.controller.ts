import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { View, defer } from 'nestjs-mvc';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator.js';
import {
  FollowUp,
  Incident,
  SEVERITIES,
  User,
} from '../database/entities/index.js';
import { followUp, incidentRow } from '../incidents/serializers.js';
import { OnCallService } from '../oncall/oncall.service.js';

const DAY = 24 * 60 * 60 * 1000;

@Controller()
export class DashboardController {
  constructor(
    private readonly oncall: OnCallService,
    @InjectRepository(Incident)
    private readonly incidents: Repository<Incident>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
  ) {}

  @Get()
  @View('Dashboard')
  async index(@CurrentUser() user: User) {
    return {
      active: (
        await this.incidents.find({
          where: { status: Not('resolved') },
          relations: { lead: true, services: true },
          order: { declaredAt: 'DESC' },
        })
      ).map(incidentRow),
      onCall: await this.oncall.now(),
      myFollowUps: (
        await this.followUps.find({
          where: { assignee: { id: user.id }, completedAt: IsNull() },
          relations: { incident: true, assignee: true },
          order: { createdAt: 'DESC' },
          take: 5,
        })
      ).map(followUp),
      // The numbers need a scan over the last 30 days, so the page paints
      // first and they arrive in a follow-up request.
      stats: defer(() => this.stats()),
    };
  }

  private async stats() {
    const recent = await this.incidents.find({
      where: { declaredAt: MoreThan(new Date(Date.now() - 30 * DAY)) },
    });
    const resolved = recent.filter((incident) => incident.resolvedAt);
    const minutes = resolved.map(
      (i) => (i.resolvedAt!.getTime() - i.declaredAt.getTime()) / 60000,
    );
    return {
      total: recent.length,
      mttrMinutes: minutes.length
        ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length)
        : null,
      bySeverity: Object.fromEntries(
        SEVERITIES.map((s) => [
          s,
          recent.filter((i) => i.severity === s).length,
        ]),
      ),
      openFollowUps: await this.followUps.countBy({ completedAt: IsNull() }),
    };
  }
}
