/**
 * Every nestjs-mvc feature X-ray knows how to spot, with the one sentence it
 * shows about it. Which features a page uses is worked out from the server's
 * report and the requests the page makes, never written down per page.
 */
export type FeatureKey =
  | 'view'
  | 'shared'
  | 'auth-redirect'
  | 'ssr'
  | 'encrypt-history'
  | 'lazy'
  | 'defer'
  | 'optional'
  | 'always'
  | 'merge'
  | 'prepend'
  | 'deep-merge'
  | 'scroll'
  | 'once'
  | 'validation'
  | 'error-bag'
  | 'flash'
  | 'skip-csrf'
  | 'signed-url'
  | 'partial-reload'
  | 'poll'
  | 'prefetch'
  | 'precognition';

export type FeatureGroup = 'Pages' | 'Props' | 'Forms' | 'Security' | 'Client';

export interface Feature {
  title: string;
  /** How it looks in code; `$view` is the current page component. */
  code: string;
  blurb: string;
  group: FeatureGroup;
  color: string;
  /** Where in the roadmap it gets a page, while nothing uses it yet. */
  planned?: string;
}

export const FEATURES: Record<FeatureKey, Feature> = {
  view: {
    title: 'Controller → page',
    code: "@View('$view')",
    blurb:
      'The handler returns plain props; nestjs-mvc hands them to the React page of that name. Its first load is HTML, every visit after it JSON.',
    group: 'Pages',
    color: 'gray',
  },
  shared: {
    title: 'Shared data',
    code: 'requestState(req).shared',
    blurb:
      'Props every page gets, like the logged-in user and the open-incident badge, set once in middleware instead of in each handler.',
    group: 'Pages',
    color: 'gray',
  },
  'auth-redirect': {
    title: 'Login redirect',
    code: 'this.view.intended("/")',
    blurb:
      "The guard's 401 becomes a redirect to /login; after logging in, intended() sends you back where you were going.",
    group: 'Security',
    color: 'grape',
  },
  ssr: {
    title: 'Server-side rendering',
    code: '@Ssr()',
    blurb:
      'This route renders HTML on the server, for search engines, link previews and people without JavaScript. Other routes stay client-rendered.',
    group: 'Pages',
    color: 'teal',
  },
  'encrypt-history': {
    title: 'History encryption',
    code: '@EncryptHistory()',
    blurb:
      'The page state saved in browser history is encrypted, so after a logout the back button cannot show it again.',
    group: 'Security',
    color: 'grape',
    planned: 'Phase 3 · private incidents',
  },
  lazy: {
    title: 'Lazy prop',
    code: 'timeline: async () => …',
    blurb:
      'A closure instead of a value: it only runs when the prop is in the response, so a partial reload that leaves it out skips the query entirely.',
    group: 'Props',
    color: 'blue',
  },
  defer: {
    title: 'Deferred prop',
    code: 'defer(() => this.stats())',
    blurb:
      'Left out of the first response; the page paints and fetches it straight after, in one request per group.',
    group: 'Props',
    color: 'blue',
  },
  optional: {
    title: 'Optional prop',
    code: 'optional(() => …)',
    blurb:
      'Never sent unless the client asks for it by name in a partial reload, for a tab or a dialog that may never open.',
    group: 'Props',
    color: 'blue',
  },
  always: {
    title: 'Always prop',
    code: 'always(value)',
    blurb:
      "Sent with every response, partial reloads included, even when they didn't ask for it. The X-ray report itself travels this way.",
    group: 'Props',
    color: 'blue',
    planned: "Used by X-ray's own report",
  },
  merge: {
    title: 'Merge prop',
    code: 'merge(items, { matchOn: "id" })',
    blurb:
      'The client adds the new items to what it has instead of replacing the list; matchOn updates an item it already has in place.',
    group: 'Props',
    color: 'blue',
  },
  prepend: {
    title: 'Prepend prop',
    code: "prepend(feed, { matchOn: 'id' })",
    blurb: 'Like merge, but new items go on top: a feed of newer entries.',
    group: 'Props',
    color: 'blue',
  },
  'deep-merge': {
    title: 'Deep merge prop',
    code: 'deepMerge(value)',
    blurb: 'Merges objects and arrays recursively into what the client has.',
    group: 'Props',
    color: 'blue',
  },
  scroll: {
    title: 'Infinite scroll',
    code: 'scroll(() => paginate(…))',
    blurb:
      'A paginated list the client extends page by page; the server sends the cursor, the client appends and keeps the URL in step.',
    group: 'Props',
    color: 'blue',
  },
  once: {
    title: 'Once prop',
    code: 'once(() => users)',
    blurb:
      'Resolved once and remembered by the client across visits; the server skips the closure when the client says it already has it.',
    group: 'Props',
    color: 'blue',
    planned: 'Phase 6 · shared lookups',
  },
  validation: {
    title: 'Validation → errors',
    code: '@Body({ schema: DeclareSchema })',
    blurb:
      "A Zod schema on the body. When it fails, the user goes back to the form and the messages arrive as the page's errors prop.",
    group: 'Forms',
    color: 'orange',
  },
  'error-bag': {
    title: 'Error bags',
    code: "form.post(url, { errorBag: 'update' })",
    blurb:
      'Two forms on one page: each names a bag, and its validation messages come back under errors.<bag>, so they never show up in the other form.',
    group: 'Forms',
    color: 'orange',
  },
  flash: {
    title: 'Flash messages',
    code: "this.view.flash('success', …)",
    blurb:
      'A one-time message carried across the redirect in a signed cookie, without a session store.',
    group: 'Forms',
    color: 'orange',
  },
  'skip-csrf': {
    title: 'CSRF exemption',
    code: '@SkipCsrf()',
    blurb:
      'Pages are CSRF-protected without configuration; webhooks and bearer-token endpoints opt out.',
    group: 'Security',
    color: 'grape',
  },
  'signed-url': {
    title: 'Signed URLs',
    code: '@ValidSignature()',
    blurb:
      'Links that carry their own proof and expiry, for confirm or unsubscribe links, without a table of tokens.',
    group: 'Security',
    color: 'grape',
    planned: 'Phase 5 · status subscriptions',
  },
  'partial-reload': {
    title: 'Partial reload',
    code: "router.reload({ only: ['timeline'] })",
    blurb:
      'The client asks for some props of the current page; the server runs the handler but resolves only those.',
    group: 'Client',
    color: 'cyan',
  },
  poll: {
    title: 'Polling',
    code: 'usePoll(5000, { only: […] })',
    blurb:
      'A partial reload on a timer: live data with no WebSocket and no separate API.',
    group: 'Client',
    color: 'cyan',
  },
  prefetch: {
    title: 'Prefetching',
    code: '<Link prefetch>',
    blurb:
      'The next page is fetched on hover, so the click shows it instantly from the cache.',
    group: 'Client',
    color: 'cyan',
    planned: 'Phase 6 · incident list',
  },
  precognition: {
    title: 'Live validation',
    code: 'useForm(…).validate()',
    blurb:
      "Precognition: the form asks the server's own validation pipe about a field as you type, without running the handler.",
    group: 'Forms',
    color: 'orange',
    planned: 'Phase 3 · post-mortem form',
  },
};

export const KITCHEN_SINK =
  'https://github.com/ravenberg/nestjs-mvc/tree/main/apps/kitchen-sink';
