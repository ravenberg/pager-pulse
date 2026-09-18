import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  type Type,
} from '@nestjs/common';
import {
  type AnyRequest,
  type AnyResponse,
  always,
  header,
  isInertia,
  isPrefetch,
  requestState,
} from 'nestjs-mvc';
import { type Observable, finalize, map } from 'rxjs';
import { Opaque } from '../common/opaque.js';
import { XrayService } from './xray.service.js';

/**
 * Looks at what a handler returns before nestjs-mvc resolves it, so it sees
 * `defer()`, `scroll()` and friends rather than their values. It must run
 * inside MvcInterceptor: XrayModule is imported after MvcModule for that.
 *
 * With X-ray on, the page gets an `__xray` prop describing the route, its
 * props and this request. It is `always()`, so partial reloads carry it too.
 */
@Injectable()
export class XrayInterceptor implements NestInterceptor {
  constructor(private readonly xray: XrayService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<AnyRequest>();
    const res = http.getResponse<AnyResponse>();
    const controller = context.getClass<Type>();
    const route = this.xray.describeRoute(
      controller,
      context.getHandler() as (...args: unknown[]) => unknown,
    );

    if (!route.view) {
      // Mutations end in a redirect, thrown past `map`; note what they flashed.
      return next.handle().pipe(
        finalize(() => {
          const flash = requestState(req).pending.flash;
          if (flash && Object.keys(flash).length > 0)
            this.xray.observe(route.handler, { runtime: 'flash' });
        }),
      );
    }

    const enabled = this.xray.enabled(req, res);
    const started = performance.now();
    return next.handle().pipe(
      map((props: unknown) => {
        if (typeof props !== 'object' || props === null) return props;
        const raw = props as Record<string, unknown>;
        // Shared props can carry helpers too (the paging banner is always()).
        const shared = this.xray
          .describeProps(requestState(req).shared)
          .filter((prop) => prop.kind !== 'eager' && prop.kind !== 'lazy')
          .map((prop) => ({ ...prop, detail: 'shared' }));
        const described = [...this.xray.describeProps(raw), ...shared];
        this.xray.observe(route.handler, { props: described });
        // Set by the handler at runtime, where @EncryptHistory() is static.
        if (requestState(req).encryptHistory)
          this.xray.observe(route.handler, { runtime: 'encrypt-history' });
        if (!enabled) return props;

        const handlerMs = performance.now() - started;
        const split = (name: string) =>
          (header(req, name) ?? '').split(',').filter(Boolean);
        return {
          ...raw,
          __xray: always(
            () =>
              new Opaque({
                route,
                props: described,
                // Resolved last, so everything the middleware shared is there.
                shared: [
                  'errors',
                  'auth',
                  ...Object.keys(requestState(req).shared),
                ],
                actions: this.xray.siblings(controller),
                request: {
                  inertia: isInertia(req),
                  prefetch: isPrefetch(req),
                  partial: split('x-inertia-partial-data'),
                  except: split('x-inertia-partial-except'),
                  reset: split('x-inertia-reset'),
                  exceptOnce: split('x-inertia-except-once-props'),
                  ssr: !isInertia(req) && (requestState(req).ssr ?? route.ssr),
                  handlerMs: Math.round(handlerMs * 10) / 10,
                },
              }),
          ),
        };
      }),
    );
  }
}
