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
  /** The part of the nestjs-mvc docs that explains it. */
  docs: string;
}

/** Where the nestjs-mvc docs live; X-ray links each feature to its page. */
export const DOCS_URL = 'https://nestjs-mvc.ravenberg.dev';
export const docsUrl = (path: string) => `${DOCS_URL}${path}`;

export const FEATURES: Record<FeatureKey, Feature> = {
  view: {
    title: 'Controller → page',
    code: "@View('$view')",
    blurb:
      'The handler returns plain props; nestjs-mvc hands them to the React page of that name. Its first load is HTML, every visit after it JSON.',
    group: 'Pages',
    color: 'gray',
    docs: '/docs/your-first-page#the-controller',
  },
  shared: {
    title: 'Shared data',
    code: 'requestState(req).shared',
    blurb:
      'Props every page gets, like the logged-in user and the open-incident badge, set once in middleware instead of in each handler.',
    group: 'Pages',
    color: 'gray',
    docs: '/docs/shared-data',
  },
  'auth-redirect': {
    title: 'Login redirect',
    code: 'this.view.intended("/")',
    blurb:
      "The guard's 401 becomes a redirect to /login; after logging in, intended() sends you back where you were going.",
    group: 'Security',
    color: 'grape',
    docs: '/docs/authentication#the-protected-page',
  },
  ssr: {
    title: 'Server-side rendering',
    code: '@Ssr()',
    blurb:
      'This route renders HTML on the server, for search engines, link previews and people without JavaScript. Other routes stay client-rendered.',
    group: 'Pages',
    color: 'teal',
    docs: '/docs/server-rendering',
  },
  'encrypt-history': {
    title: 'History encryption',
    code: 'this.view.encryptHistory()',
    blurb:
      'The page state saved in browser history is encrypted, per route with @EncryptHistory() or per request, like here for private incidents. When the user changes, nestjs-mvc clears history, so the back button cannot bring it back.',
    group: 'Security',
    color: 'grape',
    docs: '/docs/history-encryption#encrypt-the-history',
  },
  lazy: {
    title: 'Lazy prop',
    code: 'timeline: async () => …',
    blurb:
      'A closure instead of a value: it only runs when the prop is in the response, so a partial reload that leaves it out skips the query entirely.',
    group: 'Props',
    color: 'blue',
    docs: '/docs/your-first-page#props-that-do-some-work',
  },
  defer: {
    title: 'Deferred prop',
    code: 'defer(() => this.stats())',
    blurb:
      'Left out of the first response; the page paints and fetches it straight after, in one request per group.',
    group: 'Props',
    color: 'blue',
    docs: '/docs/loading-data#load-after-the-page-shows',
  },
  optional: {
    title: 'Optional prop',
    code: 'optional(() => …)',
    blurb:
      'Never sent unless the client asks for it by name in a partial reload, for a tab or a dialog that may never open.',
    group: 'Props',
    color: 'blue',
    docs: '/docs/loading-data#load-only-when-asked',
  },
  always: {
    title: 'Always prop',
    code: 'always(value)',
    blurb:
      "Sent with every response, partial reloads included, even when they didn't ask for it. The paging banner is shared this way, so any page's poll brings a new page along.",
    group: 'Props',
    color: 'blue',
    docs: '/docs/shared-data#data-that-must-stay-fresh',
  },
  merge: {
    title: 'Merge prop',
    code: 'merge(items, { matchOn: "id" })',
    blurb:
      'The client adds the new items to what it has instead of replacing the list; matchOn updates an item it already has in place.',
    group: 'Props',
    color: 'blue',
    docs: '/docs/merging-props#add-to-the-end',
  },
  prepend: {
    title: 'Prepend prop',
    code: "prepend(feed, { matchOn: 'id' })",
    blurb: 'Like merge, but new items go on top: a feed of newer entries.',
    group: 'Props',
    color: 'blue',
    docs: '/docs/merging-props#add-to-the-front',
  },
  'deep-merge': {
    title: 'Deep merge prop',
    code: 'deepMerge(value)',
    blurb: 'Merges objects and arrays recursively into what the client has.',
    group: 'Props',
    color: 'blue',
    docs: '/docs/merging-props#nested-objects',
  },
  scroll: {
    title: 'Infinite scroll',
    code: 'scroll(() => paginate(…))',
    blurb:
      'A paginated list the client extends page by page; the server sends the cursor, the client appends and keeps the URL in step.',
    group: 'Props',
    color: 'blue',
    docs: '/docs/infinite-scroll',
  },
  once: {
    title: 'Once prop',
    code: "once(() => users, { as: 'people' })",
    blurb:
      'Resolved once and remembered by the client across visits; the server skips the closure when the client says it already has it.',
    group: 'Props',
    color: 'blue',
    docs: '/docs/once',
  },
  validation: {
    title: 'Validation → errors',
    code: '@Body({ schema: DeclareSchema })',
    blurb:
      "A Zod schema on the body. When it fails, the user goes back to the form and the messages arrive as the page's errors prop.",
    group: 'Forms',
    color: 'orange',
    docs: '/docs/forms#the-controller',
  },
  'error-bag': {
    title: 'Error bags',
    code: "form.post(url, { errorBag: 'update' })",
    blurb:
      'Two forms on one page: each names a bag, and its validation messages come back under errors.<bag>, so they never show up in the other form.',
    group: 'Forms',
    color: 'orange',
    docs: '/docs/forms#two-forms-on-one-page',
  },
  flash: {
    title: 'Flash messages',
    code: "this.view.flash('success', …)",
    blurb:
      'A one-time message carried across the redirect in a signed cookie, without a session store.',
    group: 'Forms',
    color: 'orange',
    docs: '/docs/flash-messages',
  },
  'skip-csrf': {
    title: 'CSRF exemption',
    code: '@SkipCsrf()',
    blurb:
      'Pages are CSRF-protected without configuration; webhooks and bearer-token endpoints opt out.',
    group: 'Security',
    color: 'grape',
    docs: '/docs/csrf#webhooks-and-apis',
  },
  'signed-url': {
    title: 'Signed URLs',
    code: '@ValidSignature()',
    blurb:
      'Links that carry their own proof and expiry, like the unsubscribe link in every status email: no login, no table of tokens. Bound to a value (bind), a link dies when that value changes, which makes the confirmation link single-use.',
    group: 'Security',
    color: 'grape',
    docs: '/docs/signed-urls',
  },
  'partial-reload': {
    title: 'Partial reload',
    code: "router.reload({ only: ['timeline'] })",
    blurb:
      'The client asks for some props of the current page; the server runs the handler but resolves only those.',
    group: 'Client',
    color: 'cyan',
    docs: '/docs/loading-data#asking-for-props-by-name',
  },
  poll: {
    title: 'Polling',
    code: 'usePoll(5000, { only: […] })',
    blurb:
      'A partial reload on a timer: live data with no WebSocket and no separate API.',
    group: 'Client',
    color: 'cyan',
    docs: '/docs/loading-data#refresh-on-a-timer',
  },
  prefetch: {
    title: 'Prefetching',
    code: '<Link prefetch>',
    blurb:
      'The next page is fetched on hover, so the click shows it instantly from the cache.',
    group: 'Client',
    color: 'cyan',
    docs: '/docs/prefetching',
  },
  precognition: {
    title: 'Live validation',
    code: 'useForm(…).validate()',
    blurb:
      "Precognition: the form asks the server's own validation pipe about a field as you type, without running the handler.",
    group: 'Forms',
    color: 'orange',
    docs: '/docs/live-validation',
  },
};
