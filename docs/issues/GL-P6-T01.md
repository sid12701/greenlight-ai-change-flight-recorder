# GL-P6-T01 — Create the deterministic bad LMS change and incident window

## Outcome

Produce a traced N+1/repeated-query commit that passes functional CI but reliably crosses the transparent latency policy under synthetic load.

## Planning metadata

- **Phase:** 6
- **Priority:** P0
- **Component:** lms
- **Verification:** smoke_verified
- **Estimate:** 120 focused minutes
- **Depends on:** GL-P2-T04, GL-P4-T04
- **Blocks:** GL-P6-T02, GL-P7-T01
- **Labels:** phase:6, priority:p0, component:lms, type:implementation

## Expected files

- integrations/lms/patches/regression.patch
- scripts/demo-regression.sh
- docs/EVIDENCE_LOG.md

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Existing LMS functional tests remain green
- [ ] Load rehearsal crosses latency policy twice
- [ ] JDBC child count explains slowdown
- [ ] Optional timeout error band is bounded

## Implementation steps

- [ ] Apply prepared change through Claude trace path
- [ ] Commit while retaining the AI-Traceparent trailer; never clean it under the GreenLight human-only commit policy
- [ ] Push and sync primary CI
- [ ] Deploy candidate role
- [ ] Generate 250 requests
- [ ] Evaluate live against the frozen baseline_deployment_id
- [ ] Capture slow traces

## Telemetry and integration contract

LMS and reconstructed CI telemetry land in SigNoz; evaluation runs live.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Bad SHA is immutable and retains its AI-Traceparent trailer
- [ ] CI is green
- [ ] Regression is repeatable against the frozen baseline
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

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
