#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT}/.workloads/blnk.env"
COMPOSE_FILE="${ROOT}/integrations/blnk/compose.yaml"
BASE_URL="http://127.0.0.1:${BLNK_PORT:-18081}"

[[ -f "$ENV_FILE" ]] || {
  echo "blnk-failure-cycle: run integrations/blnk/up.sh first" >&2
  exit 1
}

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

recover_postgres() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" start postgres >/dev/null
}
trap recover_postgres EXIT

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" stop postgres
for _ in $(seq 1 20); do
  if ! curl --fail --silent "${BASE_URL}/health" >/dev/null; then
    break
  fi
  sleep 1
done

BLNK_BASE_URL="$BASE_URL" node "${ROOT}/integrations/blnk/load.mjs" \
  --profile outage --requests 40 --concurrency 4 --duration-seconds 30

recover_postgres
for _ in $(seq 1 60); do
  if curl --fail --silent "${BASE_URL}/health" >/dev/null; then
    BLNK_BASE_URL="$BASE_URL" node "${ROOT}/integrations/blnk/load.mjs" \
      --profile healthy --requests 60 --concurrency 4 --duration-seconds 30
    trap - EXIT
    echo "blnk-failure-cycle: dependency outage observed and recovery verified"
    exit 0
  fi
  sleep 1
done

echo "blnk-failure-cycle: PostgreSQL recovery did not restore health" >&2
exit 1
