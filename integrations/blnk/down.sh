#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT}/.workloads/blnk.env"
COMPOSE_FILE="${ROOT}/integrations/blnk/compose.yaml"

[[ -f "$ENV_FILE" ]] || {
  echo "blnk-down: nothing to stop"
  exit 0
}

if [[ "${1:-}" == "--volumes" ]]; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down --volumes
  echo "blnk-down: workload and local data volumes removed"
else
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down
  echo "blnk-down: workload stopped; local data volumes preserved"
fi
