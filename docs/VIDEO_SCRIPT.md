# Demo video script — 3:00 maximum

The submission form caps the video at three minutes and asks it to cover the
project, the architecture and technology, and preferably a demo.

Narration below is written to be read at roughly 150 words per minute, which is
an unhurried pace. Total is about 400 words, leaving headroom. **Read it slower
than feels natural** — the most common way this runs over is rushing and then
re-recording.

## Before recording

```bash
npm run demo:up        # all five health checks must pass
npm run demo:status    # confirm before hitting record
```

Have these open in tabs, in this order:

1. `http://127.0.0.1:4173` — GreenLight landing
2. `http://127.0.0.1:4173/changes/2fa6e2861eabf162a26af0d0ef012124865811df` — the regressed receipt
3. The candidate PR on GitHub, checks tab visible (all 8 green)
4. SigNoz — GreenLight — Deployment Impact dashboard, already loaded
5. SigNoz — Alerts, already loaded
6. `docs/MCP_DEMO.md` recorded result table

Run these first; each one must pass before recording:

```bash
npm run demo:status              # five health checks
npm run verify:receipt-links     # every link you might click must open
set -a && . ./.env.demo && set +a && npm run mcp:verify
```

Nothing from an unrelated project should be running against this SigNoz — the
services list is on camera in the dashboard tour.

Zoom the browser to about 125% so text is legible after compression.

---

## 0:00 – 0:22 · The problem

**Screen:** the candidate PR on GitHub, all eight checks green.

> An AI wrote this change. It passed all eight CI checks, it was reviewed, and
> it shipped. Then p95 latency on the affected endpoint rose 7.3 times.
>
> Nothing CI tests was wrong. This is the gap between "the pipeline is green"
> and "production is fine."

## 0:22 – 0:45 · The change, and what GreenLight is

**Screen:** the diff — one added line.

> That's the entire change. `conn_max_lifetime` is a Go duration, and decoded
> from JSON that's nanoseconds — so this isn't sixteen minutes, it's one
> millisecond. The service threw away every database connection the instant it
> opened one.
>
> GreenLight is a flight recorder for AI-authored change. It ties an AI session
> to a commit, a CI run, a deployment, and the telemetry that followed — and
> every one of those is an ID that has to resolve in a live SigNoz.

## 0:45 – 1:35 · The receipt

**Screen:** the receipt page. Scroll slowly: verdict banner → impact → timeline.

> Here's the receipt for that commit. The verdict leads: **regressed**.
>
> p95 went from 1.4 milliseconds to 10.4 — a 7.3x rise, with over 250 requests
> in each window and zero errors. The latency is the whole finding.
>
> The comparison is scoped to the deployed version, not to wall-clock time.
> Each deployment reports its commit SHA as `service.version`, so "before and
> after" is unambiguous even when deploys overlap.
>
> And read the caveat: correlation of version and failure, **not** proof of
> causation. It measured what happened. It doesn't claim to know why.

## 1:35 – 2:20 · SigNoz underneath

**Screen:** click a trace link on the receipt so SigNoz opens on that exact
span. Then the Deployment Impact dashboard's "p95 by deployed version" panel.
Then the Alerts page.

> All of that is SigNoz. Every link on the receipt is an ID that has to resolve
> — here's one, open in SigNoz, the actual slow request.
>
> Two versions on one chart: the step is the deploy. And the same threshold as
> an alert rule, firing right now on the deployed version.
>
> Traces answer the verdict — Query Builder v5, one query for latency, one for
> `has_error`. Custom metrics carry what traces can't: verdicts decided, alert
> notifications received, queue depth, dependency health. Logs ship with trace
> context, so a log line filtered by commit resolves to its span. And GreenLight
> asks the SigNoz MCP server the same questions an investigating agent would.

## 2:20 – 2:50 · Recovery and close

**Screen:** the changes list showing all three commits.

> The revert deploys as its own version, and the next window is measured the
> same way. **Recovered.**
>
> Three real commits, three real CI runs, three verified deployments. The
> workload is a third-party Apache-2.0 ledger that knows nothing about
> GreenLight — so this isn't a demo detecting a bug written to be detected.
>
> One command brings the whole stack up. Thanks for watching.

---

## If the live stack fails mid-recording

Record the narration over the backup assets in `audit/screenshots/` rather than
stopping. The figures quoted above are the recorded ones and do not change.

## Recording notes

- Do not narrate mouse movement ("now I'll click here") — it burns seconds and
  adds nothing.
- One take per section is fine; cut between sections rather than restarting.
- If you go over 3:00, cut the second half of 1:35–2:20 first. The receipt and
  the verdict matter more than the dashboard tour.
