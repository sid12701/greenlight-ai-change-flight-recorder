#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIGNOZ_COMPOSE="${ROOT}/pours/deployment/compose.yaml"
SIGNOZ_OVERRIDE="${ROOT}/deploy/signoz-compose.override.yaml"
SIGNOZ_IMAGE_ENV="${ROOT}/deploy/signoz-images.env"
SIGNOZ_SECRET_ENV="${ROOT}/.workloads/signoz.env"
GREENLIGHT_SECRET_ENV="${ROOT}/.workloads/greenlight.env"
GREENLIGHT_COMPOSE="${ROOT}/deploy/compose.local.yaml"
DEMO_ENV="${ROOT}/.env.demo"

fail() {
  echo "demo-bootstrap: error: $*" >&2
  exit 1
}

pass() {
  echo "demo-bootstrap: ok: $*"
}

resolve_node24() {
  local candidate
  local candidates=()
  if command -v node >/dev/null 2>&1; then
    candidates+=("$(command -v node)")
  fi
  if command -v node24 >/dev/null 2>&1; then
    candidates+=("$(command -v node24)")
  fi
  candidates+=(
    "/opt/homebrew/opt/node@24/bin/node"
    "/usr/local/opt/node@24/bin/node"
    "${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  )
  for candidate in "${HOME}"/.nvm/versions/node/v24*/bin/node; do
    candidates+=("$candidate")
  done
  for candidate in "${candidates[@]}"; do
    if [[ -x "$candidate" ]] && [[ "$("$candidate" --version)" == v24.* ]]; then
      export PATH="$(dirname "$candidate"):${PATH}"
      return
    fi
  done
  fail "Node 24 was not found. Run 'nvm install 24 && nvm use 24', then rerun npm run demo:up"
}

wait_for() {
  local name="$1"
  local url="$2"
  local attempts="${3:-60}"
  local attempt
  for attempt in $(seq 1 "$attempts"); do
    if curl --fail --silent --max-time 3 "$url" >/dev/null 2>&1; then
      pass "${name} is healthy"
      return
    fi
    sleep 2
  done
  fail "${name} did not become healthy at ${url}; run npm run demo:status for diagnostics"
}

status() {
  local failed=0
  local entry
  for entry in \
    "SigNoz|http://127.0.0.1:8080/api/v1/health" \
    "MCP|http://127.0.0.1:8000/livez" \
    "Blnk|http://127.0.0.1:18081/health" \
    "GreenLight API|http://127.0.0.1:4000/readyz" \
    "GreenLight Web|http://127.0.0.1:4173/healthz"; do
    local name="${entry%%|*}"
    local url="${entry#*|}"
    if curl --fail --silent --max-time 2 "$url" >/dev/null 2>&1; then
      echo "demo-status: healthy: ${name} (${url})"
    else
      echo "demo-status: unavailable: ${name} (${url})" >&2
      failed=1
    fi
  done
  return "$failed"
}

if [[ "${1:-}" == "--status" ]]; then
  status
  exit
fi
[[ "$#" -eq 0 ]] || fail "usage: scripts/demo-bootstrap.sh [--status]"

resolve_node24
cd "$ROOT"

if [[ ! -f "$DEMO_ENV" ]]; then
  fail "missing .env.demo. Run 'cp .env.demo.example .env.demo', set SIGNOZ_API_KEY after SigNoz setup, then rerun npm run demo:up"
fi

bash "${ROOT}/scripts/preflight.sh" --bootstrap
node "${ROOT}/scripts/demo-config.mjs" secrets --adopt-running

set -a
# shellcheck disable=SC1090
source "$SIGNOZ_SECRET_ENV"
set +a

foundryctl gauge -f "${ROOT}/casting.yaml"
foundryctl forge -f "${ROOT}/casting.yaml"
docker compose \
  --env-file "$SIGNOZ_IMAGE_ENV" \
  --env-file "$SIGNOZ_SECRET_ENV" \
  -f "$SIGNOZ_COMPOSE" \
  -f "$SIGNOZ_OVERRIDE" \
  up -d
wait_for "SigNoz" "http://127.0.0.1:8080/api/v1/health"
wait_for "SigNoz MCP" "http://127.0.0.1:8000/livez"

SIGNOZ_URL=http://127.0.0.1:8080 bash "${ROOT}/scripts/signoz-bootstrap.sh"

if ! node "${ROOT}/scripts/demo-config.mjs" credentials "$DEMO_ENV"; then
  echo "demo-bootstrap: GreenLight has not been started." >&2
  echo "demo-bootstrap: open http://127.0.0.1:8080, sign in with the credentials stored in .workloads/signoz.env, create a greenlight service-account key, and set SIGNOZ_API_KEY in .env.demo." >&2
  echo "demo-bootstrap: the public GitHub repository needs no token; add one only if you need a higher API rate limit. Then rerun npm run demo:up." >&2
  exit 2
fi

set -a
# shellcheck disable=SC1090
source "$DEMO_ENV"
set +a

curl --fail --silent --max-time 10 \
  -H "SIGNOZ-API-KEY: ${SIGNOZ_API_KEY}" \
  "${SIGNOZ_URL}/api/v1/service_accounts/me" >/dev/null ||
  fail "SIGNOZ_API_KEY was rejected; replace it in .env.demo with a valid greenlight service-account key"

GITHUB_HEADERS=(
  -H "Accept: application/vnd.github+json"
  -H "X-GitHub-Api-Version: 2022-11-28"
)
if [[ -n "${GITHUB_TOKEN}" ]]; then
  GITHUB_HEADERS+=(-H "Authorization: Bearer ${GITHUB_TOKEN}")
fi
curl --fail --silent --max-time 10 "${GITHUB_HEADERS[@]}" \
  "https://api.github.com/repos/${GITHUB_REPOSITORY}" >/dev/null ||
  fail "GitHub cannot read ${GITHUB_REPOSITORY}; verify it is public or add a read-only GITHUB_TOKEN"

bash "${ROOT}/integrations/blnk/up.sh"

docker compose \
  --env-file "$SIGNOZ_IMAGE_ENV" \
  --env-file "$GREENLIGHT_SECRET_ENV" \
  -f "$GREENLIGHT_COMPOSE" \
  config --quiet
docker compose \
  --env-file "$SIGNOZ_IMAGE_ENV" \
  --env-file "$GREENLIGHT_SECRET_ENV" \
  -f "$GREENLIGHT_COMPOSE" \
  up -d --build

wait_for "GreenLight API liveness" "http://127.0.0.1:4000/livez"
wait_for "GreenLight API readiness" "http://127.0.0.1:4000/readyz"
wait_for "GreenLight Web" "http://127.0.0.1:4173/healthz"

bash "${ROOT}/scripts/signoz-runtime-verify.sh"
status

echo "demo-bootstrap: complete"
echo "demo-bootstrap: GreenLight http://127.0.0.1:4173"
echo "demo-bootstrap: SigNoz     http://127.0.0.1:8080"
echo "demo-bootstrap: Blnk       http://127.0.0.1:18081"
