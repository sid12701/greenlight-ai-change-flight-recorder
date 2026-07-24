#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BLNK_SOURCE="${BLNK_SOURCE_PATH:-${ROOT}/.workloads/blnk}"
BLNK_PORT="${BLNK_PORT:-18081}"

fail() {
  echo "preflight: error: $*" >&2
  exit 1
}

pass() {
  echo "preflight: ok: $*"
}

for command in node npm git curl docker openssl; do
  command -v "$command" >/dev/null 2>&1 ||
    fail "Required command is missing: $command"
done
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required"
docker info >/dev/null 2>&1 || fail "Docker daemon is not reachable"

NODE_MAJOR="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
[[ "$NODE_MAJOR" == "24" ]] ||
  fail "Node 24 LTS is required; found $(node --version)"
pass "Host tools: Node $(node --version), npm $(npm --version), Git $(git --version | awk '{print $3}')"

if [[ -d "${BLNK_SOURCE}/.git" ]]; then
  BLNK_SOURCE_PATH="$BLNK_SOURCE" bash "${ROOT}/integrations/blnk/fetch.sh" --verify
  pass "Public Blnk v0.15.1 source pin and approved patch verified"
else
  pass "Public Blnk source is not cached; integrations/blnk/up.sh will fetch the exact release"
fi

BLNK_DEMO_KEY=preflight-only \
  docker compose -f "${ROOT}/integrations/blnk/compose.yaml" config --quiet
pass "Blnk Compose model resolves with required secret injection"

if command -v lsof >/dev/null 2>&1 &&
  lsof -nP -iTCP:"$BLNK_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  if curl --fail --silent "http://127.0.0.1:${BLNK_PORT}/health" >/dev/null 2>&1; then
    pass "Blnk workload is already healthy on loopback port ${BLNK_PORT}"
  else
    fail "loopback port ${BLNK_PORT} is occupied by another process"
  fi
else
  pass "Blnk loopback port ${BLNK_PORT} is free"
fi

if curl --fail --silent --max-time 2 http://127.0.0.1:4318/ >/dev/null 2>&1 ||
  lsof -nP -iTCP:4318 -sTCP:LISTEN >/dev/null 2>&1; then
  pass "SigNoz OTLP HTTP receiver is reachable on port 4318"
else
  fail "SigNoz OTLP HTTP receiver is not listening on port 4318"
fi

pass "No private LMS checkout or credentials are required"
pass "GreenLight root ${ROOT}"
echo "preflight: all checks passed"
