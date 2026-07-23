# GL-P1-T01 — Validate Foundry casting and start SigNoz with MCP

## Outcome

Create a reproducible SigNoz installation whose UI, OTLP HTTP receiver, and MCP health endpoints are available, and retire the backdated-span risk before CI synthesis begins.

## Planning metadata

- **Phase:** 1
- **Priority:** P0
- **Component:** signoz
- **Verification:** smoke_verified
- **Estimate:** 110 focused minutes
- **Depends on:** GL-P0-T02
- **Blocks:** GL-P1-T02, GL-P2-T01, GL-P4-T06
- **Labels:** phase:1, priority:p0, component:signoz, type:implementation

## Expected files

- casting.yaml
- casting.yaml.lock
- signoz/README.md
- scripts/signoz-smoke.sh
- scripts/backdated-span-smoke.mjs

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Casting schema passes foundryctl gauge
- [ ] Smoke test checks UI 8080, OTLP HTTP 4318, and MCP livez 8000
- [ ] Port 4317 is not treated as required
- [ ] A span timestamped two hours in the past is accepted over OTLP HTTP and discoverable in SigNoz

## Implementation steps

- [ ] Add official Foundry casting
- [ ] Run gauge before forge
- [ ] Generate and inspect lock
- [ ] Cast services
- [ ] Create service-account setup instructions
- [ ] Run health smoke
- [ ] Run a 20-minute backdated-span spike and record the query/evidence

## Telemetry and integration contract

SigNoz is the telemetry source of truth; gRPC 4317 is an unused default listener.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] casting.yaml and generated lock are committed
- [ ] SigNoz UI responds
- [ ] OTLP HTTP accepts current and backdated telemetry
- [ ] The two-hour-old span is visible with the supplied timestamps
- [ ] MCP livez responds
- [ ] No credentials are committed

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If cast is blocked, use Foundry-generated compose for local progress but keep successful Foundry output mandatory for submission.

## Suggested atomic commit

`chore(signoz): add reproducible Foundry stack (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
