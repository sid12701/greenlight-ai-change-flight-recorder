# GL-P0-T02 — Create isolated LMS demo workspace and minimal runtime preflight

## Outcome

Prove the demo can use the existing LMS without touching its dirty checkout and without starting unnecessary infrastructure.

## Planning metadata

- **Phase:** 0
- **Priority:** P0
- **Component:** lms
- **Verification:** smoke_verified
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P0-T01
- **Blocks:** GL-P1-T01
- **Labels:** phase:0, priority:p0, component:lms, type:implementation

## Expected files

- integrations/lms/README.md
- integrations/lms/demo-config.example
- integrations/lms/workflow-trigger-contract.md
- scripts/preflight.sh

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Preflight fails when LMS_PATH points at /Users/siddhant/Desktop/lms
- [ ] Preflight confirms baseline SHA and clean demo worktree
- [ ] Dependency checklist identifies only services used by home overview
- [ ] Workflow-trigger check records Backend CI on.push paths and proves the planned no-op backend file matches them

## Implementation steps

- [ ] Create a clean clone/worktree at baseline commit
- [ ] Create greenlight-demo branch
- [ ] Inspect home-overview runtime dependencies
- [ ] Record minimal compose services and port 8081
- [ ] Inspect Backend CI workflow name and push/path filters
- [ ] Choose a harmless backend file that is guaranteed to trigger Backend CI
- [ ] Verify original LMS status is unchanged

## Telemetry and integration contract

No telemetry yet; output the exact service and route that Phase 1 will instrument.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Original LMS worktree hash/status remains unchanged
- [ ] Clean demo worktree is pinned and documented
- [ ] Only required infrastructure is selected
- [ ] Backend CI trigger contract and proof-commit path are recorded
- [ ] Preflight exits non-zero on unsafe paths

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If LMS cannot be isolated in 45 minutes, create the documented minimal fixture path without modifying the original checkout.

## Suggested atomic commit

`chore(lms): isolate demo workload and preflight (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
