#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "demo-regression: exercising a reversible Blnk PostgreSQL dependency outage"
bash "${ROOT}/integrations/blnk/failure-cycle.sh"
