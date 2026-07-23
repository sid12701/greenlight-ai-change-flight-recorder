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

export SERVER_PORT=8081
export OTEL_EXPORTER_OTLP_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318}"
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_TRACES_SAMPLER=always_on
export OTEL_RESOURCE_ATTRIBUTES="service.name=lms-backend,service.version=${COMMIT_SHA},deployment.environment.name=hackathon-demo"

echo "deploy: starting LMS backend for ${COMMIT_SHA} (${ROLE})"
cd "${LMS_PATH}/backend"
./mvnw -q -DskipTests package
java -javaagent:${OTEL_JAVA_AGENT_PATH:-/tmp/opentelemetry-javaagent.jar} \
  -jar target/lms-backend-0.0.1-SNAPSHOT.jar &
PID=$!

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:8081/actuator/health" >/dev/null; then
    echo "deploy: healthy pid=${PID}"
    exit 0
  fi
  sleep 2
done

echo "deploy: health check failed" >&2
kill "${PID}" || true
exit 1
