#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BLNK_SOURCE="${BLNK_SOURCE_PATH:-${ROOT}/.workloads/blnk}"
BLNK_PORT="${BLNK_PORT:-18081}"
MODE="${1:-runtime}"

fail() {
  echo "preflight: error: $*" >&2
  exit 1
}

pass() {
  echo "preflight: ok: $*"
}

[[ "$MODE" == "runtime" || "$MODE" == "--bootstrap" ]] ||
  fail "usage: scripts/preflight.sh [--bootstrap]"

for command in node npm git curl docker openssl foundryctl; do
  command -v "$command" >/dev/null 2>&1 ||
    fail "Required command is missing: ${command}"
done
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required"
docker info >/dev/null 2>&1 ||
  fail "Docker daemon is not reachable; start Docker Desktop/Engine and rerun"

NODE_MAJOR="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
[[ "$NODE_MAJOR" == "24" ]] ||
  fail "Node 24 is required; found $(node --version). Run 'nvm install 24 && nvm use 24', then rerun"

EXPECTED_FOUNDRY_VERSION="$(cat "${ROOT}/deploy/foundry.version")"
FOUNDRY_VERSION_OUTPUT="$(foundryctl version 2>&1)"
grep -q "Version:  ${EXPECTED_FOUNDRY_VERSION}" <<<"$FOUNDRY_VERSION_OUTPUT" ||
  fail "foundryctl ${EXPECTED_FOUNDRY_VERSION} is required; follow https://signoz.io/docs/install/docker/"

pass "Node $(node --version), npm $(npm --version), Docker $(docker --version | awk '{print $3}' | tr -d ','), Foundry ${EXPECTED_FOUNDRY_VERSION}"

node "${ROOT}/scripts/demo-config.mjs" template "${ROOT}/.env.demo"
node "${ROOT}/scripts/signoz-stack.mjs"

if [[ -d "${BLNK_SOURCE}/.git" ]]; then
  BLNK_SOURCE_PATH="$BLNK_SOURCE" bash "${ROOT}/integrations/blnk/fetch.sh" --verify
  pass "Public Blnk v0.15.1 source pin and approved patch verified"
else
  pass "Public Blnk source is not cached; demo bootstrap will fetch the exact release"
fi

BLNK_DEMO_KEY=preflight-only \
  docker compose -f "${ROOT}/integrations/blnk/compose.yaml" config --quiet
pass "Blnk Compose model resolves with required secret injection"

check_port() {
  local port="$1"
  local health_url="$2"
  local service="$3"
  local expected_container="${4:-}"
  if ! command -v lsof >/dev/null 2>&1 ||
    ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    pass "loopback port ${port} is free for ${service}"
    return
  fi
  if [[ -n "$health_url" ]] &&
    curl --fail --silent --max-time 2 "$health_url" >/dev/null 2>&1; then
    if [[ -n "$expected_container" ]] &&
      ! docker ps -a --format '{{.Names}}' | grep -qx "$expected_container"; then
      fail "${service} port ${port} is held by a non-bootstrap process; stop it and rerun"
    fi
    pass "${service} is already healthy on loopback port ${port}"
    return
  fi
  if [[ -n "$expected_container" ]] &&
    docker ps -a --format '{{.Names}}' | grep -qx "$expected_container"; then
    pass "${service} is managed by ${expected_container}; bootstrap will reconcile its health"
    return
  fi
  fail "loopback port ${port} is occupied by another process; stop it before bootstrap"
}

check_port 8080 "http://127.0.0.1:8080/api/v1/health" "SigNoz" "signoz-signoz-0"
check_port 8000 "http://127.0.0.1:8000/livez" "SigNoz MCP" "signoz-mcp"
check_port "$BLNK_PORT" "http://127.0.0.1:${BLNK_PORT}/health" "Blnk" "greenlight-blnk-server-1"
check_port 4000 "http://127.0.0.1:4000/livez" "GreenLight API" "greenlight-api-1"
check_port 4173 "http://127.0.0.1:4173/healthz" "GreenLight Web" "greenlight-web-1"

if command -v lsof >/dev/null 2>&1 &&
  lsof -nP -iTCP:4318 -sTCP:LISTEN >/dev/null 2>&1; then
  docker ps --filter publish=4318 --format '{{.Names}}' |
    grep -q '^signoz-ingester-1$' ||
    fail "port 4318 is occupied by a process other than the expected SigNoz collector"
  pass "SigNoz OTLP HTTP receiver owns loopback port 4318"
else
  pass "loopback port 4318 is free for SigNoz OTLP"
fi

if [[ "$MODE" == "runtime" ]]; then
  for url in \
    http://127.0.0.1:8080/api/v1/health \
    http://127.0.0.1:8000/livez \
    "http://127.0.0.1:${BLNK_PORT}/health" \
    http://127.0.0.1:4000/livez \
    http://127.0.0.1:4000/readyz \
    http://127.0.0.1:4173/healthz; do
    curl --fail --silent --max-time 3 "$url" >/dev/null ||
      fail "runtime endpoint is not healthy: ${url}; run npm run demo:up"
  done
  pass "all demo runtime endpoints are healthy"
fi

pass "No private LMS checkout or repository credential is required"
echo "preflight: all checks passed"
