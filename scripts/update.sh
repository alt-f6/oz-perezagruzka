#!/bin/sh
# Pulls the latest code, rebuilds and restarts the `app` service. Prisma
# migrations run automatically inside the container on startup (see
# docker-entrypoint.sh: `npx prisma migrate deploy` before the app CMD), so
# this script only pulls and restarts -- it does not run a second,
# host-side `prisma migrate deploy` (the host has no node_modules/DATABASE_URL
# guaranteed). It just reports whether the pulled commits touched
# prisma/migrations so you know a migration is about to run.
set -eu

APP_DIR="${APP_DIR:-/opt/app}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/app/docker-compose.prod.yml}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-main}"

cd "$APP_DIR"

BEFORE_SHA="$(git rev-parse HEAD)"

echo "==> Pulling $GIT_REMOTE/$GIT_BRANCH..."
git fetch "$GIT_REMOTE" "$GIT_BRANCH"
git merge --ff-only "$GIT_REMOTE/$GIT_BRANCH"

AFTER_SHA="$(git rev-parse HEAD)"

if [ "$BEFORE_SHA" = "$AFTER_SHA" ]; then
  echo "==> Already up to date ($AFTER_SHA)"
  exit 0
fi

if git diff --name-only "$BEFORE_SHA" "$AFTER_SHA" -- prisma/migrations | grep -q .; then
  echo "==> New Prisma migrations detected -- will run via docker-entrypoint.sh on container start"
fi

echo "==> Rebuilding and restarting app ($BEFORE_SHA -> $AFTER_SHA)..."
docker compose -f "$COMPOSE_FILE" up -d --build app

echo "==> Done."
