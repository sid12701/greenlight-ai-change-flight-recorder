# GL-P5-T04 — Build the receipt evidence timeline and CI sections

## Outcome

Visualize Claude → commit → reconstructed primary CI → deployment → incident while clearly separating related workflows.

## Planning metadata

- **Phase:** 5
- **Priority:** P0
- **Component:** web
- **Verification:** smoke_verified
- **Estimate:** 120 focused minutes
- **Depends on:** GL-P5-T02
- **Blocks:** GL-P5-T05
- **Labels:** phase:5, priority:p0, component:web, type:implementation

## Expected files

- apps/web/src/features/receipts/ReceiptPage.tsx
- apps/web/src/features/receipts/EvidenceTimeline.tsx
- apps/web/src/features/receipts/CiSection.tsx

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Component tests for every timeline stage, reconstructed label, primary/related runs, broken links, and missing AI fallback

## Implementation steps

- [ ] Write fixtures/tests
- [ ] Build header and timeline
- [ ] Label reconstructed CI
- [ ] Add primary duration/slowest step
- [ ] List related workflows
- [ ] Add GitHub/SigNoz links

## Telemetry and integration contract

Displays deep links into SigNoz and GitHub.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Timeline is understandable in 30 seconds
- [ ] Reconstruction is never presented as native
- [ ] Primary workflow is explicit
- [ ] Links are keyboard accessible

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If a deep link format changes, hide only that link and retain trace/run IDs for manual lookup.

## Suggested atomic commit

`feat(web): render receipt evidence timeline (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
