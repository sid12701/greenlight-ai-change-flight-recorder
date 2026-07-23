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

## Before every push

Inspect staged files and run a secret scan. Do not commit `.env`, database files, logs, generated traces, or screenshots containing credentials.
