import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { type AnyRequest, header } from 'nestjs-mvc';
import type { AlertSource } from '../database/entities/index.js';
import { AlertsService } from './alerts.service.js';

type WithSource = AnyRequest & { alertSource?: AlertSource };

/**
 * Machines authenticate with the source's token as a bearer token. It runs
 * before the body is validated, so a stranger learns nothing from the schema.
 */
@Injectable()
export class AlertTokenGuard implements CanActivate {
  constructor(private readonly alerts: AlertsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<WithSource>();
    const token = header(req, 'authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    const source = token ? await this.alerts.sourceByToken(token) : null;
    if (!source)
      throw new UnauthorizedException(
        'Send the alert source token as "Authorization: Bearer <token>".',
      );
    req.alertSource = source;
    return true;
  }
}

/** The source AlertTokenGuard authenticated. */
export const CurrentSource = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<WithSource>().alertSource!,
);
