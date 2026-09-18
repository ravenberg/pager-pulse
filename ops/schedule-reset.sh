#!/usr/bin/env bash
# Puts the nightly demo reset in this user's crontab, or updates it. Safe to
# run again: it replaces its own line and leaves the rest of the crontab alone.
#
#   ops/schedule-reset.sh            # every night at 04:00
#   RESET_AT="30 3 * * *" ops/schedule-reset.sh
set -euo pipefail

APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WHEN="${RESET_AT:-0 4 * * *}"
MARK="# pager-pulse nightly reset"

# cron starts with an almost empty PATH, so hand it the one that finds node
# and pm2 now (nvm and friends put them in your home directory).
NODE_BIN="$(dirname "$(command -v node)")"
PM2_BIN="$(dirname "$(command -v pm2)")"
LINE="$WHEN PATH=$NODE_BIN:$PM2_BIN:/usr/local/bin:/usr/bin:/bin $APP/ops/reset.sh >> $APP/data/reset.log 2>&1 $MARK"

{ crontab -l 2>/dev/null | grep -vF "$MARK" || true; echo "$LINE"; } | crontab -
echo "Scheduled: $WHEN (log in $APP/data/reset.log)"
