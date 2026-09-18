import { Injectable, type NestMiddleware } from '@nestjs/common';
import {
  type AnyRequest,
  isPrecognitive,
  requestMethod,
  requestPath,
} from 'nestjs-mvc';
import { XrayService } from './xray.service.js';

/**
 * Notes which routes get Precognition (live validation) requests. Those are
 * answered by nestjs-mvc's interceptor before the handler, or any interceptor
 * after it, would run: a middleware is the one place that sees them.
 */
@Injectable()
export class XrayPrecognitionMiddleware implements NestMiddleware {
  constructor(private readonly xray: XrayService) {}

  use(req: AnyRequest, _res: unknown, next: () => void) {
    if (isPrecognitive(req)) {
      const handler = this.xray.routeFor(requestMethod(req), requestPath(req));
      if (handler) this.xray.observe(handler, { runtime: 'precognition' });
    }
    next();
  }
}
