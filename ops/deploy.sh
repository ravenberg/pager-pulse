#!/usr/bin/env bash
# Pulls the latest code, builds PagerPulse and (re)starts it with pm2, and
# makes sure the nightly demo reset is scheduled. Run it on the server from
# anywhere:
#
#   ~/pager-pulse/ops/deploy.sh
set -euo pipefail

APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP"

if [ ! -f .env ]; then
  echo "Missing $APP/.env. Copy .env.example to .env and fill in APP_KEY first." >&2
  exit 1
fi

echo "→ git pull"
git pull --ff-only

echo "→ npm ci"
npm ci

echo "→ build"
npm run build

# The database and uploads live here (see DATABASE_PATH and STORAGE_PATH).
mkdir -p data

echo "→ restart with pm2"
# Starts the app when pm2 doesn't know it yet, restarts it otherwise. The
# commit is the app's version, so tabs that are still open reload on their
# next click and get the new code.
GIT_COMMIT="$(git rev-parse --short HEAD)" pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save

echo "→ schedule the nightly reset"
"$APP/ops/schedule-reset.sh"

echo "✓ Deployed $(git log -1 --format='%h %s')"
