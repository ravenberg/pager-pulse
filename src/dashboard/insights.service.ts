import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, Repository } from 'typeorm';
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
export const RANGES = [30, 90, 180] as const;

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

/** How incidents have gone lately, over the incidents a user may see. */
@Injectable()
export class InsightsService {
  constructor(
    @InjectRepository(Incident)
    private readonly incidents: Repository<Incident>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    @InjectRepository(PostMortem)
    private readonly postMortems: Repository<PostMortem>,
  ) {}

  /** The incidents declared in the last `days`, oldest first. */
  load(user: User, days: number) {
    return this.incidents.find({
      where: visibleWhere(user, {
        declaredAt: MoreThan(new Date(Date.now() - days * DAY)),
      }),
      relations: { services: true, lead: true },
      order: { declaredAt: 'ASC' },
    });
  }

  async summary(incidents: Incident[], user: User) {
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
  weekly(incidents: Incident[], since: Date) {
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

  breakdown(incidents: Incident[]) {
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
  people(incidents: Incident[]) {
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
