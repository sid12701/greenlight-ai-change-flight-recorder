#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

npm ci
npm run quality
npm run validate:config
npm run validate:telemetry
npm run validate:signoz-stack
npm run validate:signoz-assets
npm run verify
npm run test:compiled-migrations
npm run test:compiled-start
npm run test:e2e:smoke
docker compose -f deploy/compose.local.yaml config --quiet
docker build -f deploy/api.Dockerfile -t greenlight-api:acceptance .
docker build -f deploy/web.Dockerfile -t greenlight-web:acceptance .

if [[ "${RUN_LIVE_ACCEPTANCE:-0}" != "1" ]]; then
  echo "acceptance: repository gates passed; live evidence gates require RUN_LIVE_ACCEPTANCE=1" >&2
  exit 2
fi

: "${BAD_SHA:?BAD_SHA is required for live acceptance}"
: "${LMS_BASELINE_SHA:?LMS_BASELINE_SHA is required for live acceptance}"
: "${SIGNOZ_MCP_URL:?SIGNOZ_MCP_URL is required for live acceptance}"

bash scripts/preflight.sh
bash scripts/signoz-smoke.sh

# Live SigNoz contract: the query path, the reconstructed CI span tree, and
# the fail-closed behaviour of an unauthorised credential.
npm run test:integration

# Import the dashboards and alert rules, proving they load rather than
# asserting that they would.
npm run signoz:import

# A genuine MCP investigation, whose trace IDs must resolve in SigNoz.
npm run mcp:capture
npm run mcp:verify

echo "acceptance: repository and configured live gates passed"
