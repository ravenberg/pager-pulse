import 'reflect-metadata';
import type { Repository } from 'typeorm';
import type {
  Schedule,
  ScheduleMember,
  ScheduleOverride,
  User,
} from '../database/entities/index.js';
import { OnCallService } from './oncall.service.js';

const user = (id: number, name: string) => ({ id, name }) as User;
const ada = user(1, 'Ada');
const bob = user(2, 'Bob');
const cy = user(3, 'Cy');
const at = (hour: number) => new Date(Date.UTC(2026, 0, 1, hour));

/** Daily shifts from Jan 1st 00:00: Ada, Bob, Ada, Bob… */
const schedule = (overrides: Partial<ScheduleOverride>[] = []) =>
  ({
    startsAt: at(0),
    shiftHours: 24,
    members: [ada, bob].map(
      (u, position) => ({ user: u, position }) as ScheduleMember,
    ),
    overrides,
  }) as unknown as Schedule;

const service = new OnCallService({} as Repository<Schedule>);
const brief = (s: ReturnType<OnCallService['shifts']>) =>
  s.map(
    (shift) =>
      `${shift.user?.name}${shift.override ? '*' : ''} ${new Date(shift.startsAt).getUTCHours()}+${(Date.parse(shift.endsAt) - Date.parse(shift.startsAt)) / 3_600_000}h`,
  );

describe('OnCallService.shifts', () => {
  it('follows the rotation', () => {
    expect(brief(service.shifts(schedule(), at(0), at(48)))).toEqual([
      'Ada 0+24h',
      'Bob 0+24h',
    ]);
  });

  it('cuts a shift where an override takes over, and resumes after it', () => {
    const cover = { user: cy, startsAt: at(6), endsAt: at(12) };
    expect(brief(service.shifts(schedule([cover]), at(0), at(24)))).toEqual([
      'Ada 0+6h',
      'Cy* 6+6h',
      'Ada 12+12h',
    ]);
  });

  it('lets an override span a handover', () => {
    const cover = { user: cy, startsAt: at(20), endsAt: at(28) };
    expect(brief(service.shifts(schedule([cover]), at(0), at(48)))).toEqual([
      'Ada 0+20h',
      'Cy* 20+8h',
      'Bob 4+20h',
    ]);
  });

  it('knows who is on call at a moment', () => {
    const s = schedule([{ user: cy, startsAt: at(6), endsAt: at(12) }]);
    expect(service.onCallAt(s, at(3))?.name).toBe('Ada');
    expect(service.onCallAt(s, at(7))?.name).toBe('Cy');
    expect(service.onCallAt(s, at(30))?.name).toBe('Bob');
  });

  it('previews an override: what it covers and whom it replaces', () => {
    const preview = service.preview(schedule(), {
      user: cy,
      startsAt: at(12),
      endsAt: at(36),
    });
    expect(preview).toMatchObject({
      hours: 24,
      shifts: 2,
      replaces: ['Ada', 'Bob'],
    });
    // A day either side for context; nothing before the rotation starts.
    expect(brief(preview.after)).toEqual([
      'Ada 0+12h',
      'Cy* 12+24h',
      'Bob 12+12h',
      'Ada 0+12h',
    ]);
  });
});
