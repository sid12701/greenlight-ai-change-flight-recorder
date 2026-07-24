#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMMIT_SHA="${1:-}"
ROLE="${2:-candidate}"
LMS_IMAGE="${LMS_IMAGE:-}"
LMS_ENV_FILE="${LMS_ENV_FILE:-}"
LMS_BACKEND_PORT="${LMS_BACKEND_PORT:-8081}"
LMS_CONTAINER_PORT="${LMS_CONTAINER_PORT:-8080}"
LMS_DEPLOYMENT_SLOT="${LMS_DEPLOYMENT_SLOT:-blue}"
LMS_HEALTH_URL="${LMS_HEALTH_URL:-http://127.0.0.1:${LMS_BACKEND_PORT}/actuator/health}"
LMS_DEMO_ROUTE="${LMS_DEMO_ROUTE:-/api/v1/internal/home/overview}"
GREENLIGHT_API_URL="${GREENLIGHT_API_URL:-http://127.0.0.1:4000}"
GREENLIGHT_ADMIN_TOKEN="${GREENLIGHT_ADMIN_TOKEN:-}"
GREENLIGHT_REPOSITORY="${GITHUB_REPOSITORY:-}"
ENVIRONMENT_NAME="${LMS_ENVIRONMENT_NAME:-${MCP_ENVIRONMENT_NAME:-hackathon-demo}}"
CONTAINER_NAME="greenlight-lms-${LMS_DEPLOYMENT_SLOT}"

fail() {
  echo "deploy: error: $*" >&2
  exit 1
}

[[ "$COMMIT_SHA" =~ ^[0-9a-f]{40}$ ]] ||
  fail "usage: LMS_IMAGE=repo/image@sha256:<digest> $0 <40-character-sha> [baseline|candidate|recovery]"
[[ "$ROLE" =~ ^(baseline|candidate|recovery)$ ]] || fail "invalid deployment role"
[[ "$LMS_IMAGE" =~ @sha256:([0-9a-f]{64})$ ]] || fail "LMS_IMAGE must be pinned by sha256 digest"
[[ -f "$LMS_ENV_FILE" ]] || fail "LMS_ENV_FILE must point to a runtime secret env file"
[[ -n "$GREENLIGHT_ADMIN_TOKEN" ]] || fail "GREENLIGHT_ADMIN_TOKEN is required"
[[ "$GREENLIGHT_REPOSITORY" =~ ^[^/]+/[^/]+$ ]] || fail "GITHUB_REPOSITORY must identify the hosted LMS repository"

IMAGE_DIGEST="${LMS_IMAGE##*@}"
docker pull "$LMS_IMAGE" >/dev/null
IMAGE_REVISION="$(docker image inspect "$LMS_IMAGE" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}')"
[[ "$IMAGE_REVISION" == "$COMMIT_SHA" ]] ||
  fail "image revision label '$IMAGE_REVISION' does not match requested SHA '$COMMIT_SHA'"

if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  docker rm --force "$CONTAINER_NAME" >/dev/null
fi

DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker run --detach \
  --name "$CONTAINER_NAME" \
  --read-only \
  --tmpfs /tmp:size=128m,mode=1777 \
  --memory 1g \
  --cpus 2 \
  --restart unless-stopped \
  --env-file "$LMS_ENV_FILE" \
  --env "SERVER_PORT=${LMS_CONTAINER_PORT}" \
  --env "OTEL_SERVICE_NAME=lms-backend" \
  --env "OTEL_RESOURCE_ATTRIBUTES=service.name=lms-backend,service.version=${COMMIT_SHA},deployment.environment.name=${ENVIRONMENT_NAME}" \
  --publish "127.0.0.1:${LMS_BACKEND_PORT}:${LMS_CONTAINER_PORT}" \
  "$LMS_IMAGE" >/dev/null

for _ in $(seq 1 60); do
  if curl --fail --silent --show-error "$LMS_HEALTH_URL" >/dev/null; then
    # Keyed by role and deployment instant as well as slot and digest: a
    # recovery redeploys the known-good digest, and keying on the digest alone
    # would make GreenLight treat that as a replay of the original baseline and
    # never record the recovery.
    IDEMPOTENCY_KEY="docker:${CONTAINER_NAME}:${ROLE}:${IMAGE_DIGEST}:${DEPLOYED_AT}"
    JOB_RESPONSE="$(curl --fail --silent --show-error \
      --request POST "${GREENLIGHT_API_URL}/api/v1/deployments" \
      --header "Authorization: Bearer ${GREENLIGHT_ADMIN_TOKEN}" \
      --header "Content-Type: application/json" \
      --data "$(printf '{"repository":"%s","commitSha":"%s","serviceName":"lms-backend","environmentName":"%s","route":"%s","healthUrl":"%s","imageDigest":"%s","idempotencyKey":"%s","provider":"docker","role":"%s","status":"succeeded","deployedAt":"%s"}' \
        "$GREENLIGHT_REPOSITORY" "$COMMIT_SHA" "$ENVIRONMENT_NAME" "$LMS_DEMO_ROUTE" \
        "$LMS_HEALTH_URL" "$IMAGE_DIGEST" "$IDEMPOTENCY_KEY" "$ROLE" "$DEPLOYED_AT")" \
      )"
    JOB_ID="$(node -e 'const chunks=[];process.stdin.on("data",c=>chunks.push(c));process.stdin.on("end",()=>{const value=JSON.parse(Buffer.concat(chunks));if(!value.jobId)process.exit(1);process.stdout.write(value.jobId)})' <<<"$JOB_RESPONSE")"
    echo "deploy: healthy immutable image $LMS_IMAGE in slot $LMS_DEPLOYMENT_SLOT"
    node "${ROOT}/scripts/wait-job.mjs" "$JOB_ID"
    exit 0
  fi
  sleep 2
done

docker logs --tail 50 "$CONTAINER_NAME" >&2 || true
fail "health check failed at configured target $LMS_HEALTH_URL"
