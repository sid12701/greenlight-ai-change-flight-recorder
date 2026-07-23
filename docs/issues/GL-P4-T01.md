# GL-P4-T01 — Record versioned deployments with explicit roles

## Outcome

Persist baseline, candidate, and recovery deployments and emit versioned deployment telemetry only after application health and span visibility checks.

## Planning metadata

- **Phase:** 4
- **Priority:** P0
- **Component:** api
- **Estimate:** 75 focused minutes
- **Depends on:** GL-P3-T01, GL-P1-T02
- **Blocks:** GL-P4-T02
- **Labels:** phase:4, priority:p0, component:api, type:implementation

## Expected files

- apps/api/src/modules/deployments/
- apps/api/src/routes/deployments.ts
- integrations/lms/deploy.sh

## Test-first contract

Follow Red–Green–Refactor. Demonstrate the expected failing test before implementation, but do not commit a failing main branch.

- [ ] Auth, input validation, idempotency, role constraint, health failure, and version-visibility cases
- [ ] Only one succeeded baseline per service/environment

## Implementation steps

- [ ] Write Fastify inject tests
- [ ] Implement authenticated endpoint
- [ ] Run safe deploy command in isolated path
- [ ] Check /actuator/health
- [ ] Confirm versioned span
- [ ] Emit deployment events

## Telemetry and integration contract

Deployment spans/events use service.name, service.version, and environment attributes.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Full SHA is consistent across change/deployment/span
- [ ] Failed start is persisted failed
- [ ] Evaluation cannot start before version visibility
- [ ] No automatic rollback

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If live start timing varies, preserve a recorded successful deployment while keeping evaluation live.

## Suggested atomic commit

`feat(api): record versioned deployments (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required tests pass, evidence is posted in the issue, no unrelated files are included, and the commit is authored under the human maintainer's verified identity without AI co-author trailers.
