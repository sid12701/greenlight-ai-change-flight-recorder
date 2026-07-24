#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "${ROOT}/.workloads/greenlight.env" ]]; then
  docker compose \
    --env-file "${ROOT}/deploy/signoz-images.env" \
    --env-file "${ROOT}/.workloads/greenlight.env" \
    -f "${ROOT}/deploy/compose.local.yaml" \
    down
fi

bash "${ROOT}/integrations/blnk/down.sh"

if [[ -f "${ROOT}/.workloads/signoz.env" ]] &&
  [[ -f "${ROOT}/pours/deployment/compose.yaml" ]]; then
  docker compose \
    --env-file "${ROOT}/deploy/signoz-images.env" \
    --env-file "${ROOT}/.workloads/signoz.env" \
    -f "${ROOT}/pours/deployment/compose.yaml" \
    -f "${ROOT}/deploy/signoz-compose.override.yaml" \
    down
fi

echo "demo-down: services stopped; PostgreSQL, ClickHouse, Redis, and application volumes preserved"
