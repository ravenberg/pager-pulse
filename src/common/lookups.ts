import { once } from 'nestjs-mvc';
import { IsNull, type Repository } from 'typeorm';
import type { Service, User } from '../database/entities/index.js';
import { person } from '../incidents/serializers.js';

/**
 * The lists many forms pick from. `once()` under a shared key: the browser
 * keeps its copy across pages and says so with every visit, and the server
 * skips the query while it does. A full page load starts over. People
 * management calls `view.refresh('people')` when someone joins or leaves.
 */
export const peopleOnce = (users: Repository<User>) =>
  once(
    async () =>
      (
        await users.find({
          where: { deactivatedAt: IsNull() },
          order: { name: 'ASC' },
        })
      ).map(person),
    { as: 'people' },
  );

/**
 * The services, with their owning team: the declare form picks from them and
 * the catalog manages them. The catalog uses it too, so a `view.refresh(
 * 'services')` after an edit lands on a render that carries it, and every
 * page's copy is up to date after that.
 */
export const servicesOnce = (services: Repository<Service>) =>
  once(
    async () =>
      (
        await services.find({
          relations: { team: true },
          order: { position: 'ASC', name: 'ASC' },
        })
      ).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        team: s.team && { id: s.team.id, name: s.team.name },
      })),
    { as: 'services' },
  );
