# LMS demo workload integration

The Bhawana LMS is a **pre-existing monitored workload**. GreenLight never modifies the maintainer's primary checkout. All hackathon demo work runs in an isolated clone documented here.

## Paths

| Path | Role |
|---|---|
| `/Users/siddhant/Desktop/lms` | **Forbidden** as `LMS_PATH` — primary maintainer checkout |
| `/Users/siddhant/Desktop/lms-greenlight-demo` | Default isolated demo clone for GreenLight |

## Pinned versions

| Field | Value |
|---|---|
| Baseline commit (frozen demo anchor) | `2269d064f0be50e7f6485c0be38e3cdcef6137d2` (July 16, 2026) |
| Demo branch | `greenlight-demo` |
| Upstream `main` at isolation time | `bfd571f3bc1a22c6e4c7d411c7a447cfffe8a7e0` (one commit after baseline; not used for the demo anchor) |

The demo clone is intentionally checked out at the documented baseline SHA so provenance, telemetry `service.version`, and judge reproduction stay aligned with [PROVENANCE.md](../../PROVENANCE.md).

## Target route

```text
GET /api/v1/internal/home/overview
```

Backend listens on port **8081** during the hackathon demo (SigNoz UI uses 8080).

## Create the demo clone

Run once from any directory:

```bash
git clone /Users/siddhant/Desktop/lms /Users/siddhant/Desktop/lms-greenlight-demo
cd /Users/siddhant/Desktop/lms-greenlight-demo
git checkout 2269d064f0be50e7f6485c0be38e3cdcef6137d2
git checkout -b greenlight-demo
```

Verify:

```bash
export LMS_PATH=/Users/siddhant/Desktop/lms-greenlight-demo
bash /Users/siddhant/Desktop/hackathon/scripts/preflight.sh
```

## Minimal infrastructure (home overview)

Phase 1 will empirically confirm startup requirements. Preflight documents the expected minimum from code and LMS README inspection:

| Service | Required | Notes |
|---|---|---|
| PostgreSQL | Yes | `HomeDashboardService` reads via JPA repositories |
| RabbitMQ | Yes | Local profile defaults to `localhost:5672` |
| Redis | No (default) | `app.rate-limit.enabled=false` in `application-local.yml` |
| MinIO | No | Home overview does not touch document storage |
| Mailhog | No | Not on the home-overview read path |

Start only these compose services unless Phase 1 proves otherwise:

```bash
docker compose -f infra/docker-compose.yml up -d postgres rabbitmq
```

## Configuration

Copy [demo-config.example](demo-config.example) values into your local `.env` or shell environment. See [workflow-trigger-contract.md](workflow-trigger-contract.md) for Backend CI proof-commit rules.

## Judge access

The LMS repository may remain private. If judges cannot access the demo branch, GreenLight will document the one-hour minimal HTTP fixture fallback described in [docs/OPEN_DECISIONS.md](../../docs/OPEN_DECISIONS.md).
