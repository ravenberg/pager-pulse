#!/usr/bin/env bash
# Puts the demo back to how it started: stops the app, removes the database
# and the uploaded files, and starts it again. On start, the app sees an
# empty database and seeds it, with incidents dated around today.
#
# cron runs it every night (see schedule-reset.sh). By hand:
#
#   ops/reset.sh
set -euo pipefail

APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP"

# Same settings as the app itself.
set -a
# shellcheck disable=SC1091
source .env
set +a
DATABASE_PATH="${DATABASE_PATH:-pager-pulse.sqlite}"
STORAGE_PATH="${STORAGE_PATH:-storage}"
PORT="${PORT:-3000}"

now() { date '+%Y-%m-%d %H:%M:%S'; }
answers() { curl -fsS -o /dev/null "http://127.0.0.1:$PORT/login" 2>/dev/null; }

echo "$(now) resetting the demo"

pm2 stop pager-pulse >/dev/null

# Wipe nothing while the old process still has the database open.
for _ in $(seq 1 30); do answers || break; sleep 1; done
if answers; then
  echo "$(now) the app is still running after pm2 stop; nothing was removed" >&2
  exit 1
fi

# SQLite keeps recent writes in -wal and -shm files next to the database.
rm -f "$DATABASE_PATH" "$DATABASE_PATH-wal" "$DATABASE_PATH-shm"
rm -rf "$STORAGE_PATH"

pm2 start pager-pulse >/dev/null

# Seeding happens before the app listens, so once the new database exists
# and the app answers, it's done.
for _ in $(seq 1 60); do
  if [ -f "$DATABASE_PATH" ] && answers; then
    echo "$(now) done, the demo is fresh"
    exit 0
  fi
  sleep 1
done

echo "$(now) the app didn't answer within a minute; see: pm2 logs pager-pulse" >&2
exit 1
