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
  OTEL_LOG_USER_PROMPTS=1
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

# Tool arguments and tool output carry file contents, command output and any
# credential read during a run. Prompt export is a deliberate choice recorded
# above; these two are not, and flipping either one silently would widen what
# the trace store holds far beyond what the receipt needs.
if grep -Eq '^export OTEL_LOG_(TOOL_DETAILS|TOOL_CONTENT)=1' "${ENV_FILE}"; then
  fail "tool-detail and tool-content export must remain disabled"
fi

echo "verify-claude-telemetry: env.example contract OK"
