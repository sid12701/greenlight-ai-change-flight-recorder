# GreenLight — AI Change Flight Recorder

GreenLight connects an AI coding session to the Git commit it produced, the CI run that validated it, the deployed application version, the resulting SigNoz telemetry, and the evidence that the application recovered.

The monitored loan-processing workload is the public Apache-2.0 Blnk
`v0.15.1` release, fetched at an exact commit and kept outside this repository.

## Intended submission track

GreenLight is intended for **Track 3 — Build Your Own** because it instruments an otherwise unobserved surface: the AI-authored software-delivery lifecycle, rather than the application or coding agent in isolation. It is inspired by the deployment-guardian problem described in [SigNoz issue #11657](https://github.com/SigNoz/signoz/issues/11657).

The repository does **not currently claim a completed Track 3 evidence chain**. That claim requires a verified real Claude parent span, reconstructed CI traces exported and verified in SigNoz, immutable workload deployment, exact persisted evaluation windows, and a genuine MCP call. Fixtures and direct telemetry-store diagnostics do not satisfy those gates.

## Status

GreenLight is under production-readiness remediation. The monorepo includes:

- SigNoz Foundry stack (`casting.yaml`, smoke scripts)
- Public Blnk fetch/build/seed/load/failure tooling (`integrations/blnk/`)
- GreenLight API + Web (`apps/api`, `apps/web`)
- Demo scripts (`scripts/demo-*.sh`)

## Five-minute local quickstart

Prerequisites are Node 24, Docker with Compose v2, Git, curl, OpenSSL, and
SigNoz Foundry `v0.2.16`. From a fresh checkout:

```bash
npm ci
cp .env.demo.example .env.demo
npm run demo:up
```

The first run creates private local secrets, starts the digest-pinned SigNoz
stack, and provisions its administrator. SigNoz intentionally does not expose
an API key through automation. If the command stops at that gate, follow its
single remediation message: sign in at `http://127.0.0.1:8080` with the
mode-0600 credentials in `.workloads/signoz.env`, create a service-account key,
put it in `.env.demo`, and rerun `npm run demo:up`.

The rerun fetches and verifies Blnk `v0.15.1`, seeds synthetic loan-ledger data,
and starts PostgreSQL, the GreenLight API and worker, and the Web UI. The
checked-in public Blnk repository can be read anonymously; `GITHUB_TOKEN` is
optional for this local path.

```bash
npm run demo:status
# GreenLight: http://127.0.0.1:4173
# SigNoz:     http://127.0.0.1:8080
# Blnk:       http://127.0.0.1:18081

npm run demo:down
```

`demo:down` preserves PostgreSQL, ClickHouse, Redis, and application volumes.
For repository-level verification, use Node 24 and run:

```bash
npm run verify
npm run quality
npm run validate:config
npm run validate:telemetry
npm run validate:signoz-assets
npm run test:compiled-migrations
bash instrumentation/git-hooks/test.sh
```

For the real evidence chain, make this GreenLight repository public and point
`GITHUB_REPOSITORY` and `GREENLIGHT_PRIMARY_WORKFLOW_NAME` at its Actions
workflow. Then run:

```bash
bash scripts/preflight.sh
bash scripts/signoz-smoke.sh
bash scripts/demo-full-rehearsal.sh
node scripts/capture-mcp-fixture.mjs
node scripts/verify-mcp-result.mjs
```

The complete repository and live gate is `RUN_LIVE_ACCEPTANCE=1 npm run
acceptance`. It intentionally exits non-zero when the required live evidence is
not configured. See [the operations runbook](docs/OPERATIONS.md),
[demo state](docs/DEMO_STATE.md), and
[telemetry contract](docs/TELEMETRY_CONTRACT.md).

## Intended evidence chain

```text
Claude Code trace
  → AI-Traceparent Git trailer
  → reconstructed GitHub Actions trace
  → public Blnk workload with pinned service.version
  → SigNoz regression evidence
  → GreenLight Change Receipt
  → recovery proof
```

Evidence is shown as verified only after the authoritative integration confirms it.
See [the remediation tracker](docs/REMEDIATION_TRACKER.md) for implementation
status, validation evidence, remaining external gates, risks, and rollback notes.

## AI assistance disclosure

Planning and implementation may use Codex/ChatGPT, Claude Code, Cursor, or other AI assistants. AI systems are tools, not repository authors or commit co-authors. All commits are reviewed and authored under the human maintainer's verified Git identity. See [PROVENANCE.md](PROVENANCE.md).

## License

MIT. See [LICENSE](LICENSE).
