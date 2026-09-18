import { FEATURES, type FeatureKey } from './features';
import type { RequestEntry, RequestKind } from './requestLog';
import type { PropInfo, RouteInfo, RuntimeFeature, XrayReport } from './types';

/** A feature in use, with where it shows: prop paths, routes, requests. */
export interface Evidence {
  label: string;
  /** Top-level prop to highlight on the page. */
  prop?: string;
}

export type Found = Map<FeatureKey, Evidence[]>;

const add = (found: Found, key: FeatureKey, evidence?: Evidence) => {
  const list = found.get(key) ?? [];
  const known = list.some(
    (e) =>
      e.label === evidence?.label ||
      (evidence?.prop && e.prop === evidence.prop),
  );
  if (evidence && !known) list.push(evidence);
  found.set(key, list);
};

const routeLabel = (route: RouteInfo) => `${route.method} ${route.path}`;

/** What the server can tell about a route: its decorators and its props. */
function routeFeatures(
  route: RouteInfo,
  props: PropInfo[] | null,
  runtime: RuntimeFeature[],
  found: Found = new Map(),
): Found {
  if (route.view) {
    add(found, 'view', { label: route.view });
    add(found, 'shared');
  }
  if (!route.public) add(found, 'auth-redirect', { label: routeLabel(route) });
  if (route.ssr) add(found, 'ssr', { label: routeLabel(route) });
  if (route.encryptHistory)
    add(found, 'encrypt-history', { label: routeLabel(route) });
  if (route.skipCsrf) add(found, 'skip-csrf', { label: routeLabel(route) });
  if (route.signedUrl) add(found, 'signed-url', { label: routeLabel(route) });
  if (route.schema)
    add(found, 'validation', {
      label: `${routeLabel(route)} (${route.schema.join(', ')})`,
    });
  for (const feature of runtime)
    add(found, feature, { label: routeLabel(route) });
  for (const prop of props ?? []) {
    if (prop.kind === 'eager') continue;
    add(found, prop.kind, {
      label: prop.detail ? `${prop.path} · ${prop.detail}` : prop.path,
      prop: prop.path.split('.')[0],
    });
  }
  return found;
}

const CLIENT: Partial<Record<RequestKind, FeatureKey>> = {
  partial: 'partial-reload',
  poll: 'poll',
  prefetch: 'prefetch',
  cached: 'prefetch',
  deferred: 'defer',
  scroll: 'scroll',
  validate: 'precognition',
};

/** The requests since the page was entered: from its visit onwards. */
export function requestsOnPage(entries: RequestEntry[], url: string) {
  const path = url.split('?')[0];
  const arrival = entries.findIndex(
    (entry) =>
      ['load', 'visit', 'cached', 'mutation'].includes(entry.kind) &&
      entry.url.split('?')[0] === path,
  );
  return arrival === -1 ? [] : entries.slice(0, arrival + 1);
}

/** Everything the current page shows: the server's report plus its requests. */
export function pageFeatures(
  report: XrayReport,
  page: {
    encryptHistory?: boolean;
    clearHistory?: boolean;
    flash?: Record<string, unknown>;
  },
  requests: RequestEntry[],
): Found {
  const found: Found = new Map();
  add(found, 'view', { label: report.route.handler });
  routeFeatures(report.route, report.props, [], found);
  if (report.shared.length)
    add(found, 'shared', { label: report.shared.join(', ') });
  if (page.encryptHistory)
    add(found, 'encrypt-history', { label: 'this page' });
  if (page.clearHistory)
    add(found, 'encrypt-history', { label: 'history cleared' });
  if (page.flash && Object.keys(page.flash).length)
    add(found, 'flash', { label: 'this response' });
  // What the forms on this page post to. Behind the login like the page is,
  // so they are not listed again under the redirect.
  for (const action of report.actions)
    routeFeatures({ ...action, public: true }, null, action.runtime, found);

  for (const request of requests) {
    if (request.errorBag)
      add(found, 'error-bag', {
        label: `${request.errorBag}: ${request.method.toUpperCase()} ${request.url}`,
      });
    const key = CLIENT[request.kind];
    if (!key) continue;
    const props = [...request.only, ...request.except.map((p) => `−${p}`)];
    add(found, key, {
      label:
        request.kind === 'prefetch' || request.kind === 'cached'
          ? request.url
          : props.join(', ') || request.url,
      prop: request.only.length === 1 ? request.only[0] : undefined,
    });
  }
  return found;
}

/** In the order of the register, so the list reads the same on every page. */
export const ordered = (found: Found) =>
  (Object.keys(FEATURES) as FeatureKey[])
    .filter((key) => found.has(key))
    .map((key) => ({ key, feature: FEATURES[key], evidence: found.get(key)! }));
