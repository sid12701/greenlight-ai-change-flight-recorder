# GL-P5-T01 — Expose the changes-list API contract

## Outcome

Return the latest changes with primary CI, deployment, regression, recovery, and AI-link summaries.

## Planning metadata

- **Phase:** 5
- **Priority:** P0
- **Component:** api
- **Estimate:** 75 focused minutes
- **Depends on:** GL-P3-T03, GL-P4-T04
- **Blocks:** GL-P5-T02, GL-P5-T03
- **Labels:** phase:5, priority:p0, component:api, type:implementation

## Expected files

- apps/api/src/modules/changes/service.ts
- apps/api/src/routes/changes.ts
- packages/shared/src/contracts.ts

## Test-first contract

Follow Red–Green–Refactor. Demonstrate the expected failing test before implementation, but do not commit a failing main branch.

- [ ] Fastify inject tests for linked/missing CI, no deployment, healthy, regressed, recovered, pagination, and auth-safe errors

## Implementation steps

- [ ] Define Zod DTO
- [ ] Query normalized metadata
- [ ] Use only primary pipeline in summary
- [ ] Add related count
- [ ] Return stable ordering

## Telemetry and integration contract

Request is self-traced by greenlight-api.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Latest 20 are deterministic
- [ ] No raw prompts/diffs returned
- [ ] Primary status is unambiguous
- [ ] Failure states are explicit

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If related workflow data is absent, return empty related count rather than fabricate.

## Suggested atomic commit

`feat(api): expose change summaries (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required tests pass, evidence is posted in the issue, no unrelated files are included, and the commit is authored under the human maintainer's verified identity without AI co-author trailers.
