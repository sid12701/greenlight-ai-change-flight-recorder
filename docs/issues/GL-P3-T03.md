# GL-P3-T03 — Select exactly one primary Backend CI run

## Outcome

Store backend and frontend runs for one change while deterministically selecting Backend CI as the deployed-artifact authority.

## Planning metadata

- **Phase:** 3
- **Priority:** P0
- **Component:** github
- **Verification:** strict_tdd
- **Estimate:** 60 focused minutes
- **Depends on:** GL-P3-T02
- **Blocks:** GL-P3-T04, GL-P5-T01
- **Labels:** phase:3, priority:p0, component:github, type:implementation

## Expected files

- apps/api/src/modules/github/primary-workflow.ts
- apps/api/src/modules/github/primary-workflow.test.ts
- apps/api/src/config.ts

## Verification contract

Strict Red–Green–Refactor applies. Demonstrate the smallest deterministic failing test before implementation, but do not commit a failing main branch.

- [ ] Zero match returns configuration error
- [ ] One match marks exactly one primary
- [ ] Multiple matches return configuration error
- [ ] Secondary Frontend CI remains related

## Implementation steps

- [ ] Add exact config key
- [ ] Implement selector
- [ ] Persist is_primary
- [ ] Enforce unique partial index
- [ ] Expose warnings in sync DTO

## Telemetry and integration contract

Only the primary run is eligible for the Claude span link.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Backend CI is primary
- [ ] Frontend CI is stored but not treated as deployment authority
- [ ] No arbitrary selection
- [ ] Receipt contract can distinguish related runs

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If the workflow is renamed, configuration must change explicitly; do not use fuzzy matching.

## Suggested atomic commit

`feat(github): designate primary backend workflow (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
