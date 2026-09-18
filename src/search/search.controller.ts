import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Incident, Service, type User } from '../database/entities/index.js';
import { restrictVisible } from '../incidents/incidents.service.js';

const LIMIT = 6;

/**
 * What the Cmd+K palette asks while you type. No @View: useHttp wants JSON,
 * not a page, so this answers like any API endpoint would.
 */
@Controller('search')
export class SearchController {
  constructor(
    @InjectRepository(Incident)
    private readonly incidents: Repository<Incident>,
    @InjectRepository(Service) private readonly services: Repository<Service>,
  ) {}

  @Get()
  async search(@CurrentUser() user: User, @Query('q') q = '') {
    const term = q.trim().slice(0, 100);
    if (!term) return { incidents: [], services: [] };
    const like = `%${term}%`;
    const number = Number(term.replace(/^inc-/i, ''));

    const query = this.incidents
      .createQueryBuilder('incident')
      .where(
        Number.isInteger(number) && number > 0
          ? '(incident.title LIKE :like OR incident.id = :number)'
          : 'incident.title LIKE :like',
        { like, number },
      )
      .orderBy('incident.declaredAt', 'DESC')
      .take(LIMIT);
    const [incidents, services] = await Promise.all([
      restrictVisible(query, user).getMany(),
      this.services.find({
        where: { name: Like(like) },
        relations: { team: true },
        order: { name: 'ASC' },
        take: LIMIT,
      }),
    ]);

    return {
      incidents: incidents.map((incident) => ({
        id: incident.id,
        reference: `INC-${incident.id}`,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
      })),
      services: services.map((service) => ({
        id: service.id,
        name: service.name,
        team: service.team?.name ?? null,
      })),
    };
  }
}
