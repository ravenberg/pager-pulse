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
  | 'mutation';

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
  /** Same URL and same props: how repeated partial reloads are recognised. */
  signature?: string;
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

/** When each partial-reload signature last ran, to tell a poll from a one-off reload. */
const lastRun = new Map<string, { at: number; gap: number | null }>();

function classify(visit: {
  method: string;
  only: string[];
  except: string[];
  prefetch: boolean;
  headers: Record<string, string>;
  url: URL;
  deferredProps?: boolean;
}): Pick<RequestEntry, 'kind' | 'every' | 'signature'> {
  if (visit.method !== 'get') return { kind: 'mutation' };
  if (visit.prefetch) return { kind: 'prefetch' };
  if (visit.deferredProps) return { kind: 'deferred' };
  const headers = Object.keys(visit.headers).map((h) => h.toLowerCase());
  if (headers.includes('x-inertia-infinite-scroll-merge-intent'))
    return { kind: 'scroll' };
  if (visit.only.length === 0 && visit.except.length === 0)
    return { kind: 'visit' };

  // The same partial reload at a steady interval is a poll.
  const signature = `${visit.url.pathname}|${visit.only.join()}|${visit.except.join()}`;
  const now = performance.now();
  const previous = lastRun.get(signature);
  const gap = previous ? now - previous.at : null;
  lastRun.set(signature, { at: now, gap });
  const steady =
    gap !== null &&
    previous?.gap != null &&
    Math.abs(gap - previous.gap) < previous.gap * 0.25;
  return steady
    ? { kind: 'poll', every: Math.round(gap / 1000), signature }
    : { kind: 'partial', signature };
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
    };
    started.set(visit.id, performance.now());
    const kind = classify(visit);
    // Once a poll is recognised, the reloads that led up to it were polls too.
    if (kind.kind === 'poll')
      entries = entries.map((entry) =>
        entry.kind === 'partial' && entry.signature === kind.signature
          ? { ...entry, kind: 'poll', every: kind.every }
          : entry,
      );
    add({
      id: visit.id,
      at: Date.now(),
      ...kind,
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
