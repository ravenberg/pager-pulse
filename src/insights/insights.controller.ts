import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { View, defer } from 'nestjs-mvc';
import { In, IsNull, MoreThan, Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator.js';
import {
  FollowUp,
  Incident,
  PostMortem,
  SEVERITIES,
  User,
} from '../database/entities/index.js';
import {
  onVisibleIncident,
  visibleWhere,
} from '../incidents/incidents.service.js';

const DAY = 24 * 60 * 60 * 1000;
const RANGES = [30, 90, 180] as const;

const minutesToResolve = (incident: Incident) =>
  (incident.resolvedAt!.getTime() - incident.declaredAt.getTime()) / 60_000;

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return Math.round(
    sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2,
  );
};

/** Monday 00:00 of the week `date` falls in. */
const weekOf = (date: Date) => {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
};

/**
 * How incidents have gone lately. Each block of numbers is a deferred prop in
 * its own group: the page paints straight away, and the four blocks arrive in
 * four parallel requests, each as soon as its own queries are done.
 */
@Controller('insights')
export class InsightsController {
  constructor(
    @InjectRepository(Incident)
    private readonly incidents: Repository<Incident>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    @InjectRepository(PostMortem)
    private readonly postMortems: Repository<PostMortem>,
  ) {}

  @Get()
  @View('Insights/Index')
  index(@CurrentUser() user: User, @Query('days') daysQuery?: string) {
    const days = RANGES.find((d) => String(d) === daysQuery) ?? 90;
    const since = new Date(Date.now() - days * DAY);
    const load = () =>
      this.incidents.find({
        where: visibleWhere(user, { declaredAt: MoreThan(since) }),
        relations: { services: true, lead: true },
        order: { declaredAt: 'ASC' },
      });

    return {
      days,
      ranges: RANGES,
      summary: defer(() => this.summary(load, user), 'summary'),
      weekly: defer(async () => this.weekly(await load(), since), 'weekly'),
      breakdown: defer(async () => this.breakdown(await load()), 'breakdown'),
      people: defer(async () => this.people(await load()), 'people'),
    };
  }

  private async summary(load: () => Promise<Incident[]>, user: User) {
    const incidents = await load();
    const resolved = incidents.filter((incident) => incident.resolvedAt);
    const withWriteUp = resolved.length
      ? await this.postMortems.countBy({
          status: 'published',
          incident: { id: In(resolved.map(({ id }) => id)) },
        })
      : 0;
    return {
      total: incidents.length,
      critical: incidents.filter((i) => i.severity === 'critical').length,
      medianMinutes: median(resolved.map(minutesToResolve)),
      postMortemShare: resolved.length ? withWriteUp / resolved.length : null,
      openFollowUps: await this.followUps.count({
        where: onVisibleIncident(user, { completedAt: IsNull() }),
      }),
    };
  }

  /** One row per week: how many started, and how long they took to resolve. */
  private weekly(incidents: Incident[], since: Date) {
    const weeks: {
      week: string;
      count: number;
      medianMinutes: number | null;
    }[] = [];
    for (
      let week = weekOf(since);
      week.getTime() <= Date.now();
      week = new Date(week.getTime() + 7 * DAY)
    ) {
      const end = week.getTime() + 7 * DAY;
      const those = incidents.filter(
        (i) => i.declaredAt >= week && i.declaredAt.getTime() < end,
      );
      weeks.push({
        week: week.toISOString(),
        count: those.length,
        medianMinutes: median(
          those.filter((i) => i.resolvedAt).map(minutesToResolve),
        ),
      });
    }
    return weeks;
  }

  private breakdown(incidents: Incident[]) {
    const byService = new Map<string, number>();
    for (const incident of incidents)
      for (const service of incident.services)
        byService.set(service.name, (byService.get(service.name) ?? 0) + 1);
    return {
      bySeverity: SEVERITIES.map((severity) => ({
        label: severity,
        count: incidents.filter((i) => i.severity === severity).length,
      })),
      byService: [...byService]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /** Who ends up leading incidents: where the load falls. */
  private people(incidents: Incident[]) {
    const byLead = new Map<string, number>();
    for (const incident of incidents) {
      const name = incident.lead?.name ?? 'Nobody';
      byLead.set(name, (byLead.get(name) ?? 0) + 1);
    }
    return [...byLead]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }
}
