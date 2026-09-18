import { Injectable, type NestMiddleware } from '@nestjs/common';
import { type AnyRequest, always, requestState } from 'nestjs-mvc';
import { AlertsService } from './alerts/alerts.service.js';
import { Opaque } from './common/opaque.js';
import type { User } from './database/entities/index.js';
import { IncidentsService } from './incidents/incidents.service.js';
import { EscalationsService } from './oncall/escalations.service.js';

/** Data every page gets: the badges on "Incidents" and "Alerts" in the sidebar. */
@Injectable()
export class SharedDataMiddleware implements NestMiddleware {
  constructor(
    private readonly incidents: IncidentsService,
    private readonly alerts: AlertsService,
    private readonly escalations: EscalationsService,
  ) {}

  use(req: AnyRequest & { user?: User }, _res: unknown, next: () => void) {
    // Functions, so they only run when a page renders (and after the guards).
    const shared = requestState(req).shared;
    // Internal: not for the guests on the public status page.
    shared.openIncidents = () =>
      req.user ? this.incidents.countOpen(req.user) : null;
    shared.openAlerts = () => (req.user ? this.alerts.countOpen() : null);
    // Pages for the logged-in user, shown as a banner on every page. With
    // always() it comes along with every response, including the partial
    // reloads a page polls with for its own props: whatever page you are
    // on, a page that reaches you shows up within one poll.
    shared.paging = always(async () =>
      req.user ? new Opaque(await this.escalations.pagingFor(req.user)) : [],
    );
    next();
  }
}
