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

## Local verification

Use Node 24 (see `.node-version` / `.nvmrc`) and Docker with Compose. From a
fresh checkout:

```bash
npm ci
npm run verify
npm run quality
npm run validate:config
npm run validate:telemetry
npm run validate:signoz-assets
npm run test:compiled-migrations
bash instrumentation/git-hooks/test.sh
docker compose -f deploy/compose.local.yaml config --quiet
```

Start the public workload and generate a seeded baseline:

```bash
bash integrations/blnk/up.sh
```

Copy `.env.example` to `.env` and replace every placeholder. In three terminals,
start the already-built processes:

```bash
set -a; source .env; set +a
npm --workspace @greenlight/api run start

set -a; source .env; set +a
npm --workspace @greenlight/api run start:worker

npm --workspace @greenlight/web run preview
```

Then verify `http://127.0.0.1:4000/livez`,
`http://127.0.0.1:4000/readyz`, and `http://127.0.0.1:4173`. For the real
evidence chain, make this GreenLight repository public and configure its GitHub
Actions repository, SigNoz service-account, and MCP credentials; run:

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
