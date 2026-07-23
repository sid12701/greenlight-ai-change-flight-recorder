#!/usr/bin/env bash
set -euo pipefail

TARGET_REPO="${1:-}"
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "${TARGET_REPO}" ]; then
  echo "usage: $0 <path-to-git-repo>" >&2
  exit 1
fi

if [ ! -d "${TARGET_REPO}/.git" ]; then
  echo "install: ${TARGET_REPO} is not a git repository" >&2
  exit 1
fi

mkdir -p "${TARGET_REPO}/.git/hooks"
cp "${HOOK_DIR}/prepare-commit-msg" "${TARGET_REPO}/.git/hooks/prepare-commit-msg"
cp "${HOOK_DIR}/validate-traceparent.sh" "${TARGET_REPO}/.git/hooks/validate-traceparent.sh"
chmod +x "${TARGET_REPO}/.git/hooks/prepare-commit-msg"
chmod +x "${TARGET_REPO}/.git/hooks/validate-traceparent.sh"

echo "install: prepare-commit-msg hook installed in ${TARGET_REPO}"
