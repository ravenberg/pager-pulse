import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type AnyRequest, readCookie } from 'nestjs-mvc';
import type { Role, User } from '../database/entities/index.js';
import { ACCESS_TOKEN_COOKIE, AuthService } from './auth.service.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';

/**
 * Authenticates every request, public ones included (the layout shows who is
 * logged in everywhere), and refuses where the route needs a user or a role.
 * nestjs-mvc turns the 401 into a redirect to /login and back afterwards.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<AnyRequest & { user?: User }>();
    const token = readCookie(req, ACCESS_TOKEN_COOKIE);
    req.user = token
      ? ((await this.auth.userFromToken(token)) ?? undefined)
      : undefined;

    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets))
      return true;
    if (!req.user) throw new UnauthorizedException();

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      targets,
    );
    if (roles && !roles.includes(req.user.role)) {
      throw new ForbiddenException(
        `This needs the ${roles.join(' or ')} role.`,
      );
    }
    return true;
  }
}
