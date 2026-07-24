#!/usr/bin/env bash
set -euo pipefail

: "${GREENLIGHT_RESTORE_DATABASE_URL:?GREENLIGHT_RESTORE_DATABASE_URL is required}"
: "${GREENLIGHT_RESTORE_PHRASE:?Set GREENLIGHT_RESTORE_PHRASE=RESTORE-GREENLIGHT}"

if [[ "$GREENLIGHT_RESTORE_PHRASE" != "RESTORE-GREENLIGHT" ]]; then
  echo "restore-postgres: confirmation phrase mismatch" >&2
  exit 1
fi

BACKUP_PATH="${1:-}"
if [[ -z "$BACKUP_PATH" || ! -f "$BACKUP_PATH" || ! -f "${BACKUP_PATH}.sha256" ]]; then
  echo "usage: $0 /path/to/greenlight.dump (with adjacent .sha256)" >&2
  exit 1
fi

sha256sum --check "${BACKUP_PATH}.sha256"
pg_restore \
  --dbname="$GREENLIGHT_RESTORE_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "$BACKUP_PATH"

psql "$GREENLIGHT_RESTORE_DATABASE_URL" \
  --set=ON_ERROR_STOP=1 \
  --command="SELECT COUNT(*) AS schema_migrations FROM schema_migrations;"
echo "restore-postgres: isolated restore completed and schema was verified"
