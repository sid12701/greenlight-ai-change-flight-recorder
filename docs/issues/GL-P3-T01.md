# GL-P3-T01 — Create metadata-only SQLite migrations and repositories

## Outcome

Implement the normalized repository/change/pipeline/deployment/evaluation/evidence schema with primary-run and baseline auditability.

## Planning metadata

- **Phase:** 3
- **Priority:** P0
- **Component:** api
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P0-T01
- **Blocks:** GL-P3-T02, GL-P4-T01, GL-P4-T06
- **Labels:** phase:3, priority:p0, component:api, type:implementation

## Expected files

- apps/api/src/db/migrations/001_initial.sql
- apps/api/src/db/migrate.ts
- apps/api/src/db/repositories/
- apps/api/test/db.test.ts

## Test-first contract

Follow Red–Green–Refactor. Demonstrate the expected failing test before implementation, but do not commit a failing main branch.

- [ ] Fresh migration succeeds
- [ ] Repeat migration is idempotent
- [ ] One primary pipeline constraint holds
- [ ] One demo baseline constraint holds
- [ ] Foreign keys and status checks reject invalid rows

## Implementation steps

- [ ] Write migration tests
- [ ] Implement schema from authoritative plan
- [ ] Enable foreign keys
- [ ] Add transactional migration runner
- [ ] Add temporary-db repositories

## Telemetry and integration contract

GreenLight API later emits its own DB request spans; SQLite does not replace SigNoz.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] All tables/indexes exist
- [ ] Evaluation stores both versions and baseline deployment
- [ ] SQLite contains metadata only
- [ ] Tests use temporary files

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If better-sqlite3 fails on Apple Silicon, stop at the Phase 0 native-module pivot and use the documented compatible version.

## Suggested atomic commit

`feat(api): add GreenLight metadata schema (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required tests pass, evidence is posted in the issue, no unrelated files are included, and the commit is authored under the human maintainer's verified identity without AI co-author trailers.
