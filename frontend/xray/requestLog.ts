import { router } from 'nestjs-mvc/react';

export type RequestKind =
  | 'load'
  | 'visit'
  | 'partial'
  | 'poll'
  | 'deferred'
  | 'scroll'
  | 'prefetch'
  | 'cached'
  | 'mutation'
  | 'validate';

export interface RequestEntry {
  id: string;
  at: number;
  kind: RequestKind;
  method: string;
  url: string;
  only: string[];
  except: string[];
  ms: number | null;
  /** Bytes over the wire, from Resource Timing, when the browser reports them. */
  bytes: number | null;
  outcome: 'pending' | 'ok' | 'errors' | 'cancelled';
  /** For polls: the interval it settled into. */
  every?: number;
  /** For mutations: the error bag the form named. */
  errorBag?: string;
}

const MAX = 60;
let entries: RequestEntry[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function update(id: string, patch: Partial<RequestEntry>) {
  entries = entries.map((entry) =>
    entry.id === id ? { ...entry, ...patch } : entry,
  );
  emit();
}

function add(entry: RequestEntry) {
  entries = [entry, ...entries].slice(0, MAX);
  emit();
}

export const requestLog = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot: () => entries,
  clear() {
    entries = [];
    emit();
  },
};

/** When each poll last ran, to show its interval. */
const lastPoll = new Map<string, number>();

function classify(visit: {
  method: string;
  only: string[];
  except: string[];
  prefetch: boolean;
  headers: Record<string, string>;
  url: URL;
  deferredProps?: boolean;
  poll?: boolean;
}): Pick<RequestEntry, 'kind' | 'every'> {
  if (visit.method !== 'get') return { kind: 'mutation' };
  if (visit.prefetch) return { kind: 'prefetch' };
  if (visit.deferredProps) return { kind: 'deferred' };
  const headers = Object.keys(visit.headers).map((h) => h.toLowerCase());
  if (headers.includes('x-inertia-infinite-scroll-merge-intent'))
    return { kind: 'scroll' };
  // usePoll marks its reloads.
  if (visit.poll) {
    const key = `${visit.url.pathname}|${visit.only.join()}`;
    const now = performance.now();
    const previous = lastPoll.get(key);
    lastPoll.set(key, now);
    return {
      kind: 'poll',
      every: previous ? Math.round((now - previous) / 1000) : undefined,
    };
  }
  if (visit.only.length === 0 && visit.except.length === 0)
    return { kind: 'visit' };
  return { kind: 'partial' };
}

/** Bytes of the most recent fetch to this URL that started after `since`. */
function transferred(url: string, since: number): number | null {
  const timings = performance.getEntriesByName(
    url,
    'resource',
  ) as PerformanceResourceTiming[];
  const timing = timings.filter((t) => t.startTime >= since - 5).at(-1);
  if (!timing) return null;
  return timing.encodedBodySize || timing.transferSize || null;
}

let installed = false;

/** Starts listening to the router. Safe to call from every mount. */
export function installRequestLog(initialUrl: string) {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  add({
    id: 'initial',
    at: Date.now(),
    kind: 'load',
    method: 'get',
    url: initialUrl,
    only: [],
    except: [],
    ms: null,
    bytes: null,
    outcome: 'ok',
  });

  const started = new Map<string, number>();

  router.on('start', (event) => {
    const visit = event.detail.visit as typeof event.detail.visit & {
      id: string;
      deferredProps?: boolean;
      poll?: boolean;
      errorBag?: string | null;
    };
    started.set(visit.id, performance.now());
    add({
      id: visit.id,
      at: Date.now(),
      ...classify(visit),
      errorBag: visit.errorBag ?? undefined,
      method: visit.method,
      url: visit.url.pathname + visit.url.search,
      only: visit.only,
      except: visit.except,
      ms: null,
      bytes: null,
      outcome: 'pending',
    });
  });

  router.on('error', (event) => {
    if (event.detail.visitId)
      update(event.detail.visitId, { outcome: 'errors' });
  });

  router.on('finish', (event) => {
    const visit = event.detail.visit as typeof event.detail.visit & {
      id: string;
    };
    const start = started.get(visit.id);
    started.delete(visit.id);
    const entry = entries.find((e) => e.id === visit.id);
    update(visit.id, {
      ms: start === undefined ? null : Math.round(performance.now() - start),
      bytes: start === undefined ? null : transferred(visit.url.href, start),
      outcome: visit.cancelled
        ? 'cancelled'
        : entry?.outcome === 'errors'
          ? 'errors'
          : 'ok',
    });
  });

  // Precognition's validate-only requests go through laravel-precognition's
  // own fetch client, not the router; in this app the router uses XHR, so a
  // same-origin fetch is one of them. Resource Timing has no method or
  // headers, hence the inference.
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
      if (entry.initiatorType !== 'fetch') continue;
      const url = new URL(entry.name);
      if (url.origin !== location.origin) continue;
      add({
        id: `validate-${entry.startTime}`,
        at: Date.now(),
        kind: 'validate',
        method: 'fetch',
        url: url.pathname,
        only: [],
        except: [],
        ms: Math.round(entry.duration),
        bytes: entry.encodedBodySize || null,
        outcome: 'ok',
      });
    }
  }).observe({ type: 'resource' });

  // A click on a prefetched link: no request at all.
  router.on('navigate', (event) => {
    if (!event.detail.cached) return;
    add({
      id: `cached-${Date.now()}`,
      at: Date.now(),
      kind: 'cached',
      method: 'get',
      url: event.detail.page.url,
      only: [],
      except: [],
      ms: 0,
      bytes: 0,
      outcome: 'ok',
    });
  });
}
