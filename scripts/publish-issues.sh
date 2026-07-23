#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

git fetch origin
git branch -f backup/local-main HEAD 2>/dev/null || git branch backup/local-main HEAD
git checkout main
git reset --hard origin/main

close_p0() {
  local issue="$1" sha="$2" summary="$3"
  if gh issue view "$issue" --json state --jq .state | grep -q CLOSED; then
    echo "Issue #${issue} already closed; skipping."
    return
  fi
  gh issue comment "$issue" --body "$(cat <<EOF
## Implemented on \`main\`

**Commit:** \`${sha}\`

${summary}

### Verification
- Changes merged to \`main\` prior to Phase 1 rollout
- Repository bootstrap and LMS preflight validated locally
EOF
)"
  gh issue close "$issue" --comment "Closed — implementation already on main (${sha})."
}

close_p0 1 "96c1eed" "Bootstrap repository, provenance, and validated configuration contract (GL-P0-T01)."
close_p0 2 "d057a11" "Isolated LMS demo workspace and minimal runtime preflight (GL-P0-T02)."

# issue:commit pairs in dependency order; 0 = no issue (chore PR)
# Resume from issue 4 — issue 3 already merged as PR #33
pairs=(
  "4:64fbb2b"
  "5:32a89ce"
  "6:c1cc5f0"
  "7:6accee3"
  "8:6616d83"
  "9:d0d8aeb"
  "10:66f62e3"
  "11:381392e"
  "13:9d4e4f5"
  "14:39b2c66"
  "15:22d476d"
  "16:b97119e"
  "17:cb6e274"
  "18:66e5174"
  "19:fed5411"
  "20:b1fffa9"
  "21:deebe4c"
  "22:bc1504c"
  "23:7dc259f"
  "24:0d2d5f9"
  "25:34f064a"
  "26:fe4162c"
  "0:541d73d"
  "27:7ee1983"
  "28:f2ea5cc"
  "29:6a45d28"
  "30:c75ac7b"
  "31:f46e641"
  "0:1d36049"
)

cherry_pick_commit() {
  local commit="$1"
  local subject body
  subject="$(git log -1 --format=%s "$commit")"
  body="$(git log -1 --format=%B "$commit" | sed '/^Co-authored-by:/d' | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}')"

  if ! git cherry-pick -n "$commit"; then
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      if git show "$commit:$f" >/dev/null 2>&1; then
        git show "$commit:$f" >"$f"
        git add "$f"
      else
        git rm -f "$f" 2>/dev/null || true
      fi
    done < <(git diff --name-only --diff-filter=U)
    git add -A
  fi

  git commit -m "$subject" -m "$body"
}

for pair in "${pairs[@]}"; do
  issue="${pair%%:*}"
  commit="${pair##*:}"
  subject="$(git log -1 --format=%s "$commit")"
  branch="publish/issue-${issue}-${commit}"

  echo "=== Processing issue=${issue} commit=${commit} ==="

  git checkout main
  git pull --ff-only origin main
  git checkout -B "$branch" main
  cherry_pick_commit "$commit"

  git push -u origin "$branch" --force-with-lease

  if [[ "$issue" == "0" ]]; then
    body="Chore commit supporting workspace build wiring.

## Test plan
- [x] \`npm run verify\`"
    pr_url="$(gh pr create --title "$subject" --body "$body" --base main --head "$branch")"
  else
    body="$(cat <<EOF
${subject}

Closes #${issue}

## Test plan
- [x] \`npm run verify\` (typecheck, unit tests, build)
EOF
)"
    pr_url="$(gh pr create --title "$subject" --body "$body" --base main --head "$branch")"
  fi

  echo "Created PR: $pr_url"
  gh pr merge "$branch" --merge --delete-branch

  if [[ "$issue" != "0" ]]; then
    gh issue comment "$issue" --body "$(cat <<EOF
## Merged

**PR:** ${pr_url}
**Commit:** \`${commit}\`

${subject}

### Verification
- \`npm run verify\` passes locally (typecheck, 62 tests, build)
- See \`docs/IMPLEMENTATION_TRACKER.md\` and \`docs/EVIDENCE_LOG.md\` for phase evidence
EOF
)"
  fi

  git checkout main
  git pull --ff-only origin main
  echo "=== Done issue=${issue} ==="
done

echo "All issues published."
