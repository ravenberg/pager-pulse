import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { View, ViewService, merge, optional, scroll } from 'nestjs-mvc';
import { Not, Repository } from 'typeorm';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Responder } from '../auth/roles.decorator.js';
import { peopleOnce, servicesOnce } from '../common/lookups.js';
import { toCsv } from '../common/csv.js';
import { paginate } from '../common/pagination.js';
import {
  Alert,
  EscalationPath,
  Incident,
  PostMortem,
  SEVERITIES,
  Service,
  User,
} from '../database/entities/index.js';
import {
  ChangeSchema,
  DeclareSchema,
  FollowUpSchema,
  UpdateSchema,
} from './incidents.schemas.js';
import { alertRow } from '../alerts/serializers.js';
import {
  IncidentsService,
  restrictVisible,
  visibleWhere,
} from './incidents.service.js';
import {
  followUp,
  incidentRow,
  person,
  reference,
  timelineEntry,
} from './serializers.js';

const canRespond = (user: User) => user.role !== 'viewer';

const TABS = ['updates', 'timeline', 'followUps', 'alerts'] as const;
type Tab = (typeof TABS)[number];

/** Sent by the timeline's poll: the id of the last entry it has. */
const TIMELINE_AFTER_HEADER = 'x-timeline-after';

@Controller('incidents')
export class IncidentsController {
  constructor(
    private readonly incidents: IncidentsService,
    private readonly view: ViewService,
    @InjectRepository(Incident)
    private readonly repository: Repository<Incident>,
    @InjectRepository(Service) private readonly services: Repository<Service>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Alert) private readonly alerts: Repository<Alert>,
    @InjectRepository(PostMortem)
    private readonly postMortems: Repository<PostMortem>,
    @InjectRepository(EscalationPath)
    private readonly paths: Repository<EscalationPath>,
  ) {}

  @Get()
  @View('Incidents/Index')
  index(
    @Query('state') state = 'open',
    @Query('severity') severity = '',
    @Query('search') search = '',
    @CurrentUser() user: User,
    @Query('page') page?: string,
  ) {
    return {
      filters: { state, severity, search },
      counts: async () => ({
        open: await this.repository.countBy(
          visibleWhere(user, { status: Not('resolved') }),
        ),
        resolved: await this.repository.countBy(
          visibleWhere(user, { status: 'resolved' }),
        ),
      }),
      // Infinite scroll: the client asks for ?page=N and appends `incidents.data`.
      // Changing a filter resets the prop, so the list starts over.
      incidents: scroll(() =>
        paginate(this.filtered({ state, severity, search }, user), {
          page,
          perPage: 20,
          map: incidentRow,
        }),
      ),
    };
  }

  /** The list as it is filtered, as a spreadsheet: a plain download, not a page. */
  @Get('export')
  async export(
    @Query('state') state = 'open',
    @Query('severity') severity = '',
    @Query('search') search = '',
    @CurrentUser() user: User,
  ) {
    const incidents = await this.filtered({ state, severity, search }, user)
      .take(5000)
      .getMany();
    const rows = incidents.map((incident) => [
      reference(incident),
      incident.title,
      incident.severity,
      incident.status,
      incident.services.map((service) => service.name).join(', '),
      incident.lead?.name ?? '',
      incident.declaredAt.toISOString(),
      incident.resolvedAt?.toISOString() ?? '',
      incident.resolvedAt
        ? Math.round(
            (incident.resolvedAt.getTime() - incident.declaredAt.getTime()) /
              60_000,
          )
        : '',
    ]);
    const csv = toCsv([
      [
        'Reference',
        'Title',
        'Severity',
        'Status',
        'Services',
        'Lead',
        'Declared',
        'Resolved',
        'Minutes to resolve',
      ],
      ...rows,
    ]);
    const day = new Date().toISOString().slice(0, 10);
    return new StreamableFile(Buffer.from(csv), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="incidents-${day}.csv"`,
    });
  }

  /** The incidents list's filters, applied to a query this user may see. */
  private filtered(
    filters: { state: string; severity: string; search: string },
    user: User,
  ) {
    const query = this.repository
      .createQueryBuilder('incident')
      .leftJoinAndSelect('incident.lead', 'lead')
      .leftJoinAndSelect('incident.services', 'service')
      .orderBy('incident.declaredAt', 'DESC');
    restrictVisible(query, user);

    if (filters.state === 'open')
      query.andWhere("incident.status != 'resolved'");
    if (filters.state === 'resolved')
      query.andWhere("incident.status = 'resolved'");
    if ((SEVERITIES as readonly string[]).includes(filters.severity)) {
      query.andWhere('incident.severity = :severity', {
        severity: filters.severity,
      });
    }
    if (filters.search) {
      // "INC-12" or "12" also finds by number; other text only by title.
      const id = Number(filters.search.trim().replace(/^INC-/i, ''));
      query.andWhere(
        Number.isInteger(id)
          ? '(incident.title LIKE :term OR incident.id = :id)'
          : 'incident.title LIKE :term',
        { term: `%${filters.search}%`, id },
      );
    }
    return query;
  }

  @Get('create')
  @Responder()
  @View('Incidents/Create')
  async create() {
    return {
      services: servicesOnce(this.services),
      users: peopleOnce(this.users),
    };
  }

  @Post()
  @Responder()
  async store(
    @Body({ schema: DeclareSchema }) body: z.infer<typeof DeclareSchema>,
    @CurrentUser() user: User,
  ) {
    const incident = await this.incidents.declare(body, user);
    return this.view
      .flash('success', `${reference(incident)} declared. Good luck out there.`)
      .redirect(`/incidents/${incident.id}`);
  }

  /**
   * The incident, with its content in tabs. The active tab (`?tab=`) arrives
   * with the page; the others are `optional()`, never computed until the
   * client switches to one, which is a partial reload asking for just it.
   * The timeline is a `merge()` prop: the poll sends the last id it has and
   * gets only the entries after it, which the client appends.
   */
  @Get(':id')
  @View('Incidents/Show')
  async show(
    @Param('id', ParseIntPipe) id: number,
    @Query('tab') tabQuery: string | undefined,
    @Headers(TIMELINE_AFTER_HEADER) afterHeader: string | undefined,
    @CurrentUser() user: User,
  ) {
    const incident = await this.incidents.find(id, user);
    // What the browser keeps in history for a private incident is encrypted,
    // so after a logout the back button cannot bring it back. Decided per
    // request, where @EncryptHistory() would decide per route.
    if (incident.isPrivate) this.view.encryptHistory();
    const postMortem = await this.postMortems.findOneBy({
      incident: { id: incident.id },
    });
    const tab: Tab = TABS.find((t) => t === tabQuery) ?? 'updates';
    const onTab = <T>(name: Tab, value: () => Promise<T>) =>
      name === tab ? value : optional(value);
    const afterId = Number(afterHeader) || undefined;

    return {
      tab,
      incident: {
        ...incidentRow(incident),
        summary: incident.summary,
        isPublic: incident.isPublic,
        reporter: person(incident.reporter),
        postMortem: postMortem && {
          status: postMortem.status,
          publishedAt: postMortem.publishedAt?.toISOString() ?? null,
        },
      },
      counts: async () => ({
        ...(await this.incidents.countsOf(incident)),
        alerts: await this.alerts.countBy({ incident: { id: incident.id } }),
      }),
      updates: onTab('updates', async () =>
        (await this.incidents.updatesOf(incident)).map(timelineEntry),
      ),
      timeline:
        tab === 'timeline'
          ? merge(
              async () =>
                (await this.incidents.timelineOf(incident, afterId)).map(
                  timelineEntry,
                ),
              { matchOn: 'id' },
            )
          : optional(async () =>
              (await this.incidents.timelineOf(incident)).map(timelineEntry),
            ),
      followUps: onTab('followUps', async () =>
        (await this.incidents.followUpsOf(incident)).map(followUp),
      ),
      alerts: onTab('alerts', async () =>
        (
          await this.alerts.find({
            where: { incident: { id: incident.id } },
            relations: { source: true },
            order: { firstSeenAt: 'DESC' },
          })
        ).map(alertRow),
      ),
      users: peopleOnce(this.users),
      // For the escalate dialog, when it opens.
      escalationPaths: optional(async () =>
        (await this.paths.find({ order: { name: 'ASC' } })).map(
          ({ id, name }) => ({ id, name }),
        ),
      ),
      canRespond: canRespond(user),
    };
  }

  @Patch(':id')
  @Responder()
  async change(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: ChangeSchema }) body: z.infer<typeof ChangeSchema>,
    @CurrentUser() user: User,
  ) {
    await this.incidents.change(
      await this.incidents.find(id, user),
      body,
      user,
    );
    return this.view.back();
  }

  @Post(':id/updates')
  @Responder()
  async postUpdate(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: UpdateSchema }) body: z.infer<typeof UpdateSchema>,
    @CurrentUser() user: User,
  ) {
    const incident = await this.incidents.find(id, user);
    if (body.status)
      await this.incidents.change(incident, { status: body.status }, user);
    await this.incidents.postUpdate(incident, user, body.body, body.isPublic);
    return this.view.flash('success', 'Update posted.').back();
  }

  @Post(':id/follow-ups')
  @Responder()
  async addFollowUp(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: FollowUpSchema }) body: z.infer<typeof FollowUpSchema>,
    @CurrentUser() user: User,
  ) {
    await this.incidents.addFollowUp(
      await this.incidents.find(id, user),
      user,
      body.title,
      body.assigneeId,
    );
    return this.view.back();
  }
}
