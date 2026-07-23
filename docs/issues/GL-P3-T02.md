# GL-P3-T02 — Normalize recorded GitHub Actions fixtures

## Outcome

Fetch and normalize commit, workflow, job, and step metadata without storing raw job logs.

## Planning metadata

- **Phase:** 3
- **Priority:** P0
- **Component:** github
- **Verification:** smoke_verified
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P3-T01
- **Blocks:** GL-P3-T03, GL-P3-T04
- **Labels:** phase:3, priority:p0, component:github, type:implementation

## Expected files

- apps/api/src/modules/github/client.ts
- apps/api/src/modules/github/normalize.ts
- apps/api/test/fixtures/github/
- apps/api/src/modules/github/github.test.ts

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Successful, failed, cancelled, missing-timestamp, and rate-limit fixtures
- [ ] UTC offset timestamps normalize without drift
- [ ] Raw logs are never requested

## Implementation steps

- [ ] Define Zod response schemas
- [ ] Implement timeout/retry limits
- [ ] Record sanitized backend/frontend fixtures
- [ ] Normalize run/job/step hierarchy
- [ ] Test error mapping

## Telemetry and integration contract

Source timestamps later become reconstructed span timestamps.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Normalized objects retain IDs, URLs, conclusions, and timestamps
- [ ] Token is read-only and redacted
- [ ] 429/5xx behavior is bounded
- [ ] No source/job-log content stored

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

On GitHub failure, preserve last good metadata and report integration_error; never fabricate a successful run.

## Suggested atomic commit

`feat(github): normalize workflow metadata fixtures (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
