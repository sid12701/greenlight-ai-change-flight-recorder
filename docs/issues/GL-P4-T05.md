# GL-P4-T05 — Resolve recovery against the original good baseline

## Outcome

Ensure a recovery deployment compares to the original good baseline rather than the bad version and stores the complete audit trail.

## Planning metadata

- **Phase:** 4
- **Priority:** P0
- **Component:** api
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P4-T04
- **Blocks:** GL-P5-T02, GL-P5-T05, GL-P6-T02
- **Labels:** phase:4, priority:p0, component:api, type:implementation

## Expected files

- apps/api/src/modules/regressions/baseline-resolver.ts
- apps/api/src/modules/regressions/recovery.test.ts

## Test-first contract

Follow Red–Green–Refactor. Demonstrate the expected failing test before implementation, but do not commit a failing main branch.

- [ ] Explicit baseline validation
- [ ] Newest valid baseline selection
- [ ] No/multiple candidate error
- [ ] Recovery reuses regressed row baseline
- [ ] Cross-service/environment/time rejection

## Implementation steps

- [ ] Implement resolver
- [ ] Persist baseline_deployment_id and both versions
- [ ] Set comparison_kind=recovery
- [ ] Apply recovery bounds
- [ ] Return recovery evidence

## Telemetry and integration contract

Produces recovered status from the same SigNoz source data.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] One row answers which versions were compared
- [ ] Recovery uses original window
- [ ] Ambiguity returns baseline_required
- [ ] Recovered threshold matches plan

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

Allow explicit override only after strict identity and ordering validation.

## Suggested atomic commit

`feat(api): anchor recovery to good baseline (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required tests pass, evidence is posted in the issue, no unrelated files are included, and the commit is authored under the human maintainer's verified identity without AI co-author trailers.
