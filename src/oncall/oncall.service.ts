import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule, User } from '../database/entities/index.js';
import { person } from '../incidents/serializers.js';

const HOUR = 60 * 60 * 1000;

export interface Shift {
  user: { id: number; name: string } | null;
  startsAt: string;
  endsAt: string;
}

/** Works out who is on call from a rotation: no shifts are stored, they follow from the start and the order. */
@Injectable()
export class OnCallService {
  constructor(
    @InjectRepository(Schedule)
    private readonly schedules: Repository<Schedule>,
  ) {}

  all() {
    return this.schedules.find({
      relations: { members: true },
      order: { name: 'ASC' },
    });
  }

  /** The shift at `at` and the `count - 1` after it. */
  shifts(schedule: Schedule, count: number, at = new Date()): Shift[] {
    const members = [...schedule.members].sort(
      (a, b) => a.position - b.position,
    );
    const length = schedule.shiftHours * HOUR;
    const start = schedule.startsAt.getTime();
    const first = Math.max(0, Math.floor((at.getTime() - start) / length));

    return Array.from({ length: count }, (_, i) => {
      const index = first + i;
      const startsAt = start + index * length;
      return {
        user: members.length
          ? person(members[index % members.length].user)
          : null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(startsAt + length).toISOString(),
      };
    }).filter((shift) => Date.parse(shift.endsAt) > at.getTime());
  }

  /** Who is on call right now, per schedule. */
  async now() {
    const now = new Date();
    return (await this.all()).map((schedule) => {
      const [current] = this.shifts(schedule, 1, now);
      return {
        id: schedule.id,
        name: schedule.name,
        current: schedule.startsAt <= now ? (current ?? null) : null,
      };
    });
  }

  isMember(schedule: Schedule, user: User) {
    return schedule.members.some((member) => member.user.id === user.id);
  }
}
