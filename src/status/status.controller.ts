import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Ssr, View, ViewService } from 'nestjs-mvc';
import { Between, LessThan, MoreThan, Not, Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import {
  Incident,
  PostMortem,
  type Severity,
  Service,
  TimelineEntry,
  type User,
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
    @InjectRepository(PostMortem)
    private readonly postMortems: Repository<PostMortem>,
    private readonly view: ViewService,
  ) {}

  @Get()
  @View('Status/Show')
  async show(@Query('month') month?: string) {
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
      // A closure: the month buttons reload just this prop.
      calendar: () => this.calendar(month),
    };
  }

  /** One month, a cell per day, coloured by the worst public incident that day. */
  private async calendar(month?: string) {
    const [year, index] = /^\d{4}-\d{2}$/.test(month ?? '')
      ? month!.split('-').map(Number)
      : [new Date().getFullYear(), new Date().getMonth() + 1];
    const start = new Date(year, index - 1, 1);
    const end = new Date(year, index, 1);
    const incidents = await this.incidents.find({
      where: [
        { isPublic: true, declaredAt: Between(start, end) },
        {
          isPublic: true,
          declaredAt: LessThan(start),
          resolvedAt: MoreThan(start),
        },
      ],
      order: { declaredAt: 'ASC' },
    });
    const days = Array.from(
      { length: new Date(year, index, 0).getDate() },
      (_, i) => {
        const dayStart = new Date(year, index - 1, i + 1);
        const dayEnd = new Date(year, index - 1, i + 2);
        const that = incidents.filter(
          (incident) =>
            incident.declaredAt < dayEnd &&
            (incident.resolvedAt ?? new Date()) >= dayStart,
        );
        return {
          date: dayStart.toISOString(),
          future: dayStart.getTime() > Date.now(),
          status: worst(that.map((incident) => IMPACT[incident.severity])),
          incidents: that.map(({ id, title }) => ({ id, title })),
        };
      },
    );
    const shift = (by: number) => {
      const d = new Date(year, index - 1 + by, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    return {
      month: shift(0),
      previous: shift(-1),
      // No looking into the future.
      next: end.getTime() <= Date.now() ? shift(1) : null,
      days,
    };
  }

  @Get('incidents/:id')
  @View('Status/Incident')
  async incident(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User | undefined,
  ) {
    // Rendered on the server for who needs it: customers, crawlers, link
    // previews. A teammate who is logged in follows the link from inside the
    // app, has the JavaScript already, and gets the page rendered in the
    // browser: @Ssr() is the default, disableSsr() decides per request.
    if (user) this.view.disableSsr();
    const incident = await this.incidents.findOne({
      where: { id, isPublic: true },
      relations: { services: true },
    });
    if (!incident)
      throw new NotFoundException(
        'There is no public incident with that number.',
      );
    // The published post-mortem, minus who wrote it: the public write-up.
    const postMortem = await this.postMortems.findOneBy({
      incident: { id: incident.id },
      status: 'published',
    });
    return {
      incident: await this.publicIncident(incident),
      // Teammates can jump to the incident as the team sees it.
      internalUrl: user ? `/incidents/${incident.id}` : null,
      writeUp: postMortem && {
        summary: postMortem.summary,
        impact: postMortem.impact,
        rootCause: postMortem.rootCause,
        lessons: postMortem.lessons,
        publishedAt: postMortem.publishedAt?.toISOString() ?? null,
      },
    };
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
