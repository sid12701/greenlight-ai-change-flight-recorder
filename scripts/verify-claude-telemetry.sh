#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/instrumentation/claude-code/env.example"

fail() {
  echo "verify-claude-telemetry: $*" >&2
  exit 1
}

[[ -f "${ENV_FILE}" ]] || fail "missing ${ENV_FILE}"

required_vars=(
  CLAUDE_CODE_ENABLE_TELEMETRY=1
  CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1
  CLAUDE_CODE_PROPAGATE_TRACEPARENT=1
  OTEL_TRACES_EXPORTER=otlp
  OTEL_LOGS_EXPORTER=otlp
  OTEL_METRICS_EXPORTER=otlp
  OTEL_TRACES_SAMPLER=always_on
  OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
  OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
  OTEL_LOG_USER_PROMPTS=0
  OTEL_LOG_TOOL_DETAILS=0
  OTEL_LOG_TOOL_CONTENT=0
)

for entry in "${required_vars[@]}"; do
  key="${entry%%=*}"
  value="${entry#*=}"
  if ! grep -q "^export ${key}=${value}$" "${ENV_FILE}"; then
    fail "expected export ${key}=${value}"
  fi
done

forbidden_patterns=(
  'OTEL_LOG_USER_PROMPTS=1'
  'OTEL_LOG_TOOL_DETAILS=1'
  'OTEL_LOG_TOOL_CONTENT=1'
  'prompt'
  'tool_content'
)

for pattern in "${forbidden_patterns[@]}"; do
  if grep -Eiq "${pattern}" "${ENV_FILE}" && [[ "${pattern}" != 'prompt' && "${pattern}" != 'tool_content' ]]; then
    fail "forbidden pattern enabled: ${pattern}"
  fi
done

# Reject prompt/tool-content export flags if set to enabled
if grep -Eq '^export OTEL_LOG_(USER_PROMPTS|TOOL_DETAILS|TOOL_CONTENT)=1' "${ENV_FILE}"; then
  fail "content export flags must remain disabled"
fi

echo "verify-claude-telemetry: env.example contract OK"
