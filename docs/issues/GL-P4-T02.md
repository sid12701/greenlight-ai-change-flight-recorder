# GL-P4-T02 — Generate and store an auditable good baseline anchor

## Outcome

Record the known-good SHA as role=baseline and generate a repeatable 250-request, 90-second synthetic window.

## Planning metadata

- **Phase:** 4
- **Priority:** P0
- **Component:** lms
- **Estimate:** 75 focused minutes
- **Depends on:** GL-P4-T01, GL-P1-T03
- **Blocks:** GL-P4-T03
- **Labels:** phase:4, priority:p0, component:lms, type:implementation

## Expected files

- integrations/lms/load-home-overview.mjs
- scripts/demo-baseline.sh
- apps/api/test/fixtures/signoz/good-window.json

## Test-first contract

Follow Red–Green–Refactor. Demonstrate the expected failing test before implementation, but do not commit a failing main branch.

- [ ] Load generator honors duration/concurrency and synthetic credentials
- [ ] Abort below 250 target or on real-data configuration
- [ ] Baseline record precedes candidate deployment

## Implementation steps

- [ ] Seed synthetic portfolio
- [ ] Record baseline deployment
- [ ] Run controlled load
- [ ] Capture sample count/p90/p95/error
- [ ] Store only sanitized aggregate fixture

## Telemetry and integration contract

Produces LMS request/JDBC traces in the configured baseline window.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] At least 200 completed spans
- [ ] Target 250 provides margin
- [ ] Exact baseline SHA/filter recorded
- [ ] Window is repeatable twice

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If 250 requests exceed laptop capacity, lengthen preparation time without lowering the 200-span verdict floor.

## Suggested atomic commit

`feat(demo): establish good telemetry baseline (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required tests pass, evidence is posted in the issue, no unrelated files are included, and the commit is authored under the human maintainer's verified identity without AI co-author trailers.
