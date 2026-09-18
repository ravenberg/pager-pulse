import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Schedule,
  type ScheduleOverride,
  User,
} from '../database/entities/index.js';
import { person } from '../incidents/serializers.js';

const HOUR = 60 * 60 * 1000;

export interface Shift {
  user: { id: number; name: string } | null;
  startsAt: string;
  endsAt: string;
  /** Someone covering instead of the rotation. */
  override: boolean;
}

type Cover = Pick<ScheduleOverride, 'user' | 'startsAt' | 'endsAt'> & {
  id?: number;
};

/**
 * Works out who is on call: no shifts are stored. The rotation follows from
 * its start, shift length and order; overrides lie on top of it, the most
 * recent one winning where they overlap.
 */
@Injectable()
export class OnCallService {
  constructor(
    @InjectRepository(Schedule)
    private readonly schedules: Repository<Schedule>,
  ) {}

  all() {
    return this.schedules.find({
      relations: { members: true, overrides: true },
      order: { name: 'ASC' },
    });
  }

  find(id: number) {
    return this.schedules.findOne({
      where: { id },
      relations: { members: true, overrides: true },
    });
  }

  /** Who the rotation puts on call at `at`, ignoring overrides. */
  private rotationAt(schedule: Schedule, at: number) {
    const members = [...schedule.members].sort(
      (a, b) => a.position - b.position,
    );
    const start = schedule.startsAt.getTime();
    if (!members.length || at < start) return null;
    const index = Math.floor((at - start) / (schedule.shiftHours * HOUR));
    return members[index % members.length].user;
  }

  /**
   * Who is on call from `from` to `until`, as consecutive shifts: the
   * rotation's, cut where an override takes over.
   */
  shifts(
    schedule: Schedule,
    from: Date,
    until: Date,
    overrides: Cover[] = schedule.overrides ?? [],
  ): Shift[] {
    const start = from.getTime();
    const end = until.getTime();
    const length = schedule.shiftHours * HOUR;
    const origin = schedule.startsAt.getTime();

    // Every moment the answer can change: handovers and override edges.
    const edges = new Set([start, end]);
    for (
      let t = origin + Math.ceil((start - origin) / length) * length;
      t < end;
      t += length
    )
      if (t > start) edges.add(t);
    for (const cover of overrides) {
      for (const t of [cover.startsAt.getTime(), cover.endsAt.getTime()])
        if (t > start && t < end) edges.add(t);
    }
    const points = [...edges].sort((a, b) => a - b);

    const shifts: Shift[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [a, b] = [points[i], points[i + 1]];
      const cover = overrides
        .filter((o) => o.startsAt.getTime() <= a && o.endsAt.getTime() >= b)
        .at(-1);
      const user = cover ? cover.user : this.rotationAt(schedule, a);
      if (!user && a < origin) continue;
      const last = shifts.at(-1);
      // Glue pieces of the same shift back together.
      if (
        last &&
        last.override === !!cover &&
        last.user?.id === user?.id &&
        Date.parse(last.endsAt) === a &&
        (cover || (a - origin) % length !== 0)
      ) {
        last.endsAt = new Date(b).toISOString();
        continue;
      }
      shifts.push({
        user: person(user),
        startsAt: new Date(a).toISOString(),
        endsAt: new Date(b).toISOString(),
        override: !!cover,
      });
    }
    return shifts;
  }

  /** The shift at `at` and the ones after it, up to `count`. */
  upcoming(schedule: Schedule, count: number, at = new Date()) {
    const horizon = new Date(
      at.getTime() + (count + 1) * schedule.shiftHours * HOUR,
    );
    return this.shifts(schedule, at, horizon).slice(0, count);
  }

  /** Who is on call on this schedule at `at`, overrides included. */
  onCallAt(schedule: Schedule, at = new Date()) {
    return (
      schedule.overrides
        ?.filter((o) => o.startsAt <= at && o.endsAt > at)
        .at(-1)?.user ?? this.rotationAt(schedule, at.getTime())
    );
  }

  /** Who is on call right now, per schedule. */
  async now() {
    const now = new Date();
    return (await this.all()).map((schedule) => {
      const [current] = this.upcoming(schedule, 1, now);
      return {
        id: schedule.id,
        name: schedule.name,
        current:
          current && Date.parse(current.startsAt) <= +now ? current : null,
      };
    });
  }

  /**
   * What an override would change, before it is saved: the shifts with and
   * without it, and a sentence saying so.
   */
  preview(schedule: Schedule, cover: Cover) {
    const pad = Math.min(schedule.shiftHours, 24) * HOUR;
    const from = new Date(cover.startsAt.getTime() - pad);
    const until = new Date(cover.endsAt.getTime() + pad);
    const before = this.shifts(schedule, from, until);
    const after = this.shifts(schedule, from, until, [
      ...(schedule.overrides ?? []),
      cover,
    ]);
    const replaced = before.filter(
      (shift) =>
        Date.parse(shift.endsAt) > cover.startsAt.getTime() &&
        Date.parse(shift.startsAt) < cover.endsAt.getTime() &&
        shift.user?.id !== cover.user.id,
    );
    const people = [...new Set(replaced.map((s) => s.user?.name ?? 'nobody'))];
    return {
      from: from.toISOString(),
      until: until.toISOString(),
      before,
      after,
      hours: Math.round(
        (cover.endsAt.getTime() - cover.startsAt.getTime()) / HOUR,
      ),
      shifts: replaced.length,
      replaces: people,
    };
  }

  isMember(schedule: Schedule, user: User) {
    return schedule.members.some((member) => member.user.id === user.id);
  }
}
