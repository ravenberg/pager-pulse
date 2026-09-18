import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { SkipCsrf } from 'nestjs-mvc';
import { Public } from '../auth/public.decorator.js';
import type { AlertSource } from '../database/entities/index.js';
import { CurrentSource, AlertTokenGuard } from './alert-token.guard.js';
import { IngestSchema, type IngestPayload } from './alerts.schemas.js';
import { AlertsService } from './alerts.service.js';

/**
 * The webhook monitoring tools post to. No cookie, so no user and no CSRF
 * token: `@Public()` lets it past the login guard, `@SkipCsrf()` past
 * nestjs-mvc's CSRF check, and the source token takes their place. It
 * answers JSON, as a machine expects; the pages are left to the other
 * controllers.
 *
 *   curl -X POST http://localhost:3000/alerts/ingest \
 *     -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
 *     -d '{"title":"High error rate","severity":"critical","dedupKey":"api-5xx"}'
 */
@Public()
@SkipCsrf()
@UseGuards(AlertTokenGuard)
@Controller('alerts/ingest')
export class AlertIngestController {
  constructor(private readonly alerts: AlertsService) {}

  @Post()
  @HttpCode(202)
  async ingest(
    @Body({ schema: IngestSchema }) body: IngestPayload,
    @CurrentSource() source: AlertSource,
  ) {
    const { alert, outcome } = await this.alerts.ingest(source, body);
    return {
      outcome,
      alert: alert && {
        id: alert.id,
        status: alert.status,
        occurrences: alert.occurrences,
      },
    };
  }
}
