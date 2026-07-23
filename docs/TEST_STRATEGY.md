# Test Strategy

## Principle

Every tracer bullet follows Red–Green–Refactor:

1. Write the smallest deterministic test for the slice.
2. Run it and verify it fails for the expected reason.
3. Implement the minimum behavior.
4. Run the focused test.
5. Refactor and run the relevant regression gates.
6. Post test evidence on the GitHub issue before closing it.

A failing test is not committed to `main`. Tests are never deleted, weakened, or skipped merely to make a change pass.

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

## Playwright

Playwright is optional and non-blocking:

- Cache the browser and prepare the generic harness early.
- Add only one thin happy path after the actual UI exists.
- Do not delay a verified submission to debug browser flakiness.

## Critical contracts

- Exactly one `Backend CI` run is primary for a change.
- Reconstructed spans are explicitly labeled.
- Only the primary CI root links to the Claude span.
- No evaluation below 200 completed spans.
- Recovery reuses the original good baseline.
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
