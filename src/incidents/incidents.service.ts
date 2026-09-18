import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  type FindOptionsWhere,
  In,
  IsNull,
  MoreThan,
  Not,
  Repository,
  type SelectQueryBuilder,
} from 'typeorm';
import { SubscriptionsService } from '../status/subscriptions.service.js';
import {
  FollowUp,
  Incident,
  type IncidentStatus,
  Service,
  type Severity,
  TimelineEntry,
  type TimelineKind,
  User,
} from '../database/entities/index.js';

export interface DeclareInput {
  title: string;
  summary: string;
  severity: Severity;
  serviceIds: number[];
  leadId: number | null;
  isPublic: boolean;
  isPrivate?: boolean;
}

/** A private incident is for admins, its reporter and its lead. */
export const canSee = (
  incident: Pick<Incident, 'isPrivate' | 'reporter' | 'lead'>,
  user: User,
) =>
  !incident.isPrivate ||
  user.role === 'admin' ||
  incident.reporter?.id === user.id ||
  incident.lead?.id === user.id;

/** `where` narrowed to the incidents this user may see, for `find()`. */
export function visibleWhere(
  user: User,
  where: FindOptionsWhere<Incident> = {},
): FindOptionsWhere<Incident> | FindOptionsWhere<Incident>[] {
  if (user.role === 'admin') return where;
  return [
    { ...where, isPrivate: false },
    { ...where, reporter: { id: user.id } },
    { ...where, lead: { id: user.id } },
  ];
}

/** Follow-ups `where`, narrowed to those of incidents this user may see. */
export function onVisibleIncident(
  user: User,
  where: FindOptionsWhere<FollowUp> = {},
): FindOptionsWhere<FollowUp>[] {
  return [visibleWhere(user)]
    .flat()
    .map((incident) => ({ ...where, incident }));
}

/** The same rule for a query builder over `incident`. */
export function restrictVisible<T extends object>(
  query: SelectQueryBuilder<T>,
  user: User,
  alias = 'incident',
) {
  if (user.role === 'admin') return query;
  return query.andWhere(
    new Brackets((where) =>
      where
        .where(`${alias}.isPrivate = 0`)
        .orWhere(`${alias}.reporterId = :viewerId`)
        .orWhere(`${alias}.leadId = :viewerId`),
    ),
    { viewerId: user.id },
  );
}

export interface ChangeInput {
  severity?: Severity;
  status?: IncidentStatus;
  leadId?: number | null;
}

/** Every change to an incident goes through here, so the timeline records it. */
@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident)
    private readonly incidents: Repository<Incident>,
    @InjectRepository(TimelineEntry)
    private readonly timeline: Repository<TimelineEntry>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    @InjectRepository(Service) private readonly services: Repository<Service>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /** A private incident the viewer may not see is reported as missing. */
  async find(id: number, viewer: User): Promise<Incident> {
    const incident = await this.incidents.findOne({
      where: { id },
      relations: { lead: true, reporter: true, services: true },
    });
    if (!incident || !canSee(incident, viewer))
      throw new NotFoundException(`There is no incident INC-${id}.`);
    return incident;
  }

  /** Oldest first, as the story unfolded; with `afterId` only what came since. */
  timelineOf(incident: Incident, afterId?: number) {
    return this.timeline.find({
      where: {
        incident: { id: incident.id },
        ...(afterId ? { id: MoreThan(afterId) } : {}),
      },
      relations: { author: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  /** The written updates only, newest first. */
  updatesOf(incident: Incident) {
    return this.timeline.find({
      where: { incident: { id: incident.id }, kind: 'update' },
      relations: { author: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  /** For the tab labels. */
  async countsOf(incident: Incident) {
    const where = { incident: { id: incident.id } };
    const [updates, timeline, followUps] = await Promise.all([
      this.timeline.countBy({ ...where, kind: 'update' }),
      this.timeline.countBy(where),
      this.followUps.countBy({ ...where, completedAt: IsNull() }),
    ]);
    return { updates, timeline, followUps };
  }

  followUpsOf(incident: Incident) {
    return this.followUps.find({
      where: { incident: { id: incident.id } },
      relations: { assignee: true },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Incidents like this one, for "have we seen this before?": the same title
   * first, then others on the same services; most recent first.
   */
  async relatedTo(incident: Incident, viewer: User, limit = 5) {
    const serviceIds = (incident.services ?? []).map((service) => service.id);
    const query = this.incidents
      .createQueryBuilder('incident')
      .leftJoinAndSelect('incident.lead', 'lead')
      .leftJoinAndSelect('incident.services', 'service')
      .where('incident.id != :id', { id: incident.id })
      .andWhere(
        new Brackets((match) => {
          match.where('incident.title = :title', { title: incident.title });
          if (serviceIds.length)
            match.orWhere(
              'incident.id IN (SELECT incidentId FROM incident_services_service WHERE serviceId IN (:...serviceIds))',
              { serviceIds },
            );
        }),
      )
      .orderBy('incident.declaredAt', 'DESC');
    restrictVisible(query, viewer);
    // take() with joined services pages by incident, not by row.
    const candidates = await query.take(limit * 4).getMany();
    const rank = (other: Incident) => (other.title === incident.title ? 0 : 1);
    return candidates.sort((a, b) => rank(a) - rank(b)).slice(0, limit);
  }

  countOpen(viewer: User) {
    return this.incidents.countBy(
      visibleWhere(viewer, { status: Not('resolved') }),
    );
  }

  async declare(input: DeclareInput, reporter: User): Promise<Incident> {
    const incident = await this.incidents.save(
      this.incidents.create({
        title: input.title,
        summary: input.summary,
        severity: input.severity,
        isPrivate: input.isPrivate ?? false,
        isPublic: input.isPublic && !input.isPrivate,
        reporter,
        lead: input.leadId
          ? await this.users.findOneBy({ id: input.leadId })
          : reporter,
        services: input.serviceIds.length
          ? await this.services.findBy({ id: In(input.serviceIds) })
          : [],
      }),
    );
    await this.record(
      incident,
      reporter,
      'declared',
      `Declared as ${input.severity}.`,
    );
    if (input.summary)
      await this.record(
        incident,
        reporter,
        'update',
        input.summary,
        incident.isPublic,
      );
    return incident;
  }

  /** Applies whichever fields changed and writes one timeline entry per change. */
  async change(
    incident: Incident,
    input: ChangeInput,
    author: User,
  ): Promise<void> {
    if (input.severity && input.severity !== incident.severity) {
      await this.record(
        incident,
        author,
        'severity',
        `Severity changed from ${incident.severity} to ${input.severity}.`,
      );
      incident.severity = input.severity;
    }

    if (input.status && input.status !== incident.status) {
      await this.record(
        incident,
        author,
        'status',
        `Status changed to ${input.status}.`,
      );
      incident.status = input.status;
      incident.resolvedAt = input.status === 'resolved' ? new Date() : null;
    }

    if (
      input.leadId !== undefined &&
      input.leadId !== (incident.lead?.id ?? null)
    ) {
      const lead = input.leadId
        ? await this.users.findOneBy({ id: input.leadId })
        : null;
      await this.record(
        incident,
        author,
        'lead',
        lead
          ? `${lead.name} is now the incident lead.`
          : 'The incident lead was removed.',
      );
      incident.lead = lead;
    }

    await this.incidents.save(incident);
  }

  async postUpdate(
    incident: Incident,
    author: User,
    body: string,
    isPublic: boolean,
  ): Promise<void> {
    await this.record(
      incident,
      author,
      'update',
      body,
      isPublic && incident.isPublic,
    );
    // Touch the incident so lists sort it as recently active.
    await this.incidents.update(incident.id, { updatedAt: new Date() });
  }

  async addFollowUp(
    incident: Incident,
    author: User,
    title: string,
    assigneeId: number | null,
  ) {
    const assignee = assigneeId
      ? await this.users.findOneBy({ id: assigneeId })
      : null;
    await this.followUps.save(
      this.followUps.create({ incident, title, assignee }),
    );
    await this.record(
      incident,
      author,
      'follow_up',
      `Follow-up added: ${title}`,
    );
  }

  /** A post-mortem milestone on the incident's timeline. */
  notePostMortem(incident: Incident, author: User, body: string) {
    return this.record(incident, author, 'post_mortem', body);
  }

  private async record(
    incident: Incident,
    author: User | null,
    kind: TimelineKind,
    body: string,
    isPublic = false,
  ) {
    const entry = await this.timeline.save(
      this.timeline.create({ incident, author, kind, body, isPublic }),
    );
    // What goes on the status page goes to its subscribers too.
    if (isPublic) await this.subscriptions.notify(incident, body);
    return entry;
  }
}
