# GL-P5-T02 — Assemble the complete Change Receipt API

## Outcome

Produce one stable receipt containing identity, primary and related CI, deployment, measured impact, evidence, recovery, and safe actions.

## Planning metadata

- **Phase:** 5
- **Priority:** P0
- **Component:** api
- **Verification:** strict_tdd
- **Estimate:** 120 focused minutes
- **Depends on:** GL-P5-T01, GL-P4-T05, GL-P3-T05
- **Blocks:** GL-P5-T04
- **Labels:** phase:5, priority:p0, component:api, type:implementation

## Expected files

- apps/api/src/modules/receipts/assembler.ts
- apps/api/src/modules/receipts/assembler.test.ts
- apps/api/src/routes/receipts.ts

## Verification contract

Strict Red–Green–Refactor applies. Demonstrate the smallest deterministic failing test before implementation, but do not commit a failing main branch.

- [ ] Full, missing-AI, secondary-CI, insufficient, regressed, recovered, and integration-error fixtures
- [ ] GitHub links originate only from pipeline_runs

## Implementation steps

- [ ] Define receipt DTO
- [ ] Join metadata without telemetry duplication
- [ ] Use evidence_links only for SigNoz
- [ ] Include threshold/version audit fields
- [ ] Generate safe revert command

## Telemetry and integration contract

Returns SigNoz deep links and measured aggregates, not raw telemetry.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] One response answers what changed, what broke, and proof
- [ ] Versions and baseline are visible
- [ ] No causal claim
- [ ] No duplicate evidence URLs

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

On partial integration failure, return available evidence with explicit unavailable sections.

## Suggested atomic commit

`feat(api): assemble auditable change receipt (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
