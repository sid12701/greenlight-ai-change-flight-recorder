# SigNoz local stack (Foundry)

GreenLight uses self-hosted SigNoz as the telemetry system of record. This directory documents the reproducible Foundry installation required by the hackathon.

## Prerequisites

- Docker Desktop (allocate at least 4 GB RAM to Docker)
- [`foundryctl`](https://signoz.io/docs/install/docker/) at the version in
  `deploy/foundry.version` on your `PATH`
- Port **8080** free for SigNoz UI (Blnk uses **18081**)

## Install and deploy

From the repository root:

```bash
test "$(foundryctl version 2>&1 | awk '/Version:/ {print $2}')" = \
  "$(cat deploy/foundry.version)"
npm run validate:signoz-stack
foundryctl gauge -f casting.yaml
foundryctl forge -f casting.yaml
```

Commit `casting.yaml` and the generated `casting.yaml.lock`. The `pours/` directory is gitignored; regenerate it with `forge`.

The casting and lock pin the compatible semantic versions used by Foundry.
`deploy/signoz-images.env` pins those same six images to immutable manifest
digests for execution:

| Component | Version |
|---|---|
| SigNoz | `v0.134.0` |
| SigNoz OTel collector | `v0.144.6` |
| SigNoz MCP server | `v0.9.0` |
| PostgreSQL | `16.14-trixie` |
| ClickHouse server | `25.12.5` |
| ClickHouse Keeper | `25.12.5` |

The generated Compose file retains upstream demo credentials and host-wide
bindings. Start it with the checked-in safety override, locally supplied
secrets, and the committed digest file:

```bash
export SIGNOZ_POSTGRES_PASSWORD='<secret-manager-value>'
export SIGNOZ_TOKENIZER_JWT_SECRET='<at-least-32-random-bytes>'
export SIGNOZ_BOOTSTRAP_EMAIL='<root-user-email>'
export SIGNOZ_BOOTSTRAP_PASSWORD='<root-user-password>'
docker compose \
  --env-file deploy/signoz-images.env \
  -f pours/deployment/compose.yaml \
  -f deploy/signoz-compose.override.yaml \
  up -d
```

The override binds UI, MCP, and both OTLP transports to loopback, adds dependency
health ordering and resource ceilings, removes the generated PostgreSQL password,
and requires SigNoz JWT security. Production uses private networks and TLS ingress
instead of any host port.

The generated `ingester.yaml` is a complete collector pipeline. The safety
override launches it in the collector's supported static-config mode rather
than the generated OpAMP manager mode. The latter creates a random agent ID
after every container recreation and SigNoz v0.134.0 refuses a new agent until
an organization is assigned interactively, leaving OTLP ports open but
non-functional (the failure is also tracked in
[SigNoz/signoz#8548](https://github.com/SigNoz/signoz/issues/8548)). Static mode
keeps clean-machine and CI startup deterministic; the trade-off is that this
local collector is configured through versioned files rather than SigNoz's
agent-management UI.

## Endpoints

| Service | URL | Purpose |
|---|---|---|
| SigNoz UI | http://localhost:8080 | Traces, dashboards, alerts |
| OTLP HTTP | http://localhost:4318 | Primary ingestion (Claude, GreenLight, Blnk) |
| OTLP gRPC | localhost:4317 | Exposed by default; **not required** for GreenLight MVP |
| SigNoz MCP | http://localhost:8000/mcp | Agent-native investigation |
| MCP health | http://localhost:8000/livez | Smoke check |

## Service account API key

1. Open http://localhost:8080 and complete first-time setup.
2. Create a service account with read access for Query Builder and traces.
3. Copy the API key into your local `.env.demo` as `SIGNOZ_API_KEY` (never commit it).

## Dashboards and alert rules

Versioned assets live in `signoz/dashboards/` and `signoz/alerts/` and target the
SigNoz **v6 dashboard schema** and **v1 alert-rule schema**.

```bash
npm run validate:signoz-assets          # schema check, no network
SIGNOZ_API_KEY=... npm run signoz:import   # import and read back
```

`validate` is a structural check only. `import` is the authoritative gate: it
posts each asset to a real SigNoz, reads it back, and fails if the stored panel
count does not match the asset. Import requires a service-account API key with
an assigned role (Settings → Service Accounts → create account, assign
`signoz-admin`, then create a key).

Alert rules require at least one notification channel. Channel names are
environment-specific, so the assets ship with `preferredChannels: []` and the
importer fills them from `SIGNOZ_ALERT_CHANNELS` (comma-separated). Without it
the dashboards still import and the alert import is skipped with a warning.

Create a channel once per installation, then import:

```bash
curl -X POST "$SIGNOZ_URL/api/v1/channels" \
  -H "SIGNOZ-API-KEY: $SIGNOZ_API_KEY" -H 'Content-Type: application/json' \
  -d '{"name":"greenlight-webhook","webhook_configs":[{"send_resolved":true,"url":"<your-receiver>"}]}'

SIGNOZ_ALERT_CHANNELS=greenlight-webhook npm run signoz:import
```

### Known upstream gap (SigNoz v0.134.0)

The bundled web UI does not yet render v6 dashboards. Assets import correctly
and `GET /api/v1/dashboards/{id}` returns the full panel, layout and variable
tree, but the dashboard page shows its empty state. Dashboards created through
the UI in this version also fail to persist their panels, so this is an upstream
UI/API transition rather than a problem with these assets. Verify imports with
the API until the UI catches up:

```bash
curl -s "$SIGNOZ_URL/api/v1/dashboards/<id>" -H "SIGNOZ-API-KEY: $SIGNOZ_API_KEY" \
  | python3 -c 'import json,sys; print(list(json.load(sys.stdin)["data"]["data"]["spec"]["panels"]))'
```

## Smoke tests

```bash
bash scripts/signoz-smoke.sh
bash scripts/signoz-runtime-verify.sh
```

`signoz-smoke.sh` checks UI health, MCP livez, and OTLP HTTP export.
`signoz-runtime-verify.sh` additionally verifies the Foundry CLI pin, the image
digest of every running service, the SigNoz API version, MCP health, and current
OTLP ingestion.

For a disposable compatibility rehearsal, `foundryctl cast -f casting.yaml`
starts the semantic-version casting directly. The supported long-lived launch
path remains the digest-pinned Compose command above.

## Upgrade and rollback

Upgrade all compatibility pins together, regenerate the lock, resolve and
review new manifest digests, then run the repository tests and a clean
gauge/forge/runtime rehearsal. Keep the previous casting commit and database
backup until the new stack has ingested and queried traffic.

Do not attempt an in-place data-schema downgrade. If an upgrade fails, stop
writers and either roll forward to a fixed compatible stack or restore the
pre-upgrade volumes/database backup before launching the prior digest set.

## Troubleshooting

- **Port 8080 in use:** stop the conflicting process. SigNoz requires 8080;
  Blnk uses 18081.
- **Cast fails mid-start:** run `docker compose -f pours/deployment/compose.yaml up -d` after freeing conflicting ports.
- **Backdated span not visible:** wait a few seconds after export; ensure `SIGNOZ_API_KEY` is set for the query step.
