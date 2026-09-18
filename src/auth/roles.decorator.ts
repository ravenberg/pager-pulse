import { SetMetadata } from '@nestjs/common';
import type { Role } from '../database/entities/index.js';

export const ROLES_KEY = 'roles';

/** Restricts a route to users with one of these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Can declare and work on incidents. */
export const Responder = () => Roles('admin', 'responder');
