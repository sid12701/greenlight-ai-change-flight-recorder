# GL-P5-T05 — Render impact, policy, recovery, and safe action states

## Outcome

Show before/after versions, p90/p95, errors, counts, transparent thresholds, recovery, and a copyable—but never executed—revert command.

## Planning metadata

- **Phase:** 5
- **Priority:** P0
- **Component:** web
- **Estimate:** 105 focused minutes
- **Depends on:** GL-P5-T04, GL-P4-T05
- **Blocks:** GL-P6-T01
- **Labels:** phase:5, priority:p0, component:web, type:implementation

## Expected files

- apps/web/src/features/receipts/ImpactCards.tsx
- apps/web/src/features/receipts/RecoveryPanel.tsx
- apps/web/src/features/receipts/Actions.tsx

## Test-first contract

Follow Red–Green–Refactor. Demonstrate the expected failing test before implementation, but do not commit a failing main branch.

- [ ] Boundary display tests, insufficient state, latency-only mode, recovered state, clipboard failure, and no-causation caveat

## Implementation steps

- [ ] Write component tests
- [ ] Build metric cards
- [ ] Show sample counts and policy
- [ ] Suppress unchanged error headline in latency-only mode
- [ ] Add recovery comparison
- [ ] Implement copy action

## Telemetry and integration contract

Shows representative SigNoz traces and dashboard links.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Every number names its compared version
- [ ] Insufficient data is not healthy
- [ ] No auto rollback exists
- [ ] Caveat is visible
- [ ] Copy failure is recoverable

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If clipboard permission fails, select and display the command for manual copy.

## Suggested atomic commit

`feat(web): show impact and recovery evidence (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required tests pass, evidence is posted in the issue, no unrelated files are included, and the commit is authored under the human maintainer's verified identity without AI co-author trailers.
