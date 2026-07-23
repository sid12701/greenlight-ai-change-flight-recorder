# Evidence Log

Immutable upstream evidence captured during GreenLight implementation. Do not rewrite entries after Phase 3 linkage tests pass.

## GL-P2-T04 — Trace-linked LMS proof commit

| Field | Value |
|---|---|
| Status | `pending_manual_capture` |
| Repository | Isolated LMS demo clone (`LMS_PATH`) |
| Branch | `greenlight-demo` |
| Proof file | `backend/README.md` (harmless documentation-only edit) |
| Primary workflow | `Backend CI` |
| Trailer key | `AI-Traceparent` |

### Capture procedure

1. Source `instrumentation/claude-code/env.example` in the Claude Code session.
2. Install the hook: `bash instrumentation/git-hooks/install.sh "$LMS_PATH"`.
3. Ask Claude Code to edit `backend/README.md` only.
4. Commit through a Bash subprocess with `TRACEPARENT` present.
5. Push and wait for exactly one `Backend CI` run.
6. Record commit SHA, trace ID, span ID, and SigNoz trace URL below.
7. Validate with `bash scripts/verify-trace-linked-commit.sh "$LMS_PATH" <sha>`.

### Recorded evidence

```text
commit_sha:
ai_traceparent:
trace_id:
span_id:
signoz_trace_url:
github_backend_ci_run_id:
captured_at_utc:
claude_version:
```

### Verification

```bash
bash scripts/verify-trace-linked-commit.sh "$LMS_PATH" <commit_sha>
```

### GL-P3-T05 — Primary CI span link

| Field | Value |
|---|---|
| Status | `verified_in_tests` |
| Link module | `apps/api/src/modules/ci-telemetry/link.ts` |
| Synthesizer | attaches link only when `includeAiLink=true` and primary AI context is present |
| SigNoz navigation | `buildSignozTraceUrl()` generates `/trace/<traceId>?spanId=<spanId>` |

Live SigNoz click-through evidence depends on GL-P2-T04 manual capture and a completed sync run.


- Human-authored GreenLight commits must not add `Co-authored-by` AI trailers.
- LMS demonstration commits must retain `AI-Traceparent` as product evidence.
- This evidence is reused by GL-P3-T05 CI span linking and GL-P6 incident commits.
