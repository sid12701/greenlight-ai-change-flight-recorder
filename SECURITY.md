# Security

## Reporting

Do not open a public issue containing credentials, tokens, borrower data, or exploitable details. Contact the repository owner privately.

## Project rules

- Bind the GreenLight API to `127.0.0.1` by default.
- Require bearer authentication for mutation routes.
- Use fine-grained, read-only GitHub access.
- Keep SigNoz and GitHub credentials in local environment files.
- Never collect raw prompts, transcripts, source contents, request bodies, or real financial data.
- Use synthetic LMS identities and portfolios exclusively.
- Treat commit trailers, URLs, timestamps, and trace context as untrusted input.
- GreenLight never performs an automatic rollback.
- Soft reset must preserve Claude and CI evidence.

## Claude Code telemetry

- Source configuration from `instrumentation/claude-code/env.example` only.
- Require `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1` and `OTEL_TRACES_SAMPLER=always_on`.
- Keep `OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_TOOL_DETAILS`, and `OTEL_LOG_TOOL_CONTENT` set to `0`.
- Export traces via OTLP HTTP to the local SigNoz collector (`http://localhost:4318`).
- Pin and document the verified `claude --version` in README; do not assume beta behavior across versions.
- Validate the contract with `bash scripts/verify-claude-telemetry.sh` before rehearsal.

## Before every push

Inspect staged files and run a secret scan. Do not commit `.env`, database files, logs, generated traces, or screenshots containing credentials.
