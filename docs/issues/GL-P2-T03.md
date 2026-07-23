# GL-P2-T03 — Install a safe prepare-commit-msg trace bridge

## Outcome

Add exactly one AI-Traceparent trailer to a normal Claude-triggered commit without changing merge, squash, or amend provenance.

## Planning metadata

- **Phase:** 2
- **Priority:** P0
- **Component:** github
- **Verification:** strict_tdd
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P2-T02
- **Blocks:** GL-P2-T04
- **Labels:** phase:2, priority:p0, component:github, type:implementation

## Expected files

- instrumentation/git-hooks/prepare-commit-msg
- instrumentation/git-hooks/install.sh
- instrumentation/git-hooks/test.sh

## Verification contract

Strict Red–Green–Refactor applies. Demonstrate the smallest deterministic failing test before implementation, but do not commit a failing main branch.

- [ ] Shell hook runs the shared vector cases
- [ ] Normal valid commit gets one trailer
- [ ] No context gets none
- [ ] Invalid context warns but commit succeeds
- [ ] merge/squash/amend add no new trailer

## Implementation steps

- [ ] Write temporary-repository tests
- [ ] Implement POSIX validator
- [ ] Inspect prepare-commit-msg source argument
- [ ] Use git interpret-trailers doNothing
- [ ] Install only in demo clone

## Telemetry and integration contract

Stores W3C context in Git metadata; emits no new telemetry.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] TS and shell validators agree
- [ ] Trailer is not duplicated
- [ ] Generated commits preserve existing provenance
- [ ] Original LMS hook directory is untouched

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If shell portability blocks progress, use a small Node hook launched by POSIX shell while retaining the same vectors.

## Suggested atomic commit

`feat(git): bridge Claude trace context to commits (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
