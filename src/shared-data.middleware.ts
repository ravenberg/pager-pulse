import { Injectable, type NestMiddleware } from '@nestjs/common';
import { type AnyRequest, requestState } from 'nestjs-mvc';
import { AlertsService } from './alerts/alerts.service.js';
import type { User } from './database/entities/index.js';
import { IncidentsService } from './incidents/incidents.service.js';

/** Data every page gets: the badges on "Incidents" and "Alerts" in the sidebar. */
@Injectable()
export class SharedDataMiddleware implements NestMiddleware {
  constructor(
    private readonly incidents: IncidentsService,
    private readonly alerts: AlertsService,
  ) {}

  use(req: AnyRequest & { user?: User }, _res: unknown, next: () => void) {
    // Functions, so they only run when a page renders (and after the guards).
    const shared = requestState(req).shared;
    shared.openIncidents = () => this.incidents.countOpen();
    // Internal: not for the guests on the public status page.
    shared.openAlerts = () => (req.user ? this.alerts.countOpen() : null);
    next();
  }
}
