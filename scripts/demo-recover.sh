#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/.workloads/blnk.env"
COMPOSE_FILE="${ROOT}/integrations/blnk/compose.yaml"
BASE_URL="http://127.0.0.1:${BLNK_PORT:-18081}"

[[ -f "$ENV_FILE" ]] || {
  echo "demo-recover: run scripts/demo-baseline.sh first" >&2
  exit 1
}

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" start postgres >/dev/null
for _ in $(seq 1 60); do
  if curl --fail --silent "${BASE_URL}/health" >/dev/null; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
    BLNK_BASE_URL="$BASE_URL" node "${ROOT}/integrations/blnk/load.mjs" \
      --profile healthy \
      --requests "${GREENLIGHT_LOAD_TARGET:-250}" \
      --concurrency "${GREENLIGHT_LOAD_CONCURRENCY:-5}" \
      --duration-seconds "${GREENLIGHT_LOAD_SECONDS:-90}"
    echo "demo-recover: database and healthy traffic recovered"
    exit 0
  fi
  sleep 1
done

echo "demo-recover: Blnk health did not recover" >&2
exit 1
