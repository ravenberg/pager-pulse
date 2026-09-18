import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Ssr, View } from 'nestjs-mvc';
import { MoreThan, Not, Repository } from 'typeorm';
import { Public } from '../auth/public.decorator.js';
import {
  Incident,
  type Severity,
  Service,
  TimelineEntry,
} from '../database/entities/index.js';
import { reference } from '../incidents/serializers.js';

const DAY = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 30;

type ServiceStatus =
  'operational' | 'degraded' | 'partial_outage' | 'major_outage';

const IMPACT: Record<Severity, ServiceStatus> = {
  critical: 'major_outage',
  major: 'partial_outage',
  minor: 'degraded',
};
const RANK: ServiceStatus[] = [
  'operational',
  'degraded',
  'partial_outage',
  'major_outage',
];
const worst = (statuses: ServiceStatus[]) =>
  statuses.reduce(
    (a, b) => (RANK.indexOf(b) > RANK.indexOf(a) ? b : a),
    'operational' as ServiceStatus,
  );

/**
 * The public status page: no login, rendered on the server (`@Ssr()`) so it
 * works for search engines, link previews and people without JavaScript.
 * Only public incidents and public updates appear here.
 */
@Public()
@Ssr()
@Controller('status')
export class StatusController {
  constructor(
    @InjectRepository(Incident)
    private readonly incidents: Repository<Incident>,
    @InjectRepository(Service) private readonly services: Repository<Service>,
    @InjectRepository(TimelineEntry)
    private readonly timeline: Repository<TimelineEntry>,
  ) {}

  @Get()
  @View('Status/Show')
  async show() {
    const since = new Date(Date.now() - HISTORY_DAYS * DAY);
    const [services, active, recent] = await Promise.all([
      this.services.find({ order: { position: 'ASC' } }),
      this.incidents.find({
        where: { isPublic: true, status: Not('resolved') },
        relations: { services: true },
        order: { declaredAt: 'DESC' },
      }),
      this.incidents.find({
        where: { isPublic: true, declaredAt: MoreThan(since) },
        relations: { services: true },
        order: { declaredAt: 'DESC' },
      }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const serviceRows = services.map((service) => {
      const affects = (incident: Incident) =>
        incident.services.some((s) => s.id === service.id);
      // One bar per day: the worst impact of any incident that day.
      const history = Array.from({ length: HISTORY_DAYS }, (_, i) => {
        const dayStart = today.getTime() - (HISTORY_DAYS - 1 - i) * DAY;
        const dayEnd = dayStart + DAY;
        const that = recent.filter(
          (incident) =>
            affects(incident) &&
            incident.declaredAt.getTime() < dayEnd &&
            (incident.resolvedAt?.getTime() ?? Date.now()) >= dayStart,
        );
        return {
          date: new Date(dayStart).toISOString(),
          status: worst(that.map((incident) => IMPACT[incident.severity])),
          incidents: that.map((incident) => incident.title),
        };
      });
      return {
        id: service.id,
        name: service.name,
        description: service.description,
        status: worst(
          active.filter(affects).map((incident) => IMPACT[incident.severity]),
        ),
        uptime:
          history.filter((day) => day.status === 'operational').length /
          HISTORY_DAYS,
        history,
      };
    });

    return {
      overall: worst(serviceRows.map((row) => row.status)),
      services: serviceRows,
      active: await Promise.all(
        active.map((incident) => this.publicIncident(incident)),
      ),
      past: await Promise.all(
        recent
          .filter((incident) => incident.status === 'resolved')
          .slice(0, 10)
          .map((incident) => this.publicIncident(incident)),
      ),
    };
  }

  @Get('incidents/:id')
  @View('Status/Incident')
  async incident(@Param('id', ParseIntPipe) id: number) {
    const incident = await this.incidents.findOne({
      where: { id, isPublic: true },
      relations: { services: true },
    });
    if (!incident)
      throw new NotFoundException(
        'There is no public incident with that number.',
      );
    return { incident: await this.publicIncident(incident) };
  }

  private async publicIncident(incident: Incident) {
    const updates = await this.timeline.find({
      where: { incident: { id: incident.id }, isPublic: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return {
      id: incident.id,
      reference: reference(incident),
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      impact: IMPACT[incident.severity],
      services: incident.services.map((service) => service.name),
      declaredAt: incident.declaredAt.toISOString(),
      resolvedAt: incident.resolvedAt?.toISOString() ?? null,
      updates: updates.map((update) => ({
        id: update.id,
        body: update.body,
        createdAt: update.createdAt.toISOString(),
      })),
    };
  }
}
