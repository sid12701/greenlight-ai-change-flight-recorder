#!/usr/bin/env bash
# End-to-end demo preflight.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "${ROOT}/scripts/preflight.sh"
bash "${ROOT}/scripts/signoz-smoke.sh"

for url in http://127.0.0.1:4000/api/v1/health http://127.0.0.1:4173; do
  curl -fsS "$url" >/dev/null || {
    echo "demo-smoke: warning: $url not reachable (start API/web before demo)" >&2
  }
done

echo "demo-smoke: dependency checks passed"
