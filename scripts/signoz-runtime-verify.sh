#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_ENV="${ROOT}/deploy/signoz-images.env"

fail() {
  echo "signoz-runtime: error: $*" >&2
  exit 1
}

pass() {
  echo "signoz-runtime: ok: $*"
}

command -v docker >/dev/null || fail "Docker is required"
command -v foundryctl >/dev/null || fail "foundryctl is required"
foundryctl version 2>&1 | grep -q "Version:  $(cat "${ROOT}/deploy/foundry.version")" ||
  fail "foundryctl version does not match deploy/foundry.version"
pass "foundryctl $(cat "${ROOT}/deploy/foundry.version")"

set -a
# shellcheck disable=SC1090
source "$IMAGE_ENV"
set +a

verify_container_image() {
  local container="$1"
  local expected="$2"
  local tagged="${expected%@*}"
  local repository="${tagged%:*}"
  local digest="${expected##*@}"
  local image_id
  local repo_digests
  image_id="$(docker inspect "$container" --format '{{.Image}}')" ||
    fail "container is missing: ${container}"
  repo_digests="$(docker image inspect "$image_id" --format '{{join .RepoDigests " "}}')"
  [[ " ${repo_digests} " == *" ${repository}@${digest} "* ]] ||
    fail "${container} does not use ${repository}@${digest}"
  pass "${container} matches ${tagged}@${digest}"
}

verify_container_image signoz-signoz-0 "$SIGNOZ_IMAGE"
verify_container_image signoz-ingester-1 "$SIGNOZ_OTEL_COLLECTOR_IMAGE"
verify_container_image signoz-mcp "$SIGNOZ_MCP_IMAGE"
verify_container_image signoz-metastore-postgres-0 "$SIGNOZ_POSTGRES_IMAGE"
verify_container_image signoz-telemetrystore-clickhouse-0-0 "$SIGNOZ_CLICKHOUSE_IMAGE"
verify_container_image signoz-telemetrykeeper-clickhousekeeper-0 "$SIGNOZ_CLICKHOUSE_KEEPER_IMAGE"

version_json="$(curl --fail --silent "${SIGNOZ_URL:-http://127.0.0.1:8080}/api/v1/version")"
[[ "$version_json" == *'"version":"v0.134.0"'* ]] ||
  fail "SigNoz API did not report v0.134.0"
pass "SigNoz API reports v0.134.0"

curl --fail --silent "${SIGNOZ_MCP_LIVEZ_URL:-http://127.0.0.1:8000/livez}" >/dev/null ||
  fail "MCP liveness failed"
pass "MCP v0.9.0 liveness endpoint responds"

node "${ROOT}/scripts/backdated-span-smoke.mjs" --current-only >/dev/null ||
  fail "OTLP HTTP ingestion failed"
pass "OTLP HTTP ingestion accepted a current span"

echo "signoz-runtime: all pinned runtime checks passed"
