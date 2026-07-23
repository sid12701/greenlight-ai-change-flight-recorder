# GL-P6-T02 — Create and verify the recovery deployment

## Outcome

Restore the efficient query, deploy role=recovery, and prove metrics return to the original good baseline bounds.

## Planning metadata

- **Phase:** 6
- **Priority:** P0
- **Component:** lms
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P6-T01, GL-P4-T05
- **Blocks:** GL-P6-T03
- **Labels:** phase:6, priority:p0, component:lms, type:implementation

## Expected files

- integrations/lms/patches/recovery.patch
- scripts/demo-recover.sh
- docs/EVIDENCE_LOG.md

## Test-first contract

Follow Red–Green–Refactor. Demonstrate the expected failing test before implementation, but do not commit a failing main branch.

- [ ] Functional tests pass
- [ ] Recovery resolver reuses original baseline
- [ ] Two rehearsals satisfy p95/error recovery bounds

## Implementation steps

- [ ] Create corrective commit
- [ ] Push and sync primary CI
- [ ] Deploy recovery role
- [ ] Generate 250 requests
- [ ] Evaluate recovery
- [ ] Freeze evidence

## Telemetry and integration contract

Produces recovery LMS and deployment telemetry in SigNoz.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Recovery SHA is immutable
- [ ] Baseline and observed versions are persisted
- [ ] Receipt shows recovered
- [ ] Representative traces remain accessible

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If recovery misses bounds, inspect data/infra variance; do not loosen recovery thresholds to fit one run.

## Suggested atomic commit

`fix(demo): restore LMS query performance (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required tests pass, evidence is posted in the issue, no unrelated files are included, and the commit is authored under the human maintainer's verified identity without AI co-author trailers.
