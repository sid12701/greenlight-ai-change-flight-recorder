# Submission checklist

Deadline: **26 July 2026, 05:29 IST**. Fields below are drafted so the form can
be filled by pasting. Only the two publish actions need a human.

| Field | State |
|---|---|
| Track | Track 3 — Build Your Own |
| Public GitHub link | https://github.com/sid12701/greenlight-ai-change-flight-recorder |
| `casting.yaml` + `casting.yaml.lock` | present at repository root |
| Project blog | **needs publishing** — paste `docs/BLOG.md` |
| YouTube demo (≤3 min) | **needs recording** — follow `docs/VIDEO_SCRIPT.md` |
| Project description | below |
| How SigNoz is used | below |
| Hackathon experience | below |
| Deployed link | optional; not submitted (the demo is local by design) |

---

## Project description

GreenLight is a flight recorder for AI-authored change. It ties an AI session
to a commit, its CI run, an immutable deployment, and the telemetry that
followed, then decides whether the change regressed the service and whether a
later change recovered it.

Every link in that chain is an ID that must resolve in a live SigNoz. When one
does not, the receipt says so rather than rendering a confident blank.

The monitored workload is Blnk v0.15.1, a third-party Apache-2.0 financial
ledger, fetched and verified rather than vendored. It knows nothing about
GreenLight, so a detected regression is not a regression written to be
detected.

The recorded run is three real commits with three real CI runs: a baseline, a
candidate whose one-line configuration change passed all eight CI checks and
regressed the service, and a revert that recovered it.

## How SigNoz is used

SigNoz is the evidence system, not a dashboard bolted on afterwards.

- **Traces** decide the verdict. Two Query Builder v5 queries per window return
  count, p90 and p95, plus the error count for the same scope with
  `has_error = true`. Every query is scoped to one immutable
  `service.version`, so "before and after" is a version comparison rather than
  an ambiguous wall-clock one. The Deployment Impact dashboard draws the same
  comparison by grouping on `service.version`: two series, one chart, and the
  step between them is the deployment.
- **Custom metrics** carry what traces cannot express: verdicts decided by
  status and route, AI verification states, alert notifications received, job
  queue depth, and dependency availability. Queue depth reports zero for drained
  states, because a gauge that stops emitting is indistinguishable from a
  collector that stopped.
- **Logs** ship from the API and worker over OTLP with trace context, so a log
  line resolves to its span. Worker jobs that name a commit carry `commit_sha`,
  because an investigator arrives holding a commit, not a job ID.
- **Dashboards** — three, sixteen panels, imported through the API and checked
  by replaying the query the renderer actually sends. Latency panels declare a
  nanosecond axis, so a p95 renders as `10.45 ms` rather than as `10450000`, and a
  duration panel with no declared unit fails the asset validator.
- **Alerts** — two rules that do fire, on p95 and on a true error rate computed
  as errored spans over all spans in one Query Builder v5 formula. Neither pins
  `service.version`, because a version-scoped rule can only describe a version
  that already existed when it was written; both follow whatever is deployed.
  Observed live: the p95 rule goes from `inactive` to `firing` when the regressed
  version is under load, and back to `inactive` on the revert. SigNoz refuses to
  store a rule with no notification channel, so the importer provisions one
  pointing at an authenticated GreenLight receiver.
- **MCP** — GreenLight asks the SigNoz MCP server the same questions an
  investigating agent would, over streamable HTTP. The capture has no
  direct-API fallback, so a recorded transcript can only have come from MCP.
- The whole stack is pinned by manifest digest and verified at runtime before
  the demo is permitted to claim anything.

## Hackathon experience

The most useful thing this build did was refuse to let me assume.

Running it end to end found defects that no amount of reading would have. A load
generator that ignored its own duration flag and measured itself. A deployment
health check that could never have passed inside a container. An evidence bug
where a *missing* AI trailer was reported as a *malformed* one. Reconstructed CI
traces that silently adopted the worker's active span as their parent, so several
workflow runs merged into one trace and each pipeline row recorded the sync's
trace ID instead of the run's. Receipt links built from the API's own
container-internal origin, which resolved nowhere in a reader's browser — in a
project whose thesis is that every ID resolves in a live SigNoz. Alert rules
stored with their `$service` variables unexpanded, accepted by SigNoz, listed in
the UI, and permanently unable to match a span.

The two that taught me most were about the demo rather than the code. The first:
the regression threshold required an absolute rise of 250 ms, which reads as
conservative and is actually scale-dependent — on a 1.4 ms route it demands a
174x regression before latency may be reported at all, so the real 7.3x
regression was measured, displayed, and excluded from the verdict. The second:
the demo injected a database outage inside the candidate's measured window, and
the verdict fired on that instead. Everything was disclosed and nothing was
fabricated, but the headline claim was "this change regressed the service" and
the mechanism behind the verdict was something else. Both are fixed by making the
measurement honest rather than by explaining it better: the policy now uses a
resolution floor, and fault injection lives in its own clearly-named scenario.

## Known limitations, stated plainly

- AI verification shows `missing` for the recorded commits. Marking a change
  `verified` requires a Claude Code session exporting telemetry to SigNoz so the
  exact span resolves; the recorded commits were not authored in such a session,
  and the receipt reports that rather than implying a link. `docs/AI_LINK.md` is
  the procedure, and `npm run ai-link:verify` reports which of the four links —
  hook, telemetry exports, session context, spans in SigNoz — is not yet armed.
- SigNoz's alert rules fire, but this stack was never observed **delivering** a
  notification to the configured webhook, even with a rule firing continuously
  for several minutes. The receiver itself is verified — it authenticates, and
  records each notification as a log with trace context and as a
  `greenlight.alerts.notifications` metric — so what is unproven is SigNoz's
  dispatch, not GreenLight's handling of it. Stated rather than glossed, because
  a channel that exists is not the same as a notification that arrived.
- The verdict is computed for one route on one service. The query scope is
  already parameterised on service, version, environment and route; the real
  constraint on breadth is baseline selection, which today is the previously
  frozen good deployment rather than a rolling window of healthy versions.
