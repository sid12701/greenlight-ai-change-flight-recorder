# GL-P4-T03 — Implement reviewed SigNoz Query Builder v5 adapter

## Outcome

Query p90, p95, error rate, request count, and representative traces through one defensive SigNoz adapter.

## Planning metadata

- **Phase:** 4
- **Priority:** P0
- **Component:** signoz
- **Verification:** strict_tdd
- **Estimate:** 120 focused minutes
- **Depends on:** GL-P1-T03, GL-P4-T02
- **Blocks:** GL-P4-T04, GL-P7-T01
- **Labels:** phase:4, priority:p0, component:signoz, type:implementation

## Expected files

- apps/api/src/modules/signoz/client.ts
- apps/api/src/modules/signoz/parsers.ts
- signoz/queries/
- apps/api/src/modules/signoz/signoz.test.ts

## Verification contract

Strict Red–Green–Refactor applies. Demonstrate the smallest deterministic failing test before implementation, but do not commit a failing main branch.

- [ ] Healthy, empty, malformed, timeout, 429, 5xx, and missing-series fixtures
- [ ] No missing value becomes numeric zero

## Implementation steps

- [ ] Version query payloads
- [ ] Template service/version/environment/route/window
- [ ] Add API-key header
- [ ] Implement timeout and one retry
- [ ] Parse typed series
- [ ] Generate deep links

## Telemetry and integration contract

Reads telemetry from SigNoz; GreenLight does not duplicate raw spans.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Reviewed payloads are version controlled
- [ ] Errors return integration_error
- [ ] Exact attributes match Phase 1 contract
- [ ] No credentials enter logs

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If v5 response shape differs, update only this adapter and fixture set.

## Suggested atomic commit

`feat(signoz): add defensive query adapter (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
