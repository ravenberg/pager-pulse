import {
  Injectable,
  type OnApplicationBootstrap,
  RequestMethod,
  type Type,
} from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants.js';
import { RouteParamtypes } from '@nestjs/common/internal';
import { DiscoveryService, Reflector } from '@nestjs/core';
import {
  AlwaysProp,
  type AnyRequest,
  type AnyResponse,
  DeferProp,
  MVC_ENCRYPT_HISTORY_METADATA,
  MVC_SSR_METADATA,
  MVC_VIEW_METADATA,
  MergeProp,
  OnceProp,
  OptionalProp,
  ScrollProp,
  SignedUrlGuard,
  clearCookie,
  readCookie,
  writeCookie,
} from 'nestjs-mvc';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { ROLES_KEY } from '../auth/roles.decorator.js';

/** Set by `@SkipCsrf()`; nestjs-mvc does not export the key. */
const SKIP_CSRF_METADATA = 'mvc:skip-csrf';

export const XRAY_COOKIE = 'pp_xray';

export type PropKind =
  | 'eager'
  | 'lazy'
  | 'defer'
  | 'optional'
  | 'always'
  | 'merge'
  | 'prepend'
  | 'deep-merge'
  | 'scroll'
  | 'once';

export interface PropInfo {
  path: string;
  kind: PropKind;
  /** Deferred group, scroll wrapper, once key, merge match field. */
  detail?: string;
}

export interface RouteInfo {
  handler: string;
  method: string;
  path: string;
  /** The page component, for handlers with `@View()`. */
  view: string | null;
  ssr: boolean;
  encryptHistory: boolean;
  public: boolean;
  roles: string[];
  skipCsrf: boolean;
  signedUrl: boolean;
  /** Fields of the body schema the validation pipe checks. */
  schema: string[] | null;
}

/** What X-ray has seen a route do since the process started. */
interface Observation {
  props: PropInfo[];
  flash: boolean;
  lastSeen: number;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  Object.getPrototypeOf(value) === Object.prototype;

/**
 * Knows which nestjs-mvc features each route uses: the decorators from its
 * metadata, the prop helpers from what its handler returned.
 */
@Injectable()
export class XrayService implements OnApplicationBootstrap {
  private routes: (RouteInfo & { key: string })[] = [];
  private readonly observed = new Map<string, Observation>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap() {
    this.routes = this.discovery.getControllers().flatMap((wrapper) => {
      const controller = wrapper.metatype as Type | null;
      if (!controller) return [];
      return Object.getOwnPropertyNames(controller.prototype)
        .filter(
          (name) =>
            name !== 'constructor' &&
            Reflect.hasMetadata(
              METHOD_METADATA,
              controller.prototype[name] as object,
            ),
        )
        .map((name) => {
          const info = this.describeRoute(
            controller,
            controller.prototype[name] as (...args: unknown[]) => unknown,
          );
          return { ...info, key: info.handler };
        });
    });
  }

  /** Opt-in per browser: `?xray=1` or `?xray=0` flips the cookie, which then decides. */
  enabled(req: AnyRequest, res: AnyResponse): boolean {
    const query = (req as { query?: Record<string, unknown> }).query?.xray;
    if (query === '1' || query === '0') {
      this.remember(res, query === '1');
      return query === '1';
    }
    return readCookie(req, XRAY_COOKIE) === '1';
  }

  remember(res: AnyResponse, enabled: boolean) {
    if (enabled) {
      writeCookie(res, XRAY_COOKIE, '1', {
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        maxAge: 60 * 60 * 24 * 365,
      });
    } else {
      clearCookie(res, XRAY_COOKIE, { path: '/' });
    }
  }

  describeRoute(controller: Type, handler: (...args: unknown[]) => unknown) {
    const targets = [handler, controller];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as
      RequestMethod | undefined;
    const guards = [
      ...((Reflect.getMetadata(GUARDS_METADATA, controller) as unknown[]) ??
        []),
      ...((Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[]) ?? []),
    ];
    const args = (Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      controller,
      handler.name,
    ) ?? {}) as Record<string, { schema?: unknown }>;
    const body = Object.entries(args).find(([key]) =>
      key.startsWith(`${RouteParamtypes.BODY}:`),
    )?.[1];
    const shape = (body?.schema as { shape?: Record<string, unknown> })?.shape;

    return {
      handler: `${controller.name}#${handler.name}`,
      method: RequestMethod[method ?? RequestMethod.GET],
      path: this.pathOf(controller, handler),
      view:
        (this.reflector.get<string>(MVC_VIEW_METADATA, handler) as
          string | undefined) ?? null,
      ssr:
        this.reflector.getAllAndOverride<boolean>(MVC_SSR_METADATA, targets) ??
        false,
      encryptHistory:
        this.reflector.getAllAndOverride<boolean>(
          MVC_ENCRYPT_HISTORY_METADATA,
          targets,
        ) ?? false,
      public:
        this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets) ??
        false,
      roles:
        this.reflector.getAllAndOverride<string[]>(ROLES_KEY, targets) ?? [],
      skipCsrf:
        this.reflector.getAllAndOverride<boolean>(
          SKIP_CSRF_METADATA,
          targets,
        ) ?? false,
      signedUrl: guards.includes(SignedUrlGuard),
      schema: shape ? Object.keys(shape) : body?.schema ? [] : null,
    } satisfies RouteInfo;
  }

  /**
   * The props a handler returned, labelled by the helper that wraps them.
   * nestjs-mvc recognises helpers at any depth, so plain objects are walked.
   */
  describeProps(raw: Record<string, unknown>, prefix = ''): PropInfo[] {
    return Object.entries(raw).flatMap(([key, value]): PropInfo[] => {
      const path = prefix + key;
      if (value instanceof AlwaysProp) return [{ path, kind: 'always' }];
      if (value instanceof OptionalProp) return [{ path, kind: 'optional' }];
      if (value instanceof DeferProp)
        return [{ path, kind: 'defer', detail: `group ${value.group}` }];
      if (value instanceof ScrollProp)
        return [
          {
            path,
            kind: 'scroll',
            detail: value.deferGroup
              ? `${value.wrapper}, deferred`
              : value.wrapper,
          },
        ];
      if (value instanceof OnceProp)
        return [{ path, kind: 'once', detail: value.key }];
      if (value instanceof MergeProp)
        return [
          {
            path,
            kind: value.deep
              ? 'deep-merge'
              : value.prependRoot
                ? 'prepend'
                : 'merge',
            detail: value.matchOn.length
              ? `match on ${value.matchOn.join(', ')}`
              : undefined,
          },
        ];
      if (typeof value === 'function') return [{ path, kind: 'lazy' }];
      if (isPlainObject(value)) {
        const nested = this.describeProps(value, `${path}.`);
        if (nested.some((prop) => prop.kind !== 'eager')) return nested;
      }
      return [{ path, kind: 'eager' }];
    });
  }

  observe(handler: string, update: Partial<Omit<Observation, 'lastSeen'>>) {
    const previous = this.observed.get(handler);
    this.observed.set(handler, {
      props: update.props ?? previous?.props ?? [],
      flash: (update.flash ?? false) || (previous?.flash ?? false),
      lastSeen: Date.now(),
    });
  }

  /** Every route with what its metadata says and what X-ray saw it do. */
  catalog() {
    return this.routes.map(({ key, ...route }) => {
      const seen = this.observed.get(key);
      return {
        ...route,
        props: seen?.props ?? null,
        flash: seen?.flash ?? false,
        lastSeen: seen ? new Date(seen.lastSeen).toISOString() : null,
      };
    });
  }

  /** The routes of one controller, for "the forms on this page post to…". */
  siblings(controller: Type) {
    const prefix = `${controller.name}#`;
    return this.routes
      .filter((route) => route.key.startsWith(prefix) && !route.view)
      .map(({ key: _key, ...route }) => ({
        ...route,
        flash: this.observed.get(route.handler)?.flash ?? false,
      }));
  }

  private pathOf(controller: Type, handler: object) {
    const first = (value: unknown) =>
      (Array.isArray(value) ? value[0] : value) as string | undefined;
    const parts = [
      first(Reflect.getMetadata(PATH_METADATA, controller)),
      first(Reflect.getMetadata(PATH_METADATA, handler)),
    ]
      .map((part) => (part ?? '').replace(/^\/+|\/+$/g, ''))
      .filter(Boolean);
    return `/${parts.join('/')}`;
  }
}
