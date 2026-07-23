# GL-P2-T02 — Implement shared W3C traceparent vectors and TypeScript parser

## Outcome

Create one canonical accepted/rejected vector set and a typed parser that cannot accept malformed or all-zero contexts.

## Planning metadata

- **Phase:** 2
- **Priority:** P0
- **Component:** telemetry
- **Estimate:** 75 focused minutes
- **Depends on:** GL-P2-T01
- **Blocks:** GL-P2-T03
- **Labels:** phase:2, priority:p0, component:telemetry, type:implementation

## Expected files

- packages/shared/src/traceparent.ts
- packages/shared/test-vectors/traceparent.json
- packages/shared/src/traceparent.test.ts

## Test-first contract

Follow Red–Green–Refactor. Demonstrate the expected failing test before implementation, but do not commit a failing main branch.

- [ ] Red tests cover version, length, hex, zeros, flags, whitespace, missing and duplicate trailers
- [ ] Parser returns structured errors without leaking input

## Implementation steps

- [ ] Write vectors first
- [ ] Implement Zod/typed result contract
- [ ] Normalize lowercase
- [ ] Split trace/span/flags
- [ ] Run focused and workspace tests

## Telemetry and integration contract

Creates SpanContext inputs used by the CI span link.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Every vector has expected result
- [ ] Only version 00 accepted
- [ ] All-zero IDs rejected
- [ ] No tracestate stored
- [ ] Public contract is documented

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

Invalid context never blocks CI sync; it records ai_link_status=invalid.

## Suggested atomic commit

`test(trace): define traceparent contract and parser (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required tests pass, evidence is posted in the issue, no unrelated files are included, and the commit is authored under the human maintainer's verified identity without AI co-author trailers.
