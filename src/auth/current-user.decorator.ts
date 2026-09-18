import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { User } from '../database/entities/index.js';

/** The logged-in user the auth guard put on the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User =>
    context.switchToHttp().getRequest().user,
);
