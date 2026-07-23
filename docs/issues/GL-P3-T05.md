# GL-P3-T05 — Attach a navigable Claude span link to the primary CI trace

## Outcome

Link the asynchronous primary CI root to the exact Claude tool-execution span stored in the commit trailer.

## Planning metadata

- **Phase:** 3
- **Priority:** P0
- **Component:** telemetry
- **Verification:** smoke_verified
- **Estimate:** 75 focused minutes
- **Depends on:** GL-P2-T04, GL-P3-T04
- **Blocks:** GL-P5-T02
- **Labels:** phase:3, priority:p0, component:telemetry, type:implementation

## Expected files

- apps/api/src/modules/ci-telemetry/link.ts
- apps/api/src/modules/ci-telemetry/link.test.ts
- docs/EVIDENCE_LOG.md

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Valid trailer creates one Link
- [ ] Missing/invalid trailers create none and preserve sync
- [ ] Secondary workflow receives no AI link
- [ ] Link targets exact trace/span IDs

## Implementation steps

- [ ] Parse trailer
- [ ] Create remote SpanContext
- [ ] Attach link at root creation
- [ ] Export to SigNoz
- [ ] Click Links tab to source trace
- [ ] Record evidence

## Telemetry and integration contract

This is the core cross-trace evidence chain.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] SigNoz link is clickable
- [ ] Target Claude trace is preserved
- [ ] Primary-only rule holds
- [ ] Fallback linkage is labeled

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

At the named pivot, freeze session-ID fallback rather than consuming submission time on beta behavior.

## Suggested atomic commit

`feat(telemetry): link primary CI trace to Claude (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
