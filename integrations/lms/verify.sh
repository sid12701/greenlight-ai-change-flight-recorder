#!/usr/bin/env bash
# Verify LMS telemetry in SigNoz — GL-P1-T02
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

LMS_SHA="${1:-}"
LMS_BACKEND_PORT="${LMS_BACKEND_PORT:-8081}"
LMS_DEMO_ROUTE="${LMS_DEMO_ROUTE:-/api/v1/internal/home/overview}"
SIGNOZ_CLICKHOUSE_CONTAINER="${SIGNOZ_CLICKHOUSE_CONTAINER:-signoz-telemetrystore-clickhouse-0-0}"
LMS_LOGIN_EMAIL="${LMS_LOGIN_EMAIL:-}"
LMS_LOGIN_PASSWORD="${LMS_LOGIN_PASSWORD:-}"

fail() {
  echo "verify: error: $*" >&2
  exit 1
}

pass() {
  echo "verify: ok: $*"
}

if [[ -z "$LMS_SHA" || ${#LMS_SHA} -ne 40 ]]; then
  fail "Usage: verify.sh <40-character-commit-sha>"
fi
[[ -n "$LMS_LOGIN_EMAIL" && -n "$LMS_LOGIN_PASSWORD" ]] ||
  fail "LMS_LOGIN_EMAIL and LMS_LOGIN_PASSWORD are required"

HEALTH="$(curl -fsS "http://127.0.0.1:${LMS_BACKEND_PORT}/actuator/health")"
echo "$HEALTH" | grep -q '"status":"UP"' || fail "Actuator health not UP: $HEALTH"
pass "Actuator health UP on port ${LMS_BACKEND_PORT}"

LOGIN_RESPONSE="$(curl -fsS -X POST "http://127.0.0.1:${LMS_BACKEND_PORT}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${LMS_LOGIN_EMAIL}\",\"password\":\"${LMS_LOGIN_PASSWORD}\"}")"

TOKEN="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])' <<<"$LOGIN_RESPONSE")"
[[ -n "$TOKEN" ]] || fail "Could not obtain access token"

HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" \
  "http://127.0.0.1:${LMS_BACKEND_PORT}${LMS_DEMO_ROUTE}")"
[[ "$HTTP_CODE" == "200" ]] || fail "Home overview returned HTTP ${HTTP_CODE}"
pass "Route ${LMS_DEMO_ROUTE} returned 200"

sleep 5

TRACE_COUNT="$(docker exec "$SIGNOZ_CLICKHOUSE_CONTAINER" clickhouse-client --query \
  "SELECT count() FROM signoz_traces.distributed_signoz_index_v3 WHERE resources_string['service.name'] = 'lms-backend' AND resources_string['service.version'] = '${LMS_SHA}'")"
[[ "$TRACE_COUNT" -ge 1 ]] || fail "No lms-backend traces with service.version=${LMS_SHA} (found ${TRACE_COUNT})"
pass "Found ${TRACE_COUNT} trace(s) for lms-backend version ${LMS_SHA}"

JDBC_COUNT="$(docker exec "$SIGNOZ_CLICKHOUSE_CONTAINER" clickhouse-client --query \
  "SELECT count() FROM signoz_traces.distributed_signoz_index_v3 WHERE resources_string['service.name'] = 'lms-backend' AND resources_string['service.version'] = '${LMS_SHA}' AND (name LIKE 'SELECT %' OR attributes_string['db.system'] != '')")"
if [[ "$JDBC_COUNT" -lt 1 ]]; then
  fail "No JDBC/database child spans found"
fi
pass "Database child spans present (${JDBC_COUNT})"

echo "verify: all checks passed"
