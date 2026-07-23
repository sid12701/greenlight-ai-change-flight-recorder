# GL-P4-T06 — Instrument GreenLight API with OpenTelemetry

## Outcome

Dogfood SigNoz by tracing GreenLight health, sync, deployment, evaluation, and receipt requests.

## Planning metadata

- **Phase:** 4
- **Priority:** P1
- **Component:** telemetry
- **Verification:** smoke_verified
- **Estimate:** 60 focused minutes
- **Depends on:** GL-P3-T01, GL-P1-T01
- **Blocks:** None
- **Labels:** phase:4, priority:p1, component:telemetry, type:implementation

## Expected files

- apps/api/src/telemetry.ts
- apps/api/src/server.ts
- signoz/dashboards/greenlight-self.json

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] In-memory exporter verifies service name, route, status, error redaction, and exporter shutdown
- [ ] No auth header attributes

## Implementation steps

- [ ] Initialize SDK before Fastify
- [ ] Set service.name=greenlight-api
- [ ] Instrument HTTP
- [ ] Add safe domain attributes
- [ ] Export to 4318
- [ ] Create compact panel

## Telemetry and integration contract

OTLP HTTP/protobuf to SigNoz.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] GreenLight API appears in SigNoz
- [ ] Core requests have spans
- [ ] Secrets/body content absent
- [ ] Shutdown flushes

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If auto-instrumentation adds sensitive attributes, install a processor that redacts them before export.

## Suggested atomic commit

`feat(telemetry): trace GreenLight API (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
