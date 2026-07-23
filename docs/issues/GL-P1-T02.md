# GL-P1-T02 — Export one versioned LMS request trace with JDBC children

## Outcome

Send a real home-overview request through the Java agent and prove its trace carries the exact baseline commit SHA.

## Planning metadata

- **Phase:** 1
- **Priority:** P0
- **Component:** lms
- **Verification:** smoke_verified
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P1-T01
- **Blocks:** GL-P1-T03, GL-P4-T01
- **Labels:** phase:1, priority:p0, component:lms, type:implementation

## Expected files

- instrumentation/lms-java-agent/env.example
- integrations/lms/deploy.sh
- integrations/lms/verify.sh

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Deploy script rejects non-40-character SHAs
- [ ] Health gate uses /actuator/health
- [ ] Verification fails when service.version differs

## Implementation steps

- [ ] Pin Java agent version
- [ ] Build clean LMS backend
- [ ] Run on 8081 with always_on sampling
- [ ] Call authenticated synthetic route
- [ ] Find server and JDBC spans in SigNoz

## Telemetry and integration contract

OTLP HTTP/protobuf to localhost:4318 with service/version/environment resource attributes.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] service.name is lms-backend
- [ ] service.version equals full baseline SHA
- [ ] environment is hackathon-demo
- [ ] At least one JDBC child is visible
- [ ] No real data is emitted

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If readiness groups are explicitly enabled they may be checked additionally; /actuator/health remains the required gate.

## Suggested atomic commit

`feat(lms): export versioned baseline traces (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
