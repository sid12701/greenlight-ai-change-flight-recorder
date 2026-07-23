# GL-P2-T04 — Produce and freeze one trace-linked LMS commit

## Outcome

Create a harmless backend no-op commit through Claude Code that is guaranteed to trigger Backend CI, and prove its retained trailer resolves to the preserved SigNoz span.

## Planning metadata

- **Phase:** 2
- **Priority:** P0
- **Component:** github
- **Verification:** smoke_verified
- **Estimate:** 45 focused minutes
- **Depends on:** GL-P2-T03
- **Blocks:** GL-P3-T05, GL-P6-T01
- **Labels:** phase:2, priority:p0, component:github, type:implementation

## Expected files

- docs/EVIDENCE_LOG.md
- PROVENANCE.md
- integrations/lms/workflow-trigger-contract.md

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Verification script parses commit trailer and checks the target trace/span exists
- [ ] Trigger check proves the changed backend path matches Backend CI filters
- [ ] Human commit fixture remains unmodified

## Implementation steps

- [ ] Use the harmless backend file selected in GL-P0-T02
- [ ] Make only a comment/no-op change through Claude
- [ ] Commit through traced Bash
- [ ] Confirm AI-Traceparent remains present and is never stripped by the human-only GreenLight commit policy
- [ ] Push and confirm exactly one Backend CI run exists
- [ ] Record SHA and trace IDs
- [ ] Open target in SigNoz
- [ ] Freeze evidence

## Telemetry and integration contract

This immutable Claude evidence is reused by later CI-link tests.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Commit has one valid retained AI-Traceparent
- [ ] The commit triggers Backend CI
- [ ] Linked span exists
- [ ] No content telemetry leaked
- [ ] Evidence IDs are recorded without secrets

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

Do not regenerate after Phase 3; if unavailable, freeze the labeled session-ID degraded mode.

## Suggested atomic commit

`docs(evidence): freeze trace-linked commit proof (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
