# GL-P7-T02 — Freeze documentation, rehearsals, recording, and submission

## Outcome

Deliver a reproducible, provenance-safe, sub-four-minute submission with a successful backup recording and no unresolved P0 gate.

## Planning metadata

- **Phase:** 7
- **Priority:** P0
- **Component:** docs
- **Verification:** smoke_verified
- **Estimate:** 120 focused minutes
- **Depends on:** GL-P6-T03, GL-P5-T05
- **Blocks:** None
- **Labels:** phase:7, priority:p0, component:docs, type:docs

## Expected files

- README.md
- PROVENANCE.md
- docs/ARCHITECTURE.md
- docs/DEMO_SCRIPT.md
- docs/SUBMISSION_CHECKLIST.md

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Required unit/integration/component/hook/build/telemetry gates pass
- [ ] Two full rehearsals pass without edits
- [ ] Secret and synthetic-data scans pass
- [ ] Optional Playwright smoke is non-blocking

## Implementation steps

- [ ] Document reconstructed spans and prepared-load/live-analysis distinction
- [ ] Document polling and production evolution
- [ ] Run all gates
- [ ] Rehearse twice
- [ ] Record backup then final
- [ ] Verify repository access
- [ ] Submit with buffer

## Telemetry and integration contract

Final demo always shows SigNoz dashboards and links; MCP and GreenLight self-observability appear when their P1 tasks were retained.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Demo is under four minutes
- [ ] README reproduces setup
- [ ] AI assistance disclosed
- [ ] No secrets/real data
- [ ] All P0 issues closed with evidence

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If cosmetic work threatens the buffer, freeze the backup recording and submit the last verified state.

## Suggested atomic commit

`docs: finalize GreenLight hackathon submission (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
