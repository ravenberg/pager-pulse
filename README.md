# PagerPulse

An incident management app in the spirit of incident.io, built with
[NestJS](https://nestjs.com) and [nestjs-mvc](https://nestjs-mvc.ravenberg.dev):
the controllers return pages, and React renders them. There is no API in
between.

It is a real app rather than a demo page per feature, but it does use every
part of nestjs-mvc somewhere, and it can show you where. Turn on **X-ray** and
each page lists the features it uses, the props it received and the requests
it made, with a link to the part of the docs that explains each one.

## What's in it

* **Dashboard.** Active incidents as a board you can drag cards across, who's on
  call, your follow-ups, the status of the tools you depend on, and insights
  over 30, 90 or 180 days.
* **Incidents.** Declare, update and resolve them. Each incident has a timeline,
  follow-ups, alerts, attachments, a video call and similar past incidents.
  Private incidents are only visible to admins, the reporter and the lead.
* **Post-mortems.** Write them after an incident, review them, and publish them.
  A published one appears on the status page.
* **Alerts.** An inbox of alerts that monitoring tools send in with a token. You
  can declare an incident from an alert.
* **On-call.** Schedules with overrides, and escalation paths that page the
  next person when nobody answers.
* **Status page.** A public page with the current status, a calendar of past
  incidents and email subscriptions.
* **Catalog.** Services and the teams that own them.
* **People.** Admins add people, share a one-time link with them to set a
  password, change roles and deactivate accounts.
* **Search.** Press Cmd+K (or Ctrl+K) anywhere.

## Run it locally

You need Node 20.19+, 22.12+ or 24+.

```sh
npm install
npm run start:dev
```

Open http://localhost:3000. Vite runs inside the Nest process, so this one
command is all you need. On the first start the app creates
`pager-pulse.sqlite` and fills it with demo data.

Everyone's password is `password`:

| Email | Role |
|---|---|
| `ada@pagerpulse.dev` | admin |
| `grace@pagerpulse.dev` | responder |
| `linus@pagerpulse.dev` | responder |
| `barbara@pagerpulse.dev` | viewer |

Some things to try:

* Press **Shift+X** to turn X-ray on or off (or add `?xray=1` to a URL).
* Run `npm run alerts:demo` to have a monitoring tool fire alerts into the
  inbox.
* Log in as Barbara to see what a viewer can and can't do.

To start over with fresh demo data, stop the dev server, run
`npm run db:reset`, and start it again.

## Checks

```sh
npm run lint
npm run typecheck
npm test            # unit tests
npm run test:e2e    # the whole app against an in-memory database
```

## How it's organised

```text
src/                  the Nest app, one folder per area
  incidents/          controllers, services and serializers
  database/           entities, and the seeder that fills an empty database
  xray/               the X-ray report, added to every page when it's on
frontend/
  pages/              one component per page; @View('Incidents/Show') renders
                      frontend/pages/Incidents/Show.tsx
  components/         shared React components (Mantine)
  xray/               the X-ray overlay
test/app.e2e-spec.ts  end to end tests with a small test browser
ops/                  deploying, and the nightly reset of the demo
```

## Configuration

Settings come from environment variables. In production they're read from a
`.env` file (see `.env.example`).

| Variable | Default | What it's for |
|---|---|---|
| `APP_KEY` | a fixed key in development | Signs cookies, flash messages and links. Required in production. |
| `JWT_SECRET` | a fixed secret in development | Signs the login token. Required in production. |
| `APP_URL` | `http://localhost:$PORT` | The public address, for absolute links in emails and invitations. |
| `PORT` | `3000` | The port to listen on. |
| `DATABASE_PATH` | `pager-pulse.sqlite` | The SQLite database file. |
| `STORAGE_PATH` | `storage` | Where attachments are kept. |
| `MAIL_URL` | not set | SMTP server for status emails, such as `smtp://user:pass@host:587`. Without it, emails are written to the log. |
| `MAIL_FROM` | `PagerPulse <status@pagerpulse.dev>` | The sender of those emails. |
| `GIT_COMMIT` | set by `ops/deploy.sh` | The build's version, so open tabs reload after a deploy. |

## Deploy

PagerPulse runs as one Node process, kept alive by pm2, behind Caddy. The
database is a SQLite file, so there is nothing else to set up.

### Once, on the server

You need Node (20.19+, 22.12+ or 24+), pm2 (`npm install -g pm2`), Caddy, and
the tools to build `better-sqlite3` if no prebuilt binary matches your system
(`sudo apt install build-essential python3`).

```sh
git clone https://github.com/ravenberg/pager-pulse.git ~/pager-pulse
cd ~/pager-pulse
cp .env.example .env    # fill in APP_KEY, JWT_SECRET and APP_URL
ops/deploy.sh
pm2 startup             # once: start pm2, and so the app, after a reboot
```

`ops/deploy.sh` installs, builds, starts the app with pm2 and schedules the
nightly reset. Then point Caddy at the port from `.env`:

```text
# /etc/caddy/Caddyfile
pagerpulse.example.com {
	reverse_proxy 127.0.0.1:3002
}
```

```sh
sudo systemctl reload caddy
```

Caddy takes care of HTTPS. The app trusts the proxy in production, so secure
cookies and redirects work as expected.

### Updating

```sh
~/pager-pulse/ops/deploy.sh
```

It pulls, installs, builds and restarts. Running it again is always safe.

### The nightly reset

Visitors can change everything in the demo, so it starts over every night.
`ops/reset.sh` stops the app, removes the database and the uploaded files, and
starts the app again, which then seeds a fresh database with incidents around
that day. It takes a few seconds.

`ops/deploy.sh` puts it in your crontab for 04:00 server time, through
`ops/schedule-reset.sh`. To pick another time:

```sh
RESET_AT="30 3 * * *" ops/schedule-reset.sh
```

To reset right now, run `ops/reset.sh`. Each run is logged in `data/reset.log`.

If the app doesn't stop, the reset removes nothing and exits with an error, so
it never deletes the database from under a running app.

### Where things are

* The database and the uploads live in `data/` (set in `.env`), which is not in
  git.
* The app's own log: `pm2 logs pager-pulse`.
* The reset log: `data/reset.log`.
