# GL-P3-T04 — Emit labeled reconstructed workflow, job, and step spans

## Outcome

Reconstruct completed GitHub runs as auditable OpenTelemetry traces using GitHub timestamps and explicit provenance labels.

## Planning metadata

- **Phase:** 3
- **Priority:** P0
- **Component:** telemetry
- **Estimate:** 120 focused minutes
- **Depends on:** GL-P3-T02, GL-P3-T03
- **Blocks:** GL-P3-T05
- **Labels:** phase:3, priority:p0, component:telemetry, type:implementation

## Expected files

- apps/api/src/modules/ci-telemetry/synthesizer.ts
- apps/api/src/modules/ci-telemetry/synthesizer.test.ts

## Test-first contract

Follow Red–Green–Refactor. Demonstrate the expected failing test before implementation, but do not commit a failing main branch.

- [ ] In-memory exporter proves hierarchy, UTC timestamps, durations, status mapping, attributes, and forced flush
- [ ] Re-sync skips already emitted trace IDs

## Implementation steps

- [ ] Create workflow root and job/step contexts
- [ ] Use original start/end epoch nanos
- [ ] Prefix root Reconstructed GitHub Actions:
- [ ] Add source/origin/reconstructed-at attributes
- [ ] Persist emitted trace ID

## Telemetry and integration contract

OTLP HTTP exports reconstructed CI traces to SigNoz.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Trace matches fixture timing
- [ ] Failed/cancelled conclusions map to error
- [ ] Every root is visibly reconstructed
- [ ] Emission is idempotent

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If post-hoc timestamps are rejected, capture the SDK limitation and use explicit span events without hiding the change.

## Suggested atomic commit

`feat(telemetry): reconstruct GitHub Actions traces (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required tests pass, evidence is posted in the issue, no unrelated files are included, and the commit is authored under the human maintainer's verified identity without AI co-author trailers.
