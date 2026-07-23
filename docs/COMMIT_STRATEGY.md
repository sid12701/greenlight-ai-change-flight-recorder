# Commit Strategy

## Identity

- Repository-local author and committer identity: `sid12701`.
- Use a verified email associated with that GitHub account.
- Do not alter global Git identity.
- Do not add Cursor, Claude, GPT, Codex, or another AI assistant as author, committer, or `Co-authored-by`.
- Disclose AI assistance in README and PROVENANCE instead.

GitHub contributor attribution is derived from commit metadata; it is not a repository visibility setting.

This policy applies to GreenLight authorship. It must not remove the `AI-Traceparent` product-evidence trailer from the isolated LMS demonstration commits in GL-P2-T04 and GL-P6-T01. That trailer is trace context, not a `Co-authored-by` attribution, and retaining it is part of the acceptance criteria.

## Branches

Use:

```text
agent/<issue-id-lowercase>-<short-description>
```

Example:

```text
agent/gl-p2-t03-trace-commit-hook
```

## Commits

Each tracer bullet should normally produce one coherent Conventional Commit:

```text
feat(scope): description (#123)
fix(scope): description (#123)
test(scope): description (#123)
docs(scope): description (#123)
chore(scope): description (#123)
refactor(scope): description (#123)
```

The commit must include its tests, implementation, and directly required documentation. Do not mix unrelated cleanup into the slice.

## Before committing

1. Confirm the issue is unblocked.
2. Inspect `git status -sb`.
3. Inspect the complete diff.
4. Stage explicit paths.
5. Run focused and relevant regression gates.
6. Scan for credentials and real data.
7. Verify author/committer identity.
8. Confirm no AI attribution trailers; for the two specified LMS evidence commits, separately confirm the required `AI-Traceparent` trailer remains intact.
9. Commit without `--no-verify`.
10. Post evidence to the issue after push.

## Main-branch policy

Never commit a deliberately failing Red state to `main`. The developer may observe the failing test locally or on a task branch, but the completed tracer-bullet commit must be green.
