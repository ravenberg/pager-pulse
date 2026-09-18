# PagerPulse

A demo app for [nestjs-mvc](https://nestjs-mvc.ravenberg.dev), the package that
lets NestJS controllers return React or Vue pages as their views.

PagerPulse is a small incident management tool: declare incidents, page
whoever is on call, write post-mortems, keep a public status page. It's here so
you can see what building with nestjs-mvc looks like beyond a hello world.
Click around to see how it feels, then open the code to see how it's done.

## Try it

```sh
git clone https://github.com/ravenberg/pager-pulse.git
cd pager-pulse
npm install
npm run start:dev
```

Open http://localhost:3000 and log in. Every account's password is `password`:

| Email | Role |
|---|---|
| `ada@pagerpulse.dev` | admin, can do everything |
| `grace@pagerpulse.dev` | responder, works on incidents |
| `barbara@pagerpulse.dev` | viewer, can only look |

The first start creates a SQLite database with a few months of made up
incidents, alerts and schedules. `npm run db:reset` deletes it, so the next
start seeds a fresh one. You need Node 20.19+, 22.12+ or 24+.

While you click around:

* Press **Shift+X** to open X-ray. For the page you're on, it shows which
  nestjs-mvc features it uses, which props the controller sent, and every
  request the page makes, with a link to the docs for each feature.
* Run `npm run alerts:demo` in a second terminal. It sends alerts the way a
  monitoring tool would, and the alerts page picks them up while you watch.
* Press Cmd+K (or Ctrl+K) to search.

## Where to look

It's a regular NestJS app: modules, controllers, services, guards and pipes, with
TypeORM. What nestjs-mvc changes is that a controller method has `@View()` and
returns props, and a React component in `frontend/pages` renders them.

A good first read is `src/incidents/incidents.controller.ts` with
`frontend/pages/Incidents/Show.tsx`, the incident page. It uses most of what
nestjs-mvc has.

To find a particular feature:

| To see | Look at |
|---|---|
| A controller that renders pages | `src/incidents/incidents.controller.ts` |
| Forms, validation with Zod, and errors on the right field | `src/incidents/incidents.schemas.ts`, `frontend/pages/Incidents/Create.tsx` |
| Two forms on one page (error bags) | `frontend/pages/Incidents/Show.tsx`, `frontend/pages/Account/Edit.tsx` |
| Validating while you type | `src/post-mortems/post-mortems.controller.ts`, `frontend/pages/PostMortems/Edit.tsx` |
| Logging in, roles, and data only some users may see | `src/auth/`, `src/incidents/incidents.service.ts` (`visibleWhere`) |
| Data every page gets (the user, counters) | `src/shared-data.middleware.ts` |
| Slow data after the page shows (`defer()`), and a widget that may fail | `src/dashboard/dashboard.controller.ts` |
| Tabs that load only when opened (`optional()`) | `src/incidents/incidents.controller.ts` (`show`) |
| Loading a card when it scrolls into view | `frontend/pages/Incidents/Show.tsx` (`WhenVisible`) |
| Lists the browser keeps between pages (`once()`), refreshed after a change | `src/common/lookups.ts`, `src/catalog/catalog.controller.ts` |
| A live feed (polling, with `prepend()` and `deepMerge()`) | `src/alerts/alerts.controller.ts`, `frontend/pages/Alerts/Index.tsx` |
| Infinite scroll, saved views and remembered columns | `frontend/pages/Incidents/Index.tsx` |
| Changing the page before the server answers | `frontend/components/IncidentBoard.tsx` |
| JSON for a search box (`useHttp`) | `src/search/search.controller.ts`, `frontend/components/CommandPalette.tsx` |
| File uploads and downloads | `src/attachments/` |
| Server rendering, for guests only | `src/status/status.controller.ts` |
| Signed links: invitations that work once | `src/people/` |
| A webhook without CSRF protection | `src/alerts/alert-ingest.controller.ts` |
| Leaving for another site (`view.location()`) | `src/incidents/incidents.controller.ts` (`call`) |
| Testing pages end to end | `test/app.e2e-spec.ts` |

`src/xray` and `frontend/xray` are the X-ray overlay. That's tooling for this
demo, not something a normal app needs, so you can skip them while reading.

The [nestjs-mvc docs](https://nestjs-mvc.ravenberg.dev) explain each of these
features on its own.

## Checks

```sh
npm run lint
npm run typecheck
npm test           # unit tests
npm run test:e2e   # the whole app, against an in-memory database
```

## Running it on a server

The live demo runs on Ubuntu with pm2 and Caddy, and starts over with fresh
data every night. Everything for that is in `ops/`.

You need Node, pm2 (`npm install -g pm2`), Caddy, and `build-essential` and
`python3` in case `better-sqlite3` has to be compiled.

```sh
git clone https://github.com/ravenberg/pager-pulse.git ~/pager-pulse
cd ~/pager-pulse
cp .env.example .env   # fill in APP_KEY
ops/deploy.sh
pm2 startup            # once, so pm2 starts again after a reboot
```

Then let Caddy forward your domain to the port in `.env`:

```text
pagerpulse.example.com {
	reverse_proxy 127.0.0.1:3002
}
```

What the scripts do:

* `ops/deploy.sh` pulls, installs, builds, restarts the app with pm2, and
  schedules the nightly reset. Run it again for every update.
* `ops/reset.sh` stops the app, deletes the database and the uploaded files,
  and starts the app again, which seeds new data. Cron runs it every night at
  04:00; `ops/schedule-reset.sh` sets that up (`RESET_AT="30 3 * * *"` for
  another time). It logs to `data/reset.log`.

The settings in `.env`:

| Variable | What it's for |
|---|---|
| `APP_KEY` | Signs cookies, links and the login token. Required in production. |
| `PORT` | The port the app listens on. |
| `DATABASE_PATH`, `STORAGE_PATH` | Where the database and uploads are kept. |
