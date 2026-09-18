import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { View, ViewService, scroll } from 'nestjs-mvc';
import { Not, Repository } from 'typeorm';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Responder } from '../auth/roles.decorator.js';
import { paginate } from '../common/pagination.js';
import {
  Incident,
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
import { IncidentsService } from './incidents.service.js';
import {
  followUp,
  incidentRow,
  person,
  reference,
  timelineEntry,
} from './serializers.js';

const canRespond = (user: User) => user.role !== 'viewer';

@Controller('incidents')
export class IncidentsController {
  constructor(
    private readonly incidents: IncidentsService,
    private readonly view: ViewService,
    @InjectRepository(Incident)
    private readonly repository: Repository<Incident>,
    @InjectRepository(Service) private readonly services: Repository<Service>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Get()
  @View('Incidents/Index')
  index(
    @Query('state') state = 'open',
    @Query('severity') severity = '',
    @Query('search') search = '',
    @Query('page') page?: string,
  ) {
    return {
      filters: { state, severity, search },
      counts: async () => ({
        open: await this.repository.countBy({ status: Not('resolved') }),
        resolved: await this.repository.countBy({ status: 'resolved' }),
      }),
      // Infinite scroll: the client asks for ?page=N and appends `incidents.data`.
      // Changing a filter resets the prop, so the list starts over.
      incidents: scroll(() => {
        const query = this.repository
          .createQueryBuilder('incident')
          .leftJoinAndSelect('incident.lead', 'lead')
          .leftJoinAndSelect('incident.services', 'service')
          .orderBy('incident.declaredAt', 'DESC');

        if (state === 'open') query.andWhere("incident.status != 'resolved'");
        if (state === 'resolved')
          query.andWhere("incident.status = 'resolved'");
        if ((SEVERITIES as readonly string[]).includes(severity)) {
          query.andWhere('incident.severity = :severity', { severity });
        }
        if (search) {
          const id = Number(search.replace(/^INC-/i, ''));
          query.andWhere('(incident.title LIKE :term OR incident.id = :id)', {
            term: `%${search}%`,
            id,
          });
        }

        return paginate(query, { page, perPage: 20, map: incidentRow });
      }),
    };
  }

  @Get('create')
  @Responder()
  @View('Incidents/Create')
  async create() {
    return {
      services: (await this.services.find({ order: { position: 'ASC' } })).map(
        (s) => ({ id: s.id, name: s.name }),
      ),
      users: (await this.users.find({ order: { name: 'ASC' } })).map(person),
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

  @Get(':id')
  @View('Incidents/Show')
  async show(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const incident = await this.incidents.find(id);
    return {
      incident: {
        ...incidentRow(incident),
        summary: incident.summary,
        isPublic: incident.isPublic,
        reporter: person(incident.reporter),
      },
      // Plain props, so the page can poll just these two with a partial reload.
      timeline: async () =>
        (await this.incidents.timelineOf(incident)).map(timelineEntry),
      followUps: async () =>
        (await this.incidents.followUpsOf(incident)).map(followUp),
      users: async () =>
        (await this.users.find({ order: { name: 'ASC' } })).map(person),
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
    await this.incidents.change(await this.incidents.find(id), body, user);
    return this.view.back();
  }

  @Post(':id/updates')
  @Responder()
  async postUpdate(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: UpdateSchema }) body: z.infer<typeof UpdateSchema>,
    @CurrentUser() user: User,
  ) {
    const incident = await this.incidents.find(id);
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
      await this.incidents.find(id),
      user,
      body.title,
      body.assigneeId,
    );
    return this.view.back();
  }
}
