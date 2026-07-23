# GL-P4-T04 — Evaluate transparent latency and error regression policy

## Outcome

Compute healthy, regressed, or insufficient status using explicit windows, 200-span floor, and transparent thresholds.

## Planning metadata

- **Phase:** 4
- **Priority:** P0
- **Component:** api
- **Estimate:** 120 focused minutes
- **Depends on:** GL-P4-T03
- **Blocks:** GL-P4-T05, GL-P5-T01, GL-P6-T01
- **Labels:** phase:4, priority:p0, component:api, type:implementation

## Expected files

- apps/api/src/modules/regressions/evaluator.ts
- apps/api/src/modules/regressions/evaluator.test.ts
- apps/api/src/routes/regressions.ts

## Test-first contract

Follow Red–Green–Refactor. Demonstrate the expected failing test before implementation, but do not commit a failing main branch.

- [ ] Boundary tests for 1.5x and +250ms latency, +2pp and 5% error, sample floor, query failure, and p90 display
- [ ] 409 baseline_required test

## Implementation steps

- [ ] Write table-driven rules
- [ ] Resolve explicit/automatic baseline
- [ ] Query both windows
- [ ] Preserve raw aggregates
- [ ] Persist reasons and versions
- [ ] Return typed status

## Telemetry and integration contract

Queries SigNoz and emits greenlight.regression.status on API spans.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] No verdict below 200 spans
- [ ] Both latency conditions are required
- [ ] Error rule is exact
- [ ] Thresholds are returned to UI
- [ ] Correlation wording avoids causation

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If the controlled error band is unstable, retain latency-only status and suppress misleading error headlines.

## Suggested atomic commit

`feat(api): evaluate deployment regression (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required tests pass, evidence is posted in the issue, no unrelated files are included, and the commit is authored under the human maintainer's verified identity without AI co-author trailers.
