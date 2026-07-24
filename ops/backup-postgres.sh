#!/usr/bin/env bash
set -euo pipefail

: "${GREENLIGHT_DATABASE_URL:?GREENLIGHT_DATABASE_URL is required}"
BACKUP_DIR="${GREENLIGHT_BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
umask 077
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="${BACKUP_DIR}/greenlight-${STAMP}.dump"

pg_dump \
  --dbname="$GREENLIGHT_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$TARGET"

sha256sum "$TARGET" >"${TARGET}.sha256"
echo "backup-postgres: wrote encrypted-storage-ready backup $TARGET"
