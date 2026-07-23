# GL-P2-T01 — Enable privacy-safe Claude Code telemetry

## Outcome

Export a Claude interaction and tool-execution trace while keeping prompts, tool details, and tool content disabled.

## Planning metadata

- **Phase:** 2
- **Priority:** P0
- **Component:** telemetry
- **Verification:** smoke_verified
- **Estimate:** 60 focused minutes
- **Depends on:** GL-P1-T01
- **Blocks:** GL-P2-T02
- **Labels:** phase:2, priority:p0, component:telemetry, type:implementation

## Expected files

- instrumentation/claude-code/env.example
- docs/SECURITY.md
- scripts/verify-claude-telemetry.sh

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Environment validation requires tracing, forced propagation, always_on sampling, and content flags off
- [ ] Verification fixture rejects prompt/tool-content attributes

## Implementation steps

- [ ] Pin claude --version
- [ ] Set OTLP HTTP endpoint
- [ ] Force TRACEPARENT propagation
- [ ] Run harmless tool action
- [ ] Verify trace in SigNoz
- [ ] Inspect privacy attributes

## Telemetry and integration contract

Claude traces use OTLP HTTP and preserved W3C trace context.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] claude-code trace is visible
- [ ] TRACEPARENT exists in Bash subprocess
- [ ] Prompt/tool contents are absent
- [ ] Exact Claude version is documented

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If beta tracing fails by the linkage pivot, use the documented SessionStart session-ID fallback.

## Suggested atomic commit

`feat(telemetry): export privacy-safe Claude traces (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
