#!/usr/bin/env bash
set -euo pipefail

# Validates a trace-linked LMS proof commit for GL-P2-T04.
# Usage:
#   bash scripts/verify-trace-linked-commit.sh <repo-path> <commit-sha> [signoz-url]

REPO_PATH="${1:-}"
COMMIT_SHA="${2:-}"
SIGNOZ_URL="${3:-http://localhost:8080}"

fail() {
  echo "verify-trace-linked-commit: $*" >&2
  exit 1
}

[[ -n "${REPO_PATH}" && -n "${COMMIT_SHA}" ]] || fail "usage: $0 <repo-path> <commit-sha> [signoz-url]"
[[ -d "${REPO_PATH}/.git" ]] || fail "not a git repository: ${REPO_PATH}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../instrumentation/git-hooks/validate-traceparent.sh
. "${ROOT}/instrumentation/git-hooks/validate-traceparent.sh"

message="$(git -C "${REPO_PATH}" show -s --format=%B "${COMMIT_SHA}")" || fail "commit not found"
trailer="$(printf '%s\n' "${message}" | awk '/^AI-Traceparent:/ { print $2; exit }')"
[[ -n "${trailer}" ]] || fail "missing AI-Traceparent trailer"

normalized="$(validate_traceparent "${trailer}")" || fail "invalid AI-Traceparent trailer"
trace_id="${normalized#00-}"
trace_id="${trace_id%%-*}"

changed_files="$(git -C "${REPO_PATH}" show --name-only --pretty=format: "${COMMIT_SHA}")"
if ! printf '%s\n' "${changed_files}" | grep -q '^backend/'; then
  fail "commit does not touch backend/** path filter"
fi

echo "verify-trace-linked-commit: commit ${COMMIT_SHA}"
echo "  trailer: ${normalized}"
echo "  trace_id: ${trace_id}"
echo "  signoz_trace_lookup: ${SIGNOZ_URL}/trace/${trace_id}"
echo "  backend_ci_trigger: backend/** path matched"
echo "verify-trace-linked-commit: OK"
