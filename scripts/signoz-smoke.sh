#!/usr/bin/env bash
# SigNoz health smoke.
set -euo pipefail

SIGNOZ_UI_URL="${SIGNOZ_URL:-http://localhost:8080}"
OTLP_HTTP_URL="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318}"
MCP_LIVEZ_URL="${SIGNOZ_MCP_LIVEZ_URL:-http://localhost:8000/livez}"

fail() {
  echo "signoz-smoke: error: $*" >&2
  exit 1
}

pass() {
  echo "signoz-smoke: ok: $*"
}

curl -fsS "${SIGNOZ_UI_URL}/api/v1/health" >/dev/null \
  || fail "SigNoz UI health check failed at ${SIGNOZ_UI_URL}"

pass "SigNoz UI responds at ${SIGNOZ_UI_URL}"

curl -fsS "${MCP_LIVEZ_URL}" >/dev/null \
  || fail "SigNoz MCP livez failed at ${MCP_LIVEZ_URL}"

pass "MCP livez responds at ${MCP_LIVEZ_URL}"

# OTLP HTTP readiness — send a minimal current span via backdated-span-smoke companion
node "$(dirname "$0")/backdated-span-smoke.mjs" --current-only \
  || fail "OTLP HTTP export failed at ${OTLP_HTTP_URL}"

pass "OTLP HTTP accepts telemetry at ${OTLP_HTTP_URL}"

# Port 4317 (gRPC) is intentionally not required for GreenLight MVP
pass "gRPC port 4317 is not required (OTLP HTTP only)"

echo "signoz-smoke: all checks passed"
