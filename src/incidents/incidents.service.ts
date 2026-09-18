import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, Not, Repository } from 'typeorm';
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
  ) {}

  async find(id: number): Promise<Incident> {
    const incident = await this.incidents.findOne({
      where: { id },
      relations: { lead: true, reporter: true, services: true },
    });
    if (!incident)
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

  countOpen() {
    return this.incidents.countBy({ status: Not('resolved') });
  }

  async declare(input: DeclareInput, reporter: User): Promise<Incident> {
    const incident = await this.incidents.save(
      this.incidents.create({
        title: input.title,
        summary: input.summary,
        severity: input.severity,
        isPublic: input.isPublic,
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
        input.isPublic,
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

  private record(
    incident: Incident,
    author: User | null,
    kind: TimelineKind,
    body: string,
    isPublic = false,
  ) {
    return this.timeline.save(
      this.timeline.create({ incident, author, kind, body, isPublic }),
    );
  }
}
