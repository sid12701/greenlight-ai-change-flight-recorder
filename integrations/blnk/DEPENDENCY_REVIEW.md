# Public loan-workload dependency review

Decision date: 2026-07-25

GreenLight uses [Blnk](https://github.com/blnkfinance/blnk) as its public,
realistic loan-processing workload. The dependency is fetched from its public
repository and built from source at the exact revision below; third-party
source is never copied into this repository.

| Field | Pinned value |
|---|---|
| Upstream repository | `https://github.com/blnkfinance/blnk.git` |
| Release | `v0.15.1` |
| Commit | `c8fce93af4df6b1edb46ca97e570c55beff4cef9` |
| Licence | Apache-2.0 |
| Local checkout | `.workloads/blnk` (ignored by Git) |

## Candidate comparison

| Candidate | Strengths | Material trade-offs | Decision |
|---|---|---|---|
| [Apache Fineract](https://github.com/apache/fineract) | Apache-2.0, mature lending APIs, OpenAPI, regular releases, official containers | The supported developer environment calls for a high-resource Java/Postgres stack; slow and fragile on a judge laptop | Rejected for demo operability |
| [Frappe Lending](https://github.com/frappe/lending) | Broad loan lifecycle, active releases, API-first, well-known ecosystem | AGPL-3.0 and a multi-service Frappe/ERPNext bench make a standalone reproducible workload substantially heavier | Rejected for licence and setup complexity |
| [Mifos X Platform](https://github.com/openMF/mifosx-platform) | MPL-2.0, lending domain depth, Docker/Kubernetes examples | Published quick-start paths use mutable development images and note architecture-specific constraints | Rejected for reproducibility |
| [Blnk](https://github.com/blnkfinance/blnk) | Apache-2.0, compact Go service, stable REST APIs, Docker support, PostgreSQL/Redis, native OpenTelemetry traces and metrics | Financial ledger core rather than a complete loan-origination UI; no upstream `SECURITY.md` was found | Selected |

Candidates were scored on licence compatibility, maintenance/release activity,
documented API and container support, lending relevance, cold-start resource
cost, stable pinning, observability fit, architecture complexity, and visible
supply-chain hygiene. A feature-rich candidate did not outrank an operable one
when its judge-laptop requirements endangered the three-minute demonstration.

The GreenLight scenario models loan disbursement and repayment through Blnk
ledgers, balances, and transactions. That is a narrower dependency than a full
LMS, but it exercises the operationally important path—authenticated financial
writes, asynchronous processing, database access, queueing, and failures—while
remaining practical for local CI and a timed hackathon demonstration.

## Maintenance, security, and architecture review

- The selected release was published on 2026-07-17 from a recent, active commit
  history.
- The release dependency graph includes current Go/OpenTelemetry packages and
  the upstream history shows ongoing dependency maintenance. CI must still scan the built image
  and Go module graph; the absence of an upstream security policy is a residual
  supply-chain risk, not evidence that vulnerabilities are absent.
- Blnk is a Go API backed by PostgreSQL and Redis. The server handles REST
  traffic and a separate worker processes queued financial transactions.
- Release `v0.15.1` exposes a `--config` option but its initialization hook
  reads `./blnk.json`. The Compose boundary therefore mounts the read-only
  config at `/tmp/blnk.json` and uses `/tmp` as the working directory; this
  avoids a second source patch and can be removed when upstream fixes the CLI.
- Secure mode is mandatory. The master key is generated locally, stored in an
  ignored `0600` env file, and supplied only at runtime.
- PostHog telemetry is explicitly disabled. OpenTelemetry observability remains
  enabled and exports to the local SigNoz OTLP endpoint.
- Typesense is disabled because search is not on the demo path. Database and
  Redis ports are not published to the host.
- GreenLight builds a non-root runtime image instead of trusting the upstream
  mutable image. Compose applies a read-only root filesystem, drops Linux
  capabilities, adds `no-new-privileges`, and constrains CPU and memory.

The upstream release did not merge standard
`OTEL_RESOURCE_ATTRIBUTES` into its OTel resource. A small, auditable patch in
`patches/otel-resource.patch` adds the standard environment resource detector,
so SigNoz receives the pinned `service.version` and deployment environment.
The fetch script verifies that this is the only local source change.

## Acceptance, rollback, and residual risk

Acceptance requires:

1. `fetch.sh --verify` proves the exact tag, SHA, origin, and one expected patch.
2. `docker compose config` resolves without mutable application source.
3. PostgreSQL becomes healthy, migrations finish, then server and worker start.
4. `/health` succeeds without authentication; financial APIs reject missing
   keys and accept the generated key.
5. `seed.mjs` creates or reuses an isolated demo ledger and two USD balances.
6. `load.mjs` can generate bounded healthy and intentional 404 traffic, while
   `failure-cycle.sh` proves a real PostgreSQL dependency outage and recovery.
7. SigNoz receives Blnk spans with the pinned revision as `service.version`.

Rollback is `down.sh`; it stops only the named GreenLight workload project and
preserves its data volume. `down.sh --volumes` performs an explicit destructive
local reset. Reverting the focused GreenLight commit removes the integration;
`.workloads/blnk` can then be deleted independently.

Residual risks are the upstream project's lack of a published security policy,
source-build time on a cold machine, and Blnk's narrower scope than a complete
loan-origination system. The exact source pin and retained local scanner reports
bound those risks for the demo; production adoption still requires an owner,
an upgrade cadence, and independent security review.
