# SigNoz saved views (demo)

Filters to paste into the SigNoz explorers when investigating a change by hand.
The same scopes are what the API queries programmatically, so a view here and a
receipt's numbers describe the same spans.

## One deployed version, one route

Traces explorer:

| Field | Operator | Value |
|---|---|---|
| `service.name` | `=` | `blnk-loan-workload` |
| `deployment.environment.name` | `=` | `hackathon-demo` |
| `http.route` | `=` | `/balances` |
| `service.version` | `=` | `<commit-sha>` |

This is the exact scope a verdict is decided on. Pinning `service.version` is
what makes "before and after" a version comparison rather than an ambiguous
wall-clock one.

## Two versions side by side

Drop `service.version` from the filter above and group by it. That is the
comparison the **GreenLight — Deployment Impact** dashboard draws in its
"p95 by deployed version" panel: one series per immutable version, and the step
between them is the deployment.

## Only the failures, attributed to a version

Add `has_error` `=` `true` to the scoped filter. Counting errored spans over all
spans in the same scope is how the error-rate alert computes a true rate rather
than a raw count that would rise with traffic alone.

## A commit's log lines

Logs explorer:

| Field | Operator | Value |
|---|---|---|
| `commit_sha` | `=` | `<commit-sha>` |

Worker jobs that concern one commit carry `commit_sha`, because an investigator
arrives holding a commit rather than a job ID. From a log line, follow its trace
context to the span that emitted it.

## A reconstructed CI run

Traces explorer:

| Field | Operator | Value |
|---|---|---|
| `service.name` | `=` | `greenlight-ci` |
| `cicd.pipeline.run.id` | `=` | `<github-run-id>` |

Each reconstructed workflow is its own trace, rooted at
`Reconstructed GitHub Actions: <workflow>`, with a span per job and per step
carrying the run's real timestamps. `greenlight.telemetry.origin=reconstructed`
marks it as rebuilt from the GitHub REST API rather than emitted by the runner.

## GreenLight's own decisions

Metrics explorer:

| Metric | What it answers |
|---|---|
| `greenlight.regression.verdicts` | what has been decided, by status and route |
| `greenlight.change.ai_verification` | how many changes carry a resolvable AI link |
| `greenlight.alerts.notifications` | which SigNoz alerts reached GreenLight |
| `greenlight.jobs.queue_depth` | whether work is stuck |
| `greenlight.dependency.available` | whether GitHub, SigNoz or the database is down |
