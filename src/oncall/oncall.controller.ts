import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { View, ViewService } from 'nestjs-mvc';
import { In, Repository } from 'typeorm';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import {
  Schedule,
  type ScheduleMember,
  User,
} from '../database/entities/index.js';
import { person } from '../incidents/serializers.js';
import { OnCallService } from './oncall.service.js';

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

@Controller('on-call')
export class OnCallController {
  constructor(
    private readonly oncall: OnCallService,
    private readonly view: ViewService,
    @InjectRepository(Schedule)
    private readonly schedules: Repository<Schedule>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Get()
  @View('OnCall/Index')
  async index(@CurrentUser() user: User) {
    const schedules = await this.oncall.all();
    return {
      schedules: schedules.map((schedule) => ({
        id: schedule.id,
        name: schedule.name,
        shiftHours: schedule.shiftHours,
        isMember: this.oncall.isMember(schedule, user),
        members: [...schedule.members]
          .sort((a, b) => a.position - b.position)
          .map((m) => person(m.user)),
        shifts: this.oncall.shifts(schedule, 8),
      })),
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
    await this.schedules.save(
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
      .redirect('/on-call');
  }

  @Delete(':id')
  @Roles('admin')
  async destroy(@Param('id', ParseIntPipe) id: number) {
    const schedule = await this.schedules.findOneBy({ id });
    if (!schedule)
      throw new NotFoundException('That schedule no longer exists.');
    await this.schedules.remove(schedule);
    return this.view
      .flash('success', `Schedule “${schedule.name}” deleted.`)
      .redirect('/on-call');
  }
}
