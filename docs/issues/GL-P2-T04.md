# GL-P2-T04 — Produce and freeze one trace-linked LMS commit

## Outcome

Create a harmless commit through Claude Code and prove its trailer resolves to the preserved SigNoz span.

## Planning metadata

- **Phase:** 2
- **Priority:** P0
- **Component:** github
- **Estimate:** 45 focused minutes
- **Depends on:** GL-P2-T03
- **Blocks:** GL-P3-T05, GL-P6-T01
- **Labels:** phase:2, priority:p0, component:github, type:implementation

## Expected files

- docs/EVIDENCE_LOG.md
- PROVENANCE.md

## Test-first contract

Follow Red–Green–Refactor. Demonstrate the expected failing test before implementation, but do not commit a failing main branch.

- [ ] Verification script parses commit trailer and checks the target trace/span exists
- [ ] Human commit fixture remains unmodified

## Implementation steps

- [ ] Ask Claude for a harmless docs change in demo clone
- [ ] Commit through traced Bash
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

- [ ] Commit has one valid AI-Traceparent
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

This issue is done only when every acceptance item is checked, required tests pass, evidence is posted in the issue, no unrelated files are included, and the commit is authored under the human maintainer's verified identity without AI co-author trailers.
