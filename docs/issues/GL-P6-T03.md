# GL-P6-T03 — Implement safe soft reset and full demo preflight

## Outcome

Reset only transient deployment/evaluation state and prove every dependency, credential presence, immutable trace, commit, route, and port before rehearsal.

## Planning metadata

- **Phase:** 6
- **Priority:** P0
- **Component:** demo
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P6-T02, GL-P4-T06
- **Blocks:** GL-P7-T02
- **Labels:** phase:6, priority:p0, component:demo, type:implementation

## Expected files

- scripts/demo-reset.sh
- scripts/preflight.sh
- scripts/demo-smoke.sh
- docs/DEMO_STATE.md

## Test-first contract

Follow Red–Green–Refactor. Demonstrate the expected failing test before implementation, but do not commit a failing main branch.

- [ ] Soft reset preserves changes/pipeline runs and SigNoz evidence
- [ ] Unsafe DB/path fails
- [ ] Hard reset requires explicit phrase
- [ ] Preflight detects missing links/ports/SHAs

## Implementation steps

- [ ] Implement allowlisted deletes
- [ ] Protect immutable tables
- [ ] Add path guards
- [ ] Check primary CI/Claude trace targets
- [ ] Check minimal services
- [ ] Print non-secret status

## Telemetry and integration contract

Validates SigNoz UI/OTLP/MCP and required evidence.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Soft reset is repeatable
- [ ] Hard reset prohibited in demo mode
- [ ] No destructive broad target
- [ ] Preflight gives actionable failures

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

Never clear SigNoz during demo window; if immutable evidence is missing, stop and use recorded backup rather than silently rebuilding.

## Suggested atomic commit

`feat(demo): add safe reset and preflight (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required tests pass, evidence is posted in the issue, no unrelated files are included, and the commit is authored under the human maintainer's verified identity without AI co-author trailers.
