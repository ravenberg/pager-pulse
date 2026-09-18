import { once } from 'nestjs-mvc';
import type { Repository } from 'typeorm';
import type { Service, User } from '../database/entities/index.js';
import { person } from '../incidents/serializers.js';

/**
 * The lists many forms pick from. `once()` under a shared key: the browser
 * keeps its copy across pages and says so with every visit, and the server
 * skips the query while it does. A full page load starts over.
 */
export const peopleOnce = (users: Repository<User>) =>
  once(async () => (await users.find({ order: { name: 'ASC' } })).map(person), {
    as: 'people',
  });

export const servicesOnce = (services: Repository<Service>) =>
  once(
    async () =>
      (await services.find({ order: { position: 'ASC' } })).map((s) => ({
        id: s.id,
        name: s.name,
      })),
    { as: 'services' },
  );
