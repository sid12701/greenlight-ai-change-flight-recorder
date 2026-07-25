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
  an ambiguous wall-clock one.
- **Custom metrics** carry what traces cannot express: verdicts decided by
  status and route, AI verification states, job queue depth, and dependency
  availability. Queue depth reports zero for drained states, because a gauge
  that stops emitting is indistinguishable from a collector that stopped.
- **Logs** ship from the API and worker over OTLP with trace context, so a log
  line resolves to its span. Worker jobs that name a commit carry `commit_sha`,
  because an investigator arrives holding a commit, not a job ID.
- **Dashboards** — three, fourteen panels, imported through the API and checked
  by replaying the query the renderer actually sends.
- **Alerts** — a true error-rate rule: errored spans over all spans as a
  Query Builder v5 formula, evaluated against the same guardrail the regression
  policy uses.
- **MCP** — GreenLight asks the SigNoz MCP server the same questions an
  investigating agent would, over streamable HTTP. The capture has no
  direct-API fallback, so a recorded transcript can only have come from MCP.
- The whole stack is pinned by manifest digest and verified at runtime before
  the demo is permitted to claim anything.

## Hackathon experience

The most useful thing this build did was refuse to let me assume.

Three candidate ways to cause a regression were tested and rejected by
measurement rather than by argument: a connection-pool limit that never became
the bottleneck under paced load, a latency change real enough to see but below
an absolute threshold that exists for good reason, and two dependency
misconfigurations that fail at startup and so are failed deployments rather
than regressions.

Running the thing end to end also found three defects that no amount of reading
would have: a load generator that ignored its own duration flag and measured
itself, a deployment health check that could never have passed inside a
container, and an evidence bug where a missing AI trailer was reported as a
malformed one — the worst of the three, in a project whose entire purpose is
not overstating evidence.

## Known limitations, stated plainly

- The recorded error-rate regression comes from a genuine PostgreSQL outage
  inside the candidate's measured window. GreenLight reports the correlation
  between the deployed version and the failures; it does not claim the commit
  caused them, and every receipt says so.
- AI verification shows `missing` for the recorded commits. Marking a change
  `verified` requires a Claude Code session exporting telemetry to SigNoz so
  the exact span resolves; the recorded commits were not authored in such a
  session, and the receipt reports that rather than implying a link.
