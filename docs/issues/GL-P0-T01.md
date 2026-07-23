# GL-P0-T01 — Bootstrap repository, provenance, and validated configuration contract

## Outcome

Produce a clean repository whose ownership, pre-existing LMS boundary, secret policy, configuration surface, and authoritative roadmap are immediately auditable.

## Planning metadata

- **Phase:** 0
- **Priority:** P0
- **Component:** docs
- **Estimate:** 60 focused minutes
- **Depends on:** None
- **Blocks:** GL-P0-T02, GL-P3-T01
- **Labels:** phase:0, priority:p0, component:docs, type:docs

## Expected files

- README.md
- PROVENANCE.md
- .env.example
- SECURITY.md
- GREENLIGHT_IMPLEMENTATION_PLAN.md

## Test-first contract

Follow Red–Green–Refactor. Demonstrate the expected failing test before implementation, but do not commit a failing main branch.

- [ ] Secret-pattern scan rejects credential-like fixtures
- [ ] Config-key inventory matches the implementation plan

## Implementation steps

- [ ] Verify sid12701 repository-local author identity
- [ ] Document pre-existing LMS baseline and AI assistance
- [ ] Add non-secret environment examples
- [ ] Link every planning artifact from README

## Telemetry and integration contract

None; this slice establishes the contract for later telemetry.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Repository contains no product implementation
- [ ] No secret or real borrower data is present
- [ ] Provenance separates LMS from GreenLight
- [ ] All planning entrypoints resolve

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

Stop if repository identity or licensing is ambiguous; record the decision in docs/OPEN_DECISIONS.md.

## Suggested atomic commit

`chore: initialize GreenLight implementation roadmap (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required tests pass, evidence is posted in the issue, no unrelated files are included, and the commit is authored under the human maintainer's verified identity without AI co-author trailers.
