# Telemetry contract (observed)

Every field below was read back out of the running SigNoz rather than assumed
from the OpenTelemetry specification. Where the workload does not emit something
the specification allows, that is recorded as an absence, because a query written
against an attribute the workload never sets returns an empty result that looks
exactly like a healthy service.

Monitored workload: [Blnk](https://github.com/blnkfinance/blnk) `v0.15.1` at
commit `c8fce93`, third-party and Apache-2.0. Its instrumentation is not patched
beyond a single approved OpenTelemetry change, verified at fetch time.

## Resource attributes

| Semantic key | Observed storage | Example |
|---|---|---|
| `service.name` | `resource_string_service$$name` | `blnk-loan-workload` |
| `service.version` | `resources_string['service.version']` | full 40-char Git SHA |
| `deployment.environment.name` | `resources_string['deployment.environment.name']` | `hackathon-demo` |

`service.version` carrying the deploying commit's SHA is what makes a verdict a
version comparison rather than a wall-clock one. It is set per deployment by
`integrations/blnk/release.sh`, not by the workload's own build.

## Span attributes

| Semantic key | Observed storage | Example |
|---|---|---|
| `http.route` | `attributes_string['http.route']` | `/balances` |
| `http.response.status_code` | `response_status_code` column | `200` |

Observed absences, which GreenLight must not query on:

- **`http.request.method` is empty.** This workload's HTTP instrumentation does
  not set it, so a filter on method matches nothing. Scope is expressed with
  `http.route` alone.
- **No database child spans.** Blnk's PostgreSQL calls are not instrumented at
  `v0.15.1`, so connection churn is visible as request latency on the server span
  and not as a `db.system` span. That is why a verdict compares route-level
  p90/p95 rather than attributing time to a database span.

## Span names

| Span | Meaning |
|---|---|
| `/balances` | the evaluated route's server span; its duration is what p95 measures |
| `GetAllBalances` | the handler span beneath it |
| `/health` | readiness polling, excluded from every evaluation by the route filter |
| `deployment.started` | GreenLight's deployment marker, emitted under the workload's resource identity so it lands on the same service timeline |

`/health` outnumbers `/balances` in raw span volume, which is why every query pins
`http.route` instead of aggregating the service.

## Query Builder v5 filters

The exact scope a verdict is decided on:

```text
service.name = 'blnk-loan-workload'
  AND service.version = '<full-sha>'
  AND deployment.environment.name = 'hackathon-demo'
  AND http.route = '/balances'
```

The error scope is that same expression with `AND has_error = true`, so an error
rate is errored spans over all spans in one identical scope rather than a count
that would rise with traffic alone.

Alert rules use the same expression **without** `service.version`: a rule pinned
to one immutable version can only describe a version that already existed when the
rule was written, so it could never warn about the next deployment.

## GreenLight's own signals

| Signal | Service | What it carries |
|---|---|---|
| Traces | `greenlight-api`, `greenlight-worker` | one span per matched route template, named by the Fastify OTel plugin so `http.route` is present |
| Traces | `greenlight-ci` | one trace per reconstructed workflow run, rooted at `Reconstructed GitHub Actions: <workflow>`, marked `greenlight.telemetry.origin=reconstructed` |
| Logs | `greenlight-api`, `greenlight-worker` | OTLP with trace context; jobs about one commit carry `commit_sha` |
| Metrics | `greenlight` meter | `greenlight.regression.verdicts`, `greenlight.change.ai_verification`, `greenlight.alerts.notifications`, `greenlight.jobs.queue_depth`, `greenlight.dependency.available` |

A reconstructed CI trace is deliberately **not** a child of the sync that produced
it. It starts from an empty context, so each workflow run is its own trace; its
relationship to the AI session is carried by a span link, which is a reference
rather than a parent.

Queue-depth and dependency gauges report **zero** for states holding no rows. A
gauge that stops emitting is indistinguishable from a collector that stopped, and
telling those apart is the whole point of watching them.

## Sample floor

A verdict requires at least 200 completed spans in **both** windows. Below that
the evaluation returns `insufficient_data`, which is a distinct outcome from
`healthy` and may never present as one.

## Non-causation

Correlation across the AI session, CI, the deployment and the workload's telemetry
is temporal and version-based only. GreenLight never claims a commit caused a
regression, and every receipt says so.
