# Test Strategy

## Principle

Verification effort follows the risk:

- `strict_tdd` is required for logic-heavy slices where boundary correctness matters and fixtures are cheap. Write the smallest deterministic failing test, implement the minimum behavior, refactor, and run the relevant regression gates.
- `smoke_verified` is used for infrastructure and live-integration slices. Write a deterministic validation script or fixture check first where practical, capture the expected failure before configuration, then capture the passing endpoint/trace evidence. Do not create a unit-test seam solely to satisfy ceremony.

The strict-TDD set is GL-P0-T01, GL-P2-T02, GL-P2-T03, GL-P3-T01, GL-P3-T03, GL-P3-T04, GL-P4-T03, GL-P4-T04, GL-P4-T05, and GL-P5-T02. The issue manifest is authoritative.

A failing test or broken smoke gate is not committed to `main`. Tests and verification scripts are never deleted, weakened, or skipped merely to make a change pass.

## Required gates

| Area | Gate |
|---|---|
| Shared logic | Vitest unit tests |
| Fastify routes | Fastify `inject` with temporary SQLite |
| Database | Fresh/idempotent migrations, constraints, foreign keys |
| Git bridge | Temporary Git repositories and shared traceparent vectors |
| GitHub integration | Recorded sanitized REST fixtures |
| Telemetry synthesis | In-memory OpenTelemetry exporter |
| Time handling | UTC offset → epoch ms → epoch ns round-trip |
| Regression policy | Table-driven boundaries and insufficient-data cases |
| Web | React component and accessibility tests |
| LMS changes | Existing Maven backend tests |
| Delivery | Typecheck and production build |
| Live integration | SigNoz, OTLP HTTP, MCP, versioned LMS trace smoke |

These gates remain required where the corresponding feature is in scope. A P1 feature that is formally cut is documented in the submission checklist rather than represented as passing.

## Playwright

Playwright is optional and non-blocking:

- Cache the browser and prepare the generic harness early.
- Add only one thin happy path after the actual UI exists.
- Do not delay a verified submission to debug browser flakiness.

## Critical contracts

- Exactly one `Backend CI` run is primary for a change.
- The proof commit touches a harmless backend path known to trigger `Backend CI`.
- SigNoz accepts and displays a deliberately backdated span before CI synthesis begins.
- Reconstructed spans are explicitly labeled.
- Only the primary CI root links to the Claude span.
- No evaluation below 200 completed spans.
- Candidate and recovery evaluations reuse one frozen original good baseline.
- Integration failures never become zero metrics.
- All timestamps are UTC.
- Soft reset preserves immutable Claude and CI evidence.
- Correlation language never claims causation.

## Evidence format

Each issue-closing comment includes:

```text
Tests:
- <command>
- <result>

Telemetry/API evidence:
- <trace, query, endpoint, or fixture ID>

Limitations/fallback:
- <none or explicit note>

Next unblocked issue:
- <issue ID>
```
