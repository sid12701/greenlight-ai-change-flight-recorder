#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_DIR="${BLNK_SOURCE_PATH:-${ROOT}/.workloads/blnk}"
REPOSITORY="https://github.com/blnkfinance/blnk.git"
TAG="v0.15.1"
REVISION="c8fce93af4df6b1edb46ca97e570c55beff4cef9"
PATCH_FILE="${ROOT}/integrations/blnk/patches/otel-resource.patch"

fail() {
  echo "blnk-fetch: error: $*" >&2
  exit 1
}

verify_checkout() {
  [[ -d "${SOURCE_DIR}/.git" ]] || fail "checkout missing at ${SOURCE_DIR}"
  [[ "$(git -C "$SOURCE_DIR" remote get-url origin)" == "$REPOSITORY" ]] ||
    fail "origin is not ${REPOSITORY}"
  [[ "$(git -C "$SOURCE_DIR" rev-parse HEAD)" == "$REVISION" ]] ||
    fail "HEAD is not pinned revision ${REVISION}"
  [[ "$(git -C "$SOURCE_DIR" rev-list -n 1 "$TAG")" == "$REVISION" ]] ||
    fail "tag ${TAG} does not resolve to ${REVISION}"

  git -C "$SOURCE_DIR" apply --reverse --check "$PATCH_FILE" >/dev/null 2>&1 ||
    fail "required OTel compatibility patch is not applied exactly"
  local status
  status="$(git -C "$SOURCE_DIR" status --short)"
  [[ "$status" == " M internal/traces/otel.go" ]] ||
    fail "checkout contains changes other than the approved OTel patch: ${status:-<none>}"
}

if [[ "${1:-}" == "--verify" ]]; then
  verify_checkout
  echo "blnk-fetch: verified ${TAG} at ${REVISION}"
  exit 0
fi

command -v git >/dev/null || fail "git is required"
if [[ ! -e "$SOURCE_DIR" ]]; then
  mkdir -p "$(dirname "$SOURCE_DIR")"
  git clone --filter=blob:none --no-checkout "$REPOSITORY" "$SOURCE_DIR"
  git -C "$SOURCE_DIR" fetch --depth 1 origin "refs/tags/${TAG}:refs/tags/${TAG}"
  git -C "$SOURCE_DIR" checkout --detach "$REVISION"
elif [[ ! -d "${SOURCE_DIR}/.git" ]]; then
  fail "${SOURCE_DIR} exists but is not a Git checkout"
fi

if git -C "$SOURCE_DIR" apply --reverse --check "$PATCH_FILE" >/dev/null 2>&1; then
  :
elif [[ -z "$(git -C "$SOURCE_DIR" status --short)" ]] &&
  [[ "$(git -C "$SOURCE_DIR" rev-parse HEAD)" == "$REVISION" ]]; then
  git -C "$SOURCE_DIR" apply --check "$PATCH_FILE"
  git -C "$SOURCE_DIR" apply "$PATCH_FILE"
else
  fail "existing checkout is not the clean pinned revision; move it aside and rerun"
fi

verify_checkout
echo "blnk-fetch: ready ${TAG} at ${REVISION} in ${SOURCE_DIR}"
