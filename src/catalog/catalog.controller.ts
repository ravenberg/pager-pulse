import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ValidationException, View, ViewService } from 'nestjs-mvc';
import { In, Repository } from 'typeorm';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { peopleOnce, servicesOnce } from '../common/lookups.js';
import { Service, Team, User } from '../database/entities/index.js';
import { person } from '../incidents/serializers.js';

const teamId = z.coerce.number().int().positive().nullable().default(null);

const ServiceSchema = z.object({
  name: z.string().trim().min(2, 'Give the service a name.').max(60),
  description: z.string().trim().max(200).default(''),
  teamId,
});

const ServiceChangeSchema = z.object({ teamId: teamId.optional() });

const TeamSchema = z.object({
  name: z.string().trim().min(2, 'Give the team a name.').max(60),
  memberIds: z.array(z.coerce.number().int().positive()).default([]),
});

/**
 * What PagerPulse knows about: services and the teams that own them. The
 * declare form and others keep the services list with once(); every change
 * here calls view.refresh('services'), so their copies are sent again.
 */
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly view: ViewService,
    @InjectRepository(Service) private readonly services: Repository<Service>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Get()
  @View('Catalog/Index')
  async index(@CurrentUser() user: User) {
    return {
      services: servicesOnce(this.services),
      users: peopleOnce(this.users),
      teams: async () => {
        const teams = await this.teams.find({
          relations: { members: true },
          order: { name: 'ASC' },
        });
        const owned = await this.services.find({ relations: { team: true } });
        return teams.map((team) => ({
          id: team.id,
          name: team.name,
          members: team.members.map(person),
          services: owned
            .filter((service) => service.team?.id === team.id)
            .map((service) => service.name),
        }));
      },
      canManage: user.role === 'admin',
    };
  }

  @Post('services')
  @Roles('admin')
  async createService(
    @Body({ schema: ServiceSchema }) body: z.infer<typeof ServiceSchema>,
  ) {
    await this.unique(this.services, body.name, 'A service');
    const count = await this.services.count();
    await this.services.save(
      this.services.create({
        name: body.name,
        description: body.description,
        position: count,
        team: body.teamId ? { id: body.teamId } : null,
      }),
    );
    return this.view
      .refresh('services')
      .flash('success', `${body.name} added.`)
      .back();
  }

  @Patch('services/:id')
  @Roles('admin')
  async changeService(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: ServiceChangeSchema })
    body: z.infer<typeof ServiceChangeSchema>,
  ) {
    const service = await this.services.findOneBy({ id });
    if (!service) throw new NotFoundException('That service is gone.');
    if (body.teamId !== undefined)
      await this.services.update(id, {
        team: body.teamId ? { id: body.teamId } : null,
      });
    return this.view.refresh('services').back();
  }

  @Delete('services/:id')
  @Roles('admin')
  async removeService(@Param('id', ParseIntPipe) id: number) {
    const service = await this.services.findOneBy({ id });
    if (!service) throw new NotFoundException('That service is gone.');
    await this.services.remove(service);
    return this.view
      .refresh('services')
      .flash('success', `${service.name} removed.`)
      .back();
  }

  @Post('teams')
  @Roles('admin')
  async createTeam(
    @Body({ schema: TeamSchema }) body: z.infer<typeof TeamSchema>,
  ) {
    await this.unique(this.teams, body.name, 'A team');
    await this.teams.save(
      this.teams.create({
        name: body.name,
        members: body.memberIds.length
          ? await this.users.findBy({ id: In(body.memberIds) })
          : [],
      }),
    );
    return this.view.flash('success', `Team ${body.name} created.`).back();
  }

  @Delete('teams/:id')
  @Roles('admin')
  async removeTeam(@Param('id', ParseIntPipe) id: number) {
    const team = await this.teams.findOneBy({ id });
    if (!team) throw new NotFoundException('That team is gone.');
    await this.teams.remove(team);
    // Services named it as their owner.
    return this.view
      .refresh('services')
      .flash('success', `Team ${team.name} removed.`)
      .back();
  }

  /** A clash reported on the name field, like any other validation error. */
  private async unique(
    repository: Repository<Service> | Repository<Team>,
    name: string,
    what: string,
  ) {
    const taken = await (repository as Repository<Service>).existsBy({
      name,
    });
    if (taken)
      throw new ValidationException({ name: `${what} called ${name} exists.` });
  }
}
