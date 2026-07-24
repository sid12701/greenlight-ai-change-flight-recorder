#!/usr/bin/env bash
# Bootstrap SigNoz first-time setup for local demo — GL-P1-T01
set -euo pipefail

SIGNOZ_URL="${SIGNOZ_URL:-http://localhost:8080}"
SIGNOZ_BOOTSTRAP_EMAIL="${SIGNOZ_BOOTSTRAP_EMAIL:-}"
SIGNOZ_BOOTSTRAP_PASSWORD="${SIGNOZ_BOOTSTRAP_PASSWORD:-}"
SIGNOZ_BOOTSTRAP_NAME="${SIGNOZ_BOOTSTRAP_NAME:-GreenLight Demo}"

if [[ -z "$SIGNOZ_BOOTSTRAP_EMAIL" || -z "$SIGNOZ_BOOTSTRAP_PASSWORD" ]]; then
  echo "signoz-bootstrap: SIGNOZ_BOOTSTRAP_EMAIL and SIGNOZ_BOOTSTRAP_PASSWORD are required" >&2
  exit 1
fi

setup_json="$(curl -fsS "${SIGNOZ_URL}/api/v1/version")"
if echo "$setup_json" | grep -q '"setupCompleted":true'; then
  echo "signoz-bootstrap: setup already completed"
  exit 0
fi

echo "signoz-bootstrap: registering initial admin user"
curl -fsS -X POST "${SIGNOZ_URL}/api/v1/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${SIGNOZ_BOOTSTRAP_EMAIL}\",\"password\":\"${SIGNOZ_BOOTSTRAP_PASSWORD}\",\"name\":\"${SIGNOZ_BOOTSTRAP_NAME}\"}" \
  >/dev/null

echo "signoz-bootstrap: waiting for collector pipelines"
sleep 15

setup_json="$(curl -fsS "${SIGNOZ_URL}/api/v1/version")"
if ! echo "$setup_json" | grep -q '"setupCompleted":true'; then
  echo "signoz-bootstrap: error: setup did not complete" >&2
  exit 1
fi

echo "signoz-bootstrap: ok"
echo "signoz-bootstrap: create a service account API key in Settings → Service Accounts and set SIGNOZ_API_KEY in .env"
