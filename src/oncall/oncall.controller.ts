import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { View, ViewService, optional } from 'nestjs-mvc';
import { In, Repository } from 'typeorm';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Responder, Roles } from '../auth/roles.decorator.js';
import {
  EscalationPath,
  Schedule,
  type ScheduleMember,
  ScheduleOverride,
  User,
} from '../database/entities/index.js';
import { person } from '../incidents/serializers.js';
import { EscalationsService } from './escalations.service.js';
import { OnCallService } from './oncall.service.js';

const DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 14;

const ScheduleSchema = z.object({
  name: z.string().trim().min(2, 'Give the schedule a name.').max(80),
  startsAt: z.coerce.date('Pick when the first shift starts.'),
  shiftHours: z.coerce
    .number()
    .int()
    .min(1, 'A shift lasts at least an hour.')
    .max(24 * 28),
  memberIds: z
    .array(z.coerce.number().int().positive())
    .min(1, 'Add at least one person to the rotation.'),
});

const OverrideSchema = z
  .object({
    userId: z.coerce.number('Pick who covers.').int().positive(),
    startsAt: z.coerce.date('Pick when the cover starts.'),
    endsAt: z.coerce.date('Pick when the cover ends.'),
  })
  .refine((o) => o.endsAt > o.startsAt, {
    path: ['endsAt'],
    message: 'The cover has to end after it starts.',
  })
  .refine((o) => o.endsAt.getTime() - o.startsAt.getTime() <= 90 * DAY, {
    path: ['endsAt'],
    message: 'Cover at most 90 days at a time.',
  });

/** A level's target as the form sends it: `schedule:3` or `user:7`. */
const PathSchema = z.object({
  name: z.string().trim().min(2, 'Give the path a name.').max(80),
  levels: z
    .array(
      z.object({
        target: z
          .string('Pick who this level pages.')
          .regex(/^(schedule|user):\d+$/, 'Pick who this level pages.'),
        delayMinutes: z.coerce
          .number()
          .int()
          .min(1, 'Wait at least a minute.')
          .max(24 * 60, 'Wait at most a day.'),
      }),
    )
    .min(1, 'Add at least one level.')
    .max(6, 'Six levels is plenty.'),
});

/** `2026-09-18` as the start of that day, else today. */
function dayOf(value: string | undefined) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return dayOf(undefined);
  date.setHours(0, 0, 0, 0);
  return date;
}

@Controller('on-call')
export class OnCallController {
  constructor(
    private readonly oncall: OnCallService,
    private readonly escalations: EscalationsService,
    private readonly view: ViewService,
    @InjectRepository(Schedule)
    private readonly schedules: Repository<Schedule>,
    @InjectRepository(ScheduleOverride)
    private readonly overrides: Repository<ScheduleOverride>,
    @InjectRepository(EscalationPath)
    private readonly paths: Repository<EscalationPath>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Get()
  @View('OnCall/Index')
  async index(@CurrentUser() user: User) {
    const schedules = await this.oncall.all();
    return {
      schedules: schedules.map((schedule) => {
        const [current, ...next] = this.oncall.upcoming(schedule, 3);
        return {
          id: schedule.id,
          name: schedule.name,
          shiftHours: schedule.shiftHours,
          isMember: this.oncall.isMember(schedule, user),
          members: [...schedule.members]
            .sort((a, b) => a.position - b.position)
            .map((m) => person(m.user)),
          current:
            current && Date.parse(current.startsAt) <= Date.now()
              ? current
              : null,
          next: next[0] ?? null,
        };
      }),
      paths: await Promise.all(
        (await this.escalations.allPaths()).map(async (path) => ({
          id: path.id,
          name: path.name,
          levels: await this.escalations.describe(path, schedules),
        })),
      ),
      escalations: () => this.escalations.recent(),
      canManage: user.role === 'admin',
    };
  }

  @Get('create')
  @Roles('admin')
  @View('OnCall/Create')
  async create() {
    return {
      users: (await this.users.find({ order: { name: 'ASC' } })).map(person),
    };
  }

  @Post()
  @Roles('admin')
  async store(
    @Body({ schema: ScheduleSchema }) body: z.infer<typeof ScheduleSchema>,
  ) {
    const users = await this.users.findBy({ id: In(body.memberIds) });
    const byId = new Map(users.map((user) => [user.id, user]));
    const schedule = await this.schedules.save(
      this.schedules.create({
        name: body.name,
        startsAt: body.startsAt,
        shiftHours: body.shiftHours,
        members: body.memberIds
          .filter((id) => byId.has(id))
          .map(
            (id, position) =>
              ({ user: byId.get(id), position }) as ScheduleMember,
          ),
      }),
    );
    return this.view
      .flash('success', `Schedule “${body.name}” created.`)
      .redirect(`/on-call/${schedule.id}`);
  }

  @Get('paths/create')
  @Roles('admin')
  @View('OnCall/PathCreate')
  async createPath() {
    return {
      schedules: (await this.schedules.find({ order: { name: 'ASC' } })).map(
        (s) => ({ id: s.id, name: s.name }),
      ),
      users: (await this.users.find({ order: { name: 'ASC' } })).map(person),
    };
  }

  @Post('paths')
  @Roles('admin')
  async storePath(
    @Body({ schema: PathSchema }) body: z.infer<typeof PathSchema>,
  ) {
    await this.paths.save(
      this.paths.create({
        name: body.name,
        levels: body.levels.map(({ target, delayMinutes }) => {
          const [kind, id] = target.split(':');
          return {
            scheduleId: kind === 'schedule' ? Number(id) : null,
            userId: kind === 'user' ? Number(id) : null,
            delayMinutes,
          };
        }),
      }),
    );
    return this.view
      .flash('success', `Escalation path “${body.name}” created.`)
      .redirect('/on-call?tab=paths');
  }

  @Delete('paths/:pathId')
  @Roles('admin')
  async destroyPath(@Param('pathId', ParseIntPipe) pathId: number) {
    const path = await this.escalations.path(pathId);
    await this.paths.remove(path);
    return this.view
      .flash('success', `Escalation path “${path.name}” deleted.`)
      .back();
  }

  /**
   * One schedule: two weeks of shifts, the overrides, and the form to add
   * one. The form's preview is an `optional()` prop: never computed on a
   * visit, only when the form asks for it by name with a partial reload
   * carrying its values, so there is no separate preview endpoint.
   */
  @Get(':id')
  @View('OnCall/Show')
  async show(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Query('from') fromQuery?: string,
    @Query('previewUserId') previewUserId?: string,
    @Query('previewFrom') previewFrom?: string,
    @Query('previewUntil') previewUntil?: string,
  ) {
    const schedule = await this.schedule(id);
    const from = dayOf(fromQuery);
    const until = new Date(from.getTime() + WINDOW_DAYS * DAY);

    return {
      schedule: {
        id: schedule.id,
        name: schedule.name,
        shiftHours: schedule.shiftHours,
        members: [...schedule.members]
          .sort((a, b) => a.position - b.position)
          .map((m) => person(m.user)),
      },
      window: { from: from.toISOString(), until: until.toISOString() },
      onCall: person(this.oncall.onCallAt(schedule)),
      shifts: () => this.oncall.shifts(schedule, from, until),
      overrides: schedule.overrides
        .filter((o) => o.endsAt.getTime() > Date.now())
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
        .map((o) => ({
          id: o.id,
          user: person(o.user),
          startsAt: o.startsAt.toISOString(),
          endsAt: o.endsAt.toISOString(),
        })),
      users: async () =>
        (await this.users.find({ order: { name: 'ASC' } })).map(person),
      preview: optional(async () => {
        const parsed = OverrideSchema.safeParse({
          userId: previewUserId,
          startsAt: previewFrom,
          endsAt: previewUntil,
        });
        if (!parsed.success) return null;
        const cover = await this.users.findOneBy({ id: parsed.data.userId });
        if (!cover) return null;
        return this.oncall.preview(schedule, {
          user: cover,
          startsAt: parsed.data.startsAt,
          endsAt: parsed.data.endsAt,
        });
      }),
      canRespond: user.role !== 'viewer',
      canManage: user.role === 'admin',
    };
  }

  @Post(':id/overrides')
  @Responder()
  async storeOverride(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: OverrideSchema }) body: z.infer<typeof OverrideSchema>,
    @CurrentUser() user: User,
  ) {
    const schedule = await this.schedule(id);
    const cover = await this.users.findOneBy({ id: body.userId });
    if (!cover) throw new NotFoundException('That person is not here.');
    await this.overrides.save(
      this.overrides.create({
        schedule,
        user: cover,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        createdBy: user,
      }),
    );
    return this.view
      .flash('success', `${cover.name} covers ${schedule.name}.`)
      .back();
  }

  @Delete(':id/overrides/:overrideId')
  @Responder()
  async destroyOverride(
    @Param('id', ParseIntPipe) id: number,
    @Param('overrideId', ParseIntPipe) overrideId: number,
  ) {
    await this.overrides.delete({ id: overrideId, schedule: { id } });
    return this.view.flash('success', 'Override removed.').back();
  }

  @Delete(':id')
  @Roles('admin')
  async destroy(@Param('id', ParseIntPipe) id: number) {
    const schedule = await this.schedule(id);
    await this.schedules.remove(schedule);
    return this.view
      .flash('success', `Schedule “${schedule.name}” deleted.`)
      .redirect('/on-call');
  }

  private async schedule(id: number) {
    const schedule = await this.oncall.find(id);
    if (!schedule)
      throw new NotFoundException('That schedule no longer exists.');
    return schedule;
  }
}
