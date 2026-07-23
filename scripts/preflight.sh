#!/usr/bin/env bash
# GreenLight LMS demo preflight — GL-P0-T02
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

LMS_FORBIDDEN_PATH="${LMS_FORBIDDEN_PATH:-/Users/siddhant/Desktop/lms}"
LMS_DEMO_BRANCH="${LMS_DEMO_BRANCH:-greenlight-demo}"
LMS_BASELINE_SHA="${LMS_BASELINE_SHA:-2269d064f0be50e7f6485c0be38e3cdcef6137d2}"
LMS_BACKEND_PORT="${LMS_BACKEND_PORT:-8081}"
LMS_DEMO_ROUTE="${LMS_DEMO_ROUTE:-/api/v1/internal/home/overview}"
PROOF_COMMIT_FILE="${PROOF_COMMIT_FILE:-backend/README.md}"
PRIMARY_WORKFLOW_NAME="${GREENLIGHT_PRIMARY_WORKFLOW_NAME:-Backend CI}"

fail() {
  echo "preflight: error: $*" >&2
  exit 1
}

pass() {
  echo "preflight: ok: $*"
}

if [[ -z "${LMS_PATH:-}" ]]; then
  fail "LMS_PATH is not set. See integrations/lms/demo-config.example"
fi

resolve_path() {
  python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$1"
}

LMS_PATH_RESOLVED="$(resolve_path "$LMS_PATH")"
FORBIDDEN_RESOLVED="$(resolve_path "$LMS_FORBIDDEN_PATH")"

if [[ "$LMS_PATH_RESOLVED" == "$FORBIDDEN_RESOLVED" ]]; then
  fail "Refusing unsafe LMS_PATH: points at the primary maintainer checkout ($LMS_FORBIDDEN_PATH). Use the isolated demo clone instead."
fi

if [[ ! -d "$LMS_PATH" ]]; then
  fail "LMS_PATH does not exist: $LMS_PATH (create the demo clone per integrations/lms/README.md)"
fi

if [[ ! -d "$LMS_PATH/.git" ]]; then
  fail "LMS_PATH is not a Git repository: $LMS_PATH"
fi

HEAD_SHA="$(git -C "$LMS_PATH" rev-parse HEAD)"
if [[ "$HEAD_SHA" != "$LMS_BASELINE_SHA" ]]; then
  fail "Demo clone HEAD is $HEAD_SHA; expected baseline $LMS_BASELINE_SHA"
fi

CURRENT_BRANCH="$(git -C "$LMS_PATH" branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$LMS_DEMO_BRANCH" ]]; then
  fail "Demo clone branch is '$CURRENT_BRANCH'; expected '$LMS_DEMO_BRANCH'"
fi

DIRTY_COUNT="$(git -C "$LMS_PATH" status --porcelain | wc -l | tr -d ' ')"
if [[ "$DIRTY_COUNT" != "0" ]]; then
  fail "Demo clone worktree is dirty ($DIRTY_COUNT changed paths). Commit or reset before preflight."
fi

WORKFLOW_FILE="$LMS_PATH/.github/workflows/backend-ci.yml"
if [[ ! -f "$WORKFLOW_FILE" ]]; then
  fail "Missing workflow file: $WORKFLOW_FILE"
fi

WORKFLOW_NAME_LINE="$(tr -d '\r' < "$WORKFLOW_FILE" | sed -n '1p')"
if [[ "$WORKFLOW_NAME_LINE" != "name: ${PRIMARY_WORKFLOW_NAME}" ]]; then
  fail "Workflow name in $WORKFLOW_FILE is '$WORKFLOW_NAME_LINE'; expected 'name: ${PRIMARY_WORKFLOW_NAME}'"
fi

if ! tr -d '\r' < "$WORKFLOW_FILE" | grep -q 'backend/\*\*'; then
  fail "Backend CI workflow does not include backend/** path filter"
fi

PROOF_PATH="$LMS_PATH/$PROOF_COMMIT_FILE"
if [[ ! -f "$PROOF_PATH" ]]; then
  fail "Proof-commit file missing: $PROOF_PATH"
fi

if [[ -f "$FORBIDDEN_RESOLVED/.git/HEAD" ]]; then
  FORBIDDEN_HEAD="$(git -C "$FORBIDDEN_RESOLVED" rev-parse HEAD)"
  pass "Primary LMS checkout exists at $FORBIDDEN_RESOLVED (HEAD $FORBIDDEN_HEAD) and was not modified by this script"
else
  pass "Primary LMS forbidden path not present; unsafe-path guard still active"
fi

if command -v lsof >/dev/null 2>&1; then
  if lsof -nP -iTCP:"$LMS_BACKEND_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "preflight: warning: port $LMS_BACKEND_PORT is already in use" >&2
  else
    pass "Backend demo port $LMS_BACKEND_PORT is free"
  fi
fi

pass "LMS_PATH=$LMS_PATH_RESOLVED"
pass "Baseline SHA $LMS_BASELINE_SHA on branch $LMS_DEMO_BRANCH"
pass "Demo route $LMS_DEMO_ROUTE"
pass "Proof-commit file $PROOF_COMMIT_FILE"
pass "Minimal infra checklist: postgres (required), rabbitmq (required), redis (optional), minio (not required), mailhog (not required)"
pass "Workflow contract documented at integrations/lms/workflow-trigger-contract.md"
pass "GreenLight root $ROOT_DIR"

echo "preflight: all checks passed"
