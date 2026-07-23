# GL-P6-T01 — Create the deterministic bad LMS change and incident window

## Outcome

Produce a traced N+1/repeated-query commit that passes functional CI but reliably crosses the transparent latency policy under synthetic load.

## Planning metadata

- **Phase:** 6
- **Priority:** P0
- **Component:** lms
- **Estimate:** 120 focused minutes
- **Depends on:** GL-P2-T04, GL-P4-T04, GL-P5-T05
- **Blocks:** GL-P6-T02, GL-P7-T01
- **Labels:** phase:6, priority:p0, component:lms, type:implementation

## Expected files

- integrations/lms/patches/regression.patch
- scripts/demo-regression.sh
- docs/EVIDENCE_LOG.md

## Test-first contract

Follow Red–Green–Refactor. Demonstrate the expected failing test before implementation, but do not commit a failing main branch.

- [ ] Existing LMS functional tests remain green
- [ ] Load rehearsal crosses latency policy twice
- [ ] JDBC child count explains slowdown
- [ ] Optional timeout error band is bounded

## Implementation steps

- [ ] Apply prepared change through Claude trace path
- [ ] Commit and push
- [ ] Sync primary CI
- [ ] Deploy candidate role
- [ ] Generate 250 requests
- [ ] Evaluate live
- [ ] Capture slow traces

## Telemetry and integration contract

LMS and reconstructed CI telemetry land in SigNoz; evaluation runs live.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Bad SHA is immutable
- [ ] CI is green
- [ ] Regression is repeatable
- [ ] Evidence is synthetic and privacy-safe
- [ ] No threshold tuned to a lucky run

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

After one hour use disclosed fault flag; after 30 minutes of unstable errors switch to honest latency-only framing.

## Suggested atomic commit

`feat(demo): create observable LMS regression (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required tests pass, evidence is posted in the issue, no unrelated files are included, and the commit is authored under the human maintainer's verified identity without AI co-author trailers.
