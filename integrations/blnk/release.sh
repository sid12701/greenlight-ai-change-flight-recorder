#!/usr/bin/env bash
# Deploys the workload as the GreenLight release identified by a commit.
#
# GreenLight verifies a deployment by requiring the workload's SigNoz
# `service.version` to equal the change's commit SHA. That check is only
# meaningful if the running configuration is genuinely the configuration at
# that commit, so the deployed config is extracted from the commit itself
# rather than read from the working tree. Baseline, candidate, and recovery
# windows are then separately queryable in SigNoz by version.
#
# Extracting rather than checking out matters: a checkout would replace this
# script and the compose file mid-deployment.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT}/.workloads/blnk.env"
COMPOSE_FILE="${ROOT}/integrations/blnk/compose.yaml"
RELEASE_FILE="integrations/blnk/release.json"
VERSION="${1:-}"

fail() {
  echo "blnk-release: error: $*" >&2
  exit 1
}

[[ "${VERSION}" =~ ^[0-9a-f]{40}$ ]] || fail "usage: release.sh <40-char-commit-sha>"

git -C "${ROOT}" cat-file -e "${VERSION}^{commit}" 2>/dev/null ||
  fail "${VERSION} is not a commit in this repository"

DEPLOY_CONFIG="${ROOT}/.workloads/blnk-release.json"
git -C "${ROOT}" show "${VERSION}:${RELEASE_FILE}" >"${DEPLOY_CONFIG}" ||
  fail "${RELEASE_FILE} does not exist at ${VERSION}"
export BLNK_RELEASE_CONFIG="${DEPLOY_CONFIG}"

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

export BLNK_RELEASE_VERSION="${VERSION}"

echo "blnk-release: deploying ${VERSION}"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" \
  up --detach --no-build --force-recreate server worker

for _ in $(seq 1 60); do
  if curl --fail --silent --output /dev/null \
    "http://127.0.0.1:${BLNK_PORT:-18081}/health"; then
    echo "${VERSION}" >"${ROOT}/.workloads/blnk-release.txt"
    echo "blnk-release: ${VERSION} is serving"
    exit 0
  fi
  sleep 1
done

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" logs --tail 50 server
# A release that cannot serve is a failed deployment, not a regression to
# measure, and must not be reported as one.
fail "${VERSION} did not become healthy"
