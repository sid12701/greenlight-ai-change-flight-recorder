# GL-P5-T03 — Build the changes-list screen

## Outcome

Give a first-time user a scannable list of commit, AI-link, primary CI, deployment, and regression status.

## Planning metadata

- **Phase:** 5
- **Priority:** P1
- **Component:** web
- **Verification:** smoke_verified
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P5-T01
- **Blocks:** None
- **Labels:** phase:5, priority:p1, component:web, type:implementation

## Expected files

- apps/web/src/features/changes/
- apps/web/src/api/
- apps/web/src/app/routes.tsx

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Component tests for loading, empty, error, missing AI, healthy, regressed, and recovered rows
- [ ] Keyboard navigation and semantic-link tests

## Implementation steps

- [ ] Write component tests
- [ ] Add TanStack Query client
- [ ] Build responsive rows/cards
- [ ] Use text plus color for status
- [ ] Link to receipt

## Telemetry and integration contract

Frontend itself is not instrumented in MVP.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] All API states render
- [ ] Status is accessible
- [ ] No sensitive data shown
- [ ] Laptop/narrow layouts work

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If styling time expands, keep semantic HTML and status clarity; defer decorative animation.

## Suggested atomic commit

`feat(web): add changes overview (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
