#!/usr/bin/env bash
# Deploy LMS backend with OpenTelemetry Java agent — GL-P1-T02+
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

LMS_PATH="${LMS_PATH:?LMS_PATH is required}"
LMS_SHA="${1:-}"
LMS_BACKEND_PORT="${LMS_BACKEND_PORT:-8081}"
OTEL_JAVAAGENT_VERSION="${OTEL_JAVAAGENT_VERSION:-2.14.0}"
AGENT_DIR="${ROOT_DIR}/instrumentation/lms-java-agent"
AGENT_JAR="${AGENT_JAR:-${AGENT_DIR}/opentelemetry-javaagent.jar}"
PID_FILE="${AGENT_DIR}/lms-backend.pid"
LOG_FILE="${AGENT_DIR}/lms-backend.log"

fail() {
  echo "deploy: error: $*" >&2
  exit 1
}

if [[ -z "$LMS_SHA" || ${#LMS_SHA} -ne 40 ]]; then
  fail "Usage: LMS_PATH=/path/to/demo-clone deploy.sh <40-character-commit-sha>"
fi

[[ -d "$LMS_PATH" ]] || fail "LMS_PATH does not exist: $LMS_PATH"

mkdir -p "$AGENT_DIR"

if [[ ! -f "$AGENT_JAR" ]]; then
  echo "deploy: downloading OpenTelemetry Java agent v${OTEL_JAVAAGENT_VERSION}"
  curl -fsSL \
    "https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${OTEL_JAVAAGENT_VERSION}/opentelemetry-javaagent.jar" \
    -o "$AGENT_JAR"
fi

echo "deploy: starting minimal LMS infrastructure (postgres, rabbitmq, redis, mailhog)"
docker compose -f "${LMS_PATH}/infra/docker-compose.yml" up -d postgres rabbitmq redis mailhog >/dev/null

echo "deploy: building LMS backend"
(
  cd "${LMS_PATH}/backend"
  chmod +x ./mvnw
  if [[ ! -f .env ]]; then
    cp .env.example .env
    sed -i.bak 's/APP_SECURITY_JWT_SECRET=replace-with-at-least-32-character-local-dev-secret/APP_SECURITY_JWT_SECRET=greenlight-local-dev-jwt-secret-32chars/' .env
    sed -i.bak 's/LMS_DB_PASSWORD=replace-me/LMS_DB_PASSWORD=lms/' .env
    rm -f .env.bak
  fi
  ./mvnw -q -DskipTests package
)

JAR="$(ls "${LMS_PATH}/backend/target/"lms-backend-*.jar 2>/dev/null | grep -v '\.original$' | head -1)"
[[ -n "$JAR" ]] || fail "Could not find built backend JAR"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "deploy: stopping existing LMS backend (pid $(cat "$PID_FILE"))"
  kill "$(cat "$PID_FILE")" || true
  sleep 2
fi

export SERVER_PORT="$LMS_BACKEND_PORT"
export SPRING_PROFILES_ACTIVE=local
export LMS_DB_URL="${LMS_DB_URL:-jdbc:postgresql://localhost:5432/lms?sslmode=disable}"
export LMS_DB_USERNAME="${LMS_DB_USERNAME:-lms}"
export LMS_DB_PASSWORD="${LMS_DB_PASSWORD:-lms}"
export OTEL_EXPORTER_OTLP_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318}"
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_TRACES_SAMPLER=always_on
export OTEL_METRICS_EXPORTER=none
export OTEL_LOGS_EXPORTER=none
export OTEL_RESOURCE_ATTRIBUTES="service.name=lms-backend,service.version=${LMS_SHA},deployment.environment.name=hackathon-demo"

echo "deploy: launching LMS backend on port ${LMS_BACKEND_PORT} with service.version=${LMS_SHA}"
cd "${LMS_PATH}/backend"
nohup java -javaagent:"${AGENT_JAR}" -jar "$JAR" >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
disown

for i in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:${LMS_BACKEND_PORT}/actuator/health" >/dev/null 2>&1; then
    echo "deploy: healthy after ${i} attempts (pid $(cat "$PID_FILE"))"
    exit 0
  fi
  sleep 2
done

fail "LMS backend did not become healthy; see ${LOG_FILE}"
