# GL-P1-T03 — Freeze the observed SigNoz attribute and query contract

## Outcome

Replace assumed semantic-convention keys with keys verified from actual LMS spans and prove route/version filtering.

## Planning metadata

- **Phase:** 1
- **Priority:** P0
- **Component:** telemetry
- **Verification:** smoke_verified
- **Estimate:** 60 focused minutes
- **Depends on:** GL-P1-T02
- **Blocks:** GL-P4-T02, GL-P4-T03
- **Labels:** phase:1, priority:p0, component:telemetry, type:implementation

## Expected files

- docs/TELEMETRY_CONTRACT.md
- signoz/saved-views.md
- test/fixtures/signoz/baseline-query.json

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Fixture parser resolves observed route, version, environment, status, and JDBC keys
- [ ] Query fixture returns only the exact SHA and route

## Implementation steps

- [ ] Inspect real span attributes
- [ ] Record exact filterable keys
- [ ] Save Query Builder view URL
- [ ] Capture sanitized response fixture
- [ ] Pin Java agent version

## Telemetry and integration contract

Reviewed Query Builder v5 contract becomes the boundary for all later evaluator work.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Contract names exact observed keys
- [ ] Query isolates /api/v1/internal/home/overview
- [ ] Full SHA filter works
- [ ] Count matches the deliberately small Phase 1 sample; the 200-span verdict floor is deferred to GL-P4-T02

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If http.route is absent, document and use the actual stable key rather than rewriting data to match the plan.

## Suggested atomic commit

`docs(telemetry): freeze LMS query contract (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
