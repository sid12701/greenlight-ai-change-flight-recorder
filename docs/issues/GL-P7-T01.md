# GL-P7-T01 — Script and verify the agent-native SigNoz MCP investigation

## Outcome

Run one fixed MCP prompt that independently compares the bad version and returns three slow traces without claiming causation.

## Planning metadata

- **Phase:** 7
- **Priority:** P1
- **Component:** signoz
- **Verification:** smoke_verified
- **Estimate:** 75 focused minutes
- **Depends on:** GL-P6-T01, GL-P4-T03
- **Blocks:** None
- **Labels:** phase:7, priority:p1, component:signoz, type:implementation

## Expected files

- docs/MCP_DEMO.md
- docs/EVIDENCE_LOG.md
- scripts/verify-mcp-result.mjs

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Fixture validator checks service, SHA, route, windows, p95/error fields, three trace IDs, and absence of causal wording

## Implementation steps

- [ ] Add fixed prompt
- [ ] Run via SigNoz MCP
- [ ] Compare with GreenLight result
- [ ] Validate trace IDs
- [ ] Record sanitized output
- [ ] Rehearse exact narration

## Telemetry and integration contract

Uses SigNoz MCP against the same telemetry GreenLight queries.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] MCP result agrees qualitatively and numerically
- [ ] Three traces resolve
- [ ] No causal overclaim
- [ ] Prompt is fixed and repeatable

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If live MCP latency is risky, show a captured successful result after stating it is preserved; GreenLight evaluation remains live.

## Suggested atomic commit

`feat(demo): add fixed MCP investigation (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.
