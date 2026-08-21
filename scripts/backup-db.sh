#!/bin/sh
# Dumps the `db` compose service to a timestamped, gzip-compressed file and
# prunes backups older than $RETENTION_DAYS. Intended to run via cron on the
# host (see deployment guide) -- not inside a container, so it works even if
# the app container is down.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/opt/app/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/app/docker-compose.prod.yml}"
POSTGRES_USER="${POSTGRES_USER:-app}"
POSTGRES_DB="${POSTGRES_DB:-app}"

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$BACKUP_DIR/${POSTGRES_DB}_${STAMP}.sql.gz"

docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$OUT_FILE"

find "$BACKUP_DIR" -name "${POSTGRES_DB}_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

echo "Backup written to $OUT_FILE"
