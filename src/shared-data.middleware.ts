import { Injectable, type NestMiddleware } from '@nestjs/common';
import { type AnyRequest, requestState } from 'nestjs-mvc';
import { IncidentsService } from './incidents/incidents.service.js';

/** Data every page gets: the badge on "Incidents" in the sidebar. */
@Injectable()
export class SharedDataMiddleware implements NestMiddleware {
  constructor(private readonly incidents: IncidentsService) {}

  use(req: AnyRequest, _res: unknown, next: () => void) {
    // A function, so it only runs when a page renders (and after the guards).
    requestState(req).shared.openIncidents = () => this.incidents.countOpen();
    next();
  }
}
