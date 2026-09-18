/** Mirrors what src/xray sends. */
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
  detail?: string;
}

export interface RouteInfo {
  handler: string;
  method: string;
  path: string;
  view: string | null;
  ssr: boolean;
  encryptHistory: boolean;
  public: boolean;
  roles: string[];
  skipCsrf: boolean;
  signedUrl: boolean;
  schema: string[] | null;
}

export interface XrayReport {
  route: RouteInfo;
  props: PropInfo[];
  shared: string[];
  actions: (RouteInfo & { flash: boolean })[];
  request: {
    inertia: boolean;
    prefetch: boolean;
    partial: string[];
    except: string[];
    reset: string[];
    exceptOnce: string[];
    ssr: boolean;
    handlerMs: number;
  };
}

export interface CatalogRoute extends RouteInfo {
  /** Null until the route has run since the server started. */
  props: PropInfo[] | null;
  flash: boolean;
  lastSeen: string | null;
}
