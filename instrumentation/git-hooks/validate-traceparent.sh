#!/usr/bin/env bash
# POSIX-compatible W3C traceparent validator for the git hook.
# Must stay aligned with packages/shared/test-vectors/traceparent.json

validate_traceparent() {
  local input="$1"
  local trimmed
  trimmed="$(printf '%s' "$input" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

  if [ -z "$trimmed" ]; then
    return 1
  fi

  if printf '%s' "$trimmed" | grep -q '[[:space:]]'; then
    return 1
  fi

  if [ "$(printf '%s' "$trimmed" | awk -F'-' '{print NF}')" -ne 4 ]; then
    return 1
  fi

  local version trace_id span_id flags
  version="${trimmed%%-*}"
  local rest="${trimmed#*-}"
  trace_id="${rest%%-*}"
  rest="${rest#*-}"
  span_id="${rest%%-*}"
  flags="${rest#*-}"

  if [ "$version" != "00" ]; then
    return 1
  fi

  if [ "$(printf '%s' "$trace_id" | wc -c | tr -d ' ')" -ne 32 ]; then
    return 1
  fi
  if [ "$(printf '%s' "$span_id" | wc -c | tr -d ' ')" -ne 16 ]; then
    return 1
  fi
  if [ "$(printf '%s' "$flags" | wc -c | tr -d ' ')" -ne 2 ]; then
    return 1
  fi

  if ! printf '%s' "$trace_id" | grep -Eq '^[0-9a-fA-F]{32}$'; then
    return 1
  fi
  if ! printf '%s' "$span_id" | grep -Eq '^[0-9a-fA-F]{16}$'; then
    return 1
  fi
  if ! printf '%s' "$flags" | grep -Eq '^[0-9a-fA-F]{2}$'; then
    return 1
  fi

  local trace_lower span_lower flags_lower
  trace_lower="$(printf '%s' "$trace_id" | tr '[:upper:]' '[:lower:]')"
  span_lower="$(printf '%s' "$span_id" | tr '[:upper:]' '[:lower:]')"
  flags_lower="$(printf '%s' "$flags" | tr '[:upper:]' '[:lower:]')"

  if [ "$trace_lower" = "00000000000000000000000000000000" ]; then
    return 1
  fi
  if [ "$span_lower" = "0000000000000000" ]; then
    return 1
  fi

  printf '%s\n' "00-${trace_lower}-${span_lower}-${flags_lower}"
  return 0
}
