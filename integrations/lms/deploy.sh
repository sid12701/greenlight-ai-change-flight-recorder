#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LMS_PATH="${LMS_PATH:-}"
COMMIT_SHA="${1:-}"
ROLE="${2:-candidate}"

if [[ -z "${LMS_PATH}" || -z "${COMMIT_SHA}" ]]; then
  echo "usage: LMS_PATH=/path/to/demo-clone $0 <commit-sha> [baseline|candidate|recovery]" >&2
  exit 1
fi

AGENT_JAR="${OTEL_JAVA_AGENT_PATH:-${ROOT}/instrumentation/lms-java-agent/opentelemetry-javaagent.jar}"
LOG_FILE="${LMS_DEPLOY_LOG:-/tmp/lms-${COMMIT_SHA}.log}"
SERVER_PORT="${LMS_BACKEND_PORT:-8081}"
LMS_DB_URL="${LMS_DB_URL:-jdbc:postgresql://localhost:5432/lms}"
LMS_DB_USERNAME="${LMS_DB_USERNAME:-lms}"
LMS_DB_PASSWORD="${LMS_DB_PASSWORD:-lms}"
LMS_REDIS_HOST="${LMS_REDIS_HOST:-localhost}"
LMS_REDIS_PORT="${LMS_REDIS_PORT:-6379}"
SPRING_RABBITMQ_HOST="${SPRING_RABBITMQ_HOST:-localhost}"
OTEL_EXPORTER_OTLP_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318}"
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_TRACES_SAMPLER=always_on
OTEL_METRICS_EXPORTER=none
OTEL_LOGS_EXPORTER=none
OTEL_RESOURCE_ATTRIBUTES="service.name=lms-backend,service.version=${COMMIT_SHA},deployment.environment.name=hackathon-demo"

if lsof -ti :"${SERVER_PORT}" >/dev/null 2>&1; then
  echo "deploy: stopping existing process on port ${SERVER_PORT}"
  lsof -ti :"${SERVER_PORT}" | xargs kill -9 || true
  sleep 2
fi

echo "deploy: starting LMS backend for ${COMMIT_SHA} (${ROLE})"
cd "${LMS_PATH}/backend"
git -C "${LMS_PATH}" checkout "${COMMIT_SHA}" >/dev/null 2>&1 || true
chmod +x "${LMS_PATH}/backend/mvnw" 2>/dev/null || true
./mvnw -q -DskipTests package

nohup env \
  SERVER_PORT="${SERVER_PORT}" \
  SPRING_PROFILES_ACTIVE=local \
  LMS_DB_URL="${LMS_DB_URL}" \
  LMS_DB_USERNAME="${LMS_DB_USERNAME}" \
  LMS_DB_PASSWORD="${LMS_DB_PASSWORD}" \
  LMS_REDIS_HOST="${LMS_REDIS_HOST}" \
  LMS_REDIS_PORT="${LMS_REDIS_PORT}" \
  SPRING_RABBITMQ_HOST="${SPRING_RABBITMQ_HOST}" \
  OTEL_SERVICE_NAME=lms-backend \
  OTEL_EXPORTER_OTLP_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT}" \
  OTEL_EXPORTER_OTLP_PROTOCOL="${OTEL_EXPORTER_OTLP_PROTOCOL}" \
  OTEL_TRACES_SAMPLER="${OTEL_TRACES_SAMPLER}" \
  OTEL_METRICS_EXPORTER="${OTEL_METRICS_EXPORTER}" \
  OTEL_LOGS_EXPORTER="${OTEL_LOGS_EXPORTER}" \
  OTEL_RESOURCE_ATTRIBUTES="${OTEL_RESOURCE_ATTRIBUTES}" \
  java -javaagent:"${AGENT_JAR}" -jar target/lms-backend-0.0.1-SNAPSHOT.jar >"${LOG_FILE}" 2>&1 &
PID=$!
disown "${PID}" || true

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${SERVER_PORT}/actuator/health" >/dev/null; then
    echo "deploy: healthy pid=${PID} log=${LOG_FILE}"
    exit 0
  fi
  sleep 2
done

echo "deploy: health check failed; see ${LOG_FILE}" >&2
tail -20 "${LOG_FILE}" >&2 || true
kill "${PID}" 2>/dev/null || true
exit 1
