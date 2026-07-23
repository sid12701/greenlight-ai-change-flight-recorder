#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK_DIR="${ROOT}/instrumentation/git-hooks"
VECTORS="${ROOT}/packages/shared/test-vectors/traceparent.json"
VALID_TRACE="00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
INVALID_TRACE="not-valid"

fail() {
  echo "git-hook test: $*" >&2
  exit 1
}

# shellcheck source=validate-traceparent.sh
. "${HOOK_DIR}/validate-traceparent.sh"

echo "git-hook test: running shared vector checks"

node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const vectors = JSON.parse(readFileSync('${VECTORS}', 'utf8'));
const validator = '${HOOK_DIR}/validate-traceparent.sh';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(input) {
  const result = spawnSync('bash', ['-c', \`. '\${validator}' && validate_traceparent \"\${input}\"\`], {
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

for (const vector of vectors.accepted) {
  const output = run(vector.input);
  if (!output) fail(\`expected accept for \${vector.id}\`);
  const expected = \`\${vector.expected.version}-\${vector.expected.traceId}-\${vector.expected.spanId}-\${vector.expected.flags}\`;
  if (output !== expected) fail(\`vector \${vector.id}: expected \${expected}, got \${output}\`);
}

for (const vector of vectors.rejected) {
  if (run(vector.input) !== null) fail(\`expected reject for \${vector.id}\`);
}

console.log('vector parity OK');
"

tmpdir="$(mktemp -d)"
trap 'rm -rf "${tmpdir}"' EXIT

setup_repo() {
  local repo="${tmpdir}/$1"
  rm -rf "${repo}"
  mkdir -p "${repo}"
  git -C "${repo}" init -q
  git -C "${repo}" config user.email "test@example.com"
  git -C "${repo}" config user.name "Test User"
  bash "${HOOK_DIR}/install.sh" "${repo}" >/dev/null
  echo "demo" > "${repo}/README.md"
  git -C "${repo}" add README.md
  echo "${repo}"
}

commit_with_trace() {
  local repo="$1"
  local trace="$2"
  local source="${3:-}"
  (
    cd "${repo}"
    export TRACEPARENT="${trace}"
    if [ -n "${source}" ]; then
      git commit --allow-empty -m "test commit" --no-verify 2>/dev/null || true
      return 0
    fi
    git commit -m "test commit"
  )
}

read_trailer() {
  git -C "$1" log -1 --format=%B | awk '/^AI-Traceparent:/ { print $2; exit }'
}

has_trailer() {
  local value
  value="$(read_trailer "$1")"
  [ -n "${value}" ]
}

echo "git-hook test: no TRACEPARENT leaves message unchanged"
repo="$(setup_repo no-trace)"
unset TRACEPARENT
git -C "${repo}" commit -m "human commit"
if has_trailer "${repo}"; then
  fail "expected no trailer without TRACEPARENT"
fi

echo "git-hook test: valid TRACEPARENT adds one trailer"
repo="$(setup_repo valid-trace)"
export TRACEPARENT="${VALID_TRACE}"
git -C "${repo}" commit -m "claude commit"
trailer="$(read_trailer "${repo}")"
[ "${trailer}" = "${VALID_TRACE}" ] || fail "expected valid trailer"

echo "git-hook test: invalid TRACEPARENT warns and commits"
repo="$(setup_repo invalid-trace)"
export TRACEPARENT="${INVALID_TRACE}"
if ! git -C "${repo}" commit -m "invalid trace commit" 2> "${tmpdir}/warn.log"; then
  fail "commit should succeed with invalid trace"
fi
grep -q "ignoring invalid TRACEPARENT" "${tmpdir}/warn.log" || fail "expected warning"
if has_trailer "${repo}"; then
  fail "invalid trace must not add trailer"
fi

echo "git-hook test: existing trailer is not duplicated"
repo="$(setup_repo duplicate)"
export TRACEPARENT="${VALID_TRACE}"
git -C "${repo}" commit -m "feat: demo

AI-Traceparent: ${VALID_TRACE}"
count="$(git -C "${repo}" log -1 --format=%B | grep -c '^AI-Traceparent:' || true)"
[ "${count}" = "1" ] || fail "expected exactly one trailer"

echo "git-hook test: merge source does not inject trailer"
repo="$(setup_repo merge)"
export TRACEPARENT="${VALID_TRACE}"
default_branch="$(git -C "${repo}" branch --show-current)"
git -C "${repo}" commit -m "base"
git -C "${repo}" checkout -q -b feature
echo "feature" >> "${repo}/README.md"
git -C "${repo}" add README.md
git -C "${repo}" commit -m "feature work"
git -C "${repo}" checkout -q "${default_branch}"
git -C "${repo}" merge --no-ff feature -m "merge feature"
if has_trailer "${repo}"; then
  fail "merge commit must not receive injected trailer"
fi

echo "git-hook test: amend preserves existing trailer"
repo="$(setup_repo amend)"
export TRACEPARENT="${VALID_TRACE}"
git -C "${repo}" commit -m "feat: demo

AI-Traceparent: ${VALID_TRACE}"
TRACEPARENT="00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01"
git -C "${repo}" commit --amend -m "feat: demo

AI-Traceparent: ${VALID_TRACE}"
trailer="$(read_trailer "${repo}")"
[ "${trailer}" = "${VALID_TRACE}" ] || fail "amend must preserve original trailer"

echo "git-hook test: all checks passed"
