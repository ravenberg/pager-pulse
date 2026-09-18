import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import {
  Escalation,
  type EscalationLevel,
  EscalationPath,
  Schedule,
  User,
} from '../database/entities/index.js';
import { person, reference } from '../incidents/serializers.js';
import { OnCallService } from './oncall.service.js';

const MINUTE = 60 * 1000;

/**
 * Pages people along an escalation path. Like the rotation, where a page is
 * is not stored: it follows from when it started and each level's delay, so
 * there is no job to run when a level times out.
 */
@Injectable()
export class EscalationsService {
  constructor(
    private readonly oncall: OnCallService,
    @InjectRepository(Escalation)
    private readonly escalations: Repository<Escalation>,
    @InjectRepository(EscalationPath)
    private readonly paths: Repository<EscalationPath>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  allPaths() {
    return this.paths.find({ order: { name: 'ASC' } });
  }

  async path(id: number) {
    const path = await this.paths.findOneBy({ id });
    if (!path) throw new NotFoundException('That escalation path is gone.');
    return path;
  }

  /** The level a page is at: the last one whose turn has come. */
  levelAt(escalation: Escalation, at = new Date()) {
    const elapsed = at.getTime() - escalation.createdAt.getTime();
    const levels = escalation.path.levels;
    let until = 0;
    for (const [index, level] of levels.entries()) {
      until += level.delayMinutes * MINUTE;
      if (elapsed < until || index === levels.length - 1)
        return {
          index,
          // When the next level gets paged, if this one stays quiet.
          escalatesAt:
            index < levels.length - 1
              ? new Date(escalation.createdAt.getTime() + until)
              : null,
        };
    }
    return { index: 0, escalatesAt: null };
  }

  /** Who a level pages right now. */
  async targetOf(
    level: EscalationLevel,
    schedules: Schedule[],
    at = new Date(),
  ): Promise<User | null> {
    if (level.userId) return this.users.findOneBy({ id: level.userId });
    const schedule = schedules.find((s) => s.id === level.scheduleId);
    return schedule ? this.oncall.onCallAt(schedule, at) : null;
  }

  /** Describes each level for people: who it pages, and after how long. */
  async describe(path: EscalationPath, schedules?: Schedule[]) {
    schedules ??= await this.oncall.all();
    return Promise.all(
      path.levels.map(async (level) => {
        const schedule = schedules.find((s) => s.id === level.scheduleId);
        const target = await this.targetOf(level, schedules);
        return {
          target: schedule ? schedule.name : (target?.name ?? 'Nobody'),
          kind: schedule ? ('schedule' as const) : ('user' as const),
          now: person(target),
          delayMinutes: level.delayMinutes,
        };
      }),
    );
  }

  async start(input: {
    path: EscalationPath;
    reason: string;
    createdBy: User;
    incidentId?: number | null;
    alertId?: number | null;
  }) {
    return this.escalations.save(
      this.escalations.create({
        path: input.path,
        reason: input.reason,
        createdBy: input.createdBy,
        incident: input.incidentId ? { id: input.incidentId } : null,
        alert: input.alertId ? { id: input.alertId } : null,
      }),
    );
  }

  async acknowledge(id: number, user: User) {
    const escalation = await this.escalations.findOneBy({ id });
    if (!escalation) throw new NotFoundException('That page is gone.');
    if (escalation.acknowledgedAt) return escalation;
    await this.escalations.update(id, {
      acknowledgedAt: new Date(),
      acknowledgedBy: user,
    });
    return escalation;
  }

  /** Pages of the last day, open ones first, each with who it pages now. */
  async recent() {
    const escalations = await this.escalations.find({
      where: { createdAt: MoreThan(new Date(Date.now() - 24 * 60 * MINUTE)) },
      relations: {
        incident: true,
        alert: true,
        createdBy: true,
        acknowledgedBy: true,
      },
      order: { createdAt: 'DESC' },
    });
    const schedules = await this.oncall.all();
    const rows = await Promise.all(
      escalations.map((escalation) => this.row(escalation, schedules)),
    );
    return rows.sort((a, b) => Number(a.acknowledged) - Number(b.acknowledged));
  }

  /** The open pages that are paging this user right now. */
  async pagingFor(user: User) {
    const open = await this.escalations.find({
      where: { acknowledgedAt: IsNull() },
      relations: { incident: true, alert: true, createdBy: true },
    });
    if (!open.length) return [];
    const schedules = await this.oncall.all();
    const rows = await Promise.all(
      open.map((escalation) => this.row(escalation, schedules)),
    );
    return rows.filter((row) => row.paging?.id === user.id);
  }

  private async row(escalation: Escalation, schedules: Schedule[]) {
    const { index, escalatesAt } = this.levelAt(escalation);
    const paging = escalation.acknowledgedAt
      ? null
      : await this.targetOf(escalation.path.levels[index], schedules);
    return {
      id: escalation.id,
      reason: escalation.reason,
      path: escalation.path.name,
      level: index + 1,
      levels: escalation.path.levels.length,
      paging: person(paging),
      escalatesAt: escalatesAt?.toISOString() ?? null,
      incident: escalation.incident && {
        id: escalation.incident.id,
        reference: reference(escalation.incident),
      },
      alert: escalation.alert && {
        id: escalation.alert.id,
        title: escalation.alert.title,
      },
      createdBy: person(escalation.createdBy),
      createdAt: escalation.createdAt.toISOString(),
      acknowledged: !!escalation.acknowledgedAt,
      acknowledgedBy: person(escalation.acknowledgedBy),
    };
  }
}
