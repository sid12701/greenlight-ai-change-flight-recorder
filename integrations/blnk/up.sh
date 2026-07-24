#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT}/.workloads/blnk.env"
COMPOSE_FILE="${ROOT}/integrations/blnk/compose.yaml"

fail() {
  echo "blnk-up: error: $*" >&2
  exit 1
}

command -v docker >/dev/null || fail "Docker is required"
command -v openssl >/dev/null || fail "OpenSSL is required"
"${ROOT}/integrations/blnk/fetch.sh"

if [[ ! -f "$ENV_FILE" ]]; then
  umask 077
  printf 'BLNK_DEMO_KEY=%s\n' "$(openssl rand -hex 32)" >"$ENV_FILE"
fi
chmod 600 "$ENV_FILE"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up --detach --build
for _ in $(seq 1 60); do
  if curl --fail --silent "http://127.0.0.1:${BLNK_PORT:-18081}/health" >/dev/null; then
    BLNK_BASE_URL="http://127.0.0.1:${BLNK_PORT:-18081}" \
      node "${ROOT}/integrations/blnk/seed.mjs"
    echo "blnk-up: workload healthy and seeded at http://127.0.0.1:${BLNK_PORT:-18081}"
    exit 0
  fi
  sleep 2
done

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail 100 server
fail "server did not become healthy"
