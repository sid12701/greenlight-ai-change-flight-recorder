# GreenLight — AI Change Flight Recorder

A coding agent writes a one-line config change — the kind it produces dozens of
a day. It passes every CI check, gets reviewed, merged, and deployed. Latency on
the affected endpoint then degrades, and nothing in the toolchain connects those
facts.

In the recorded run below that change is `2fa6e28`, it passed all eight CI
checks, and p95 on `/balances` rose 7.3x.

GreenLight records that gap. It ties an AI session to the commit it produced,
the CI run that validated it, the immutable deployed version, the SigNoz
telemetry that followed, and the evidence that a later change recovered the
service.

Every link is an ID that must resolve in a live SigNoz. When one does not, the
receipt says so rather than rendering a confident blank.

## Architecture

```mermaid
flowchart LR
  AI["Claude Code<br/>session"] -->|AI-Traceparent<br/>Git trailer| GH["GitHub<br/>commit + Actions run"]
  GH -->|reconstructed<br/>CI spans| GL["GreenLight<br/>API + worker"]
  GL -->|deploys as<br/>service.version| WL["Blnk workload<br/>Apache-2.0, third-party"]
  WL -->|OTLP traces| SZ["SigNoz<br/>traces · metrics · logs · MCP"]
  GL -->|Query Builder v5<br/>+ MCP| SZ
  SZ -->|measured windows| RC["Change Receipt<br/>verdict + evidence"]
  GL --> RC
```

The unit of comparison is the **immutable deployed version**. Each deployment
reports its commit SHA as `service.version`, so "before and after" is a version
comparison rather than an ambiguous wall-clock one:

```
service.name = 'blnk-loan-workload'
  AND service.version = '<commit sha>'
  AND deployment.environment.name = 'hackathon-demo'
  AND http.route = '/balances'
```

The monitored workload is [Blnk](https://github.com/blnkfinance/blnk) `v0.15.1`
at commit `c8fce93`, fetched and verified rather than vendored. It knows nothing
about GreenLight, so a detected regression is not one written to be detected.

## What is proven, and how to check it

| Claim | Verify with | Recorded result |
|---|---|---|
| Three real commits with real CI runs | GitHub Actions on this repo | `6f458c9`, `2fa6e28`, `c65cd73` — all green |
| The regressing change passed CI | PR #64 checks tab | all 8 checks green |
| Each deployment is version-verified | receipt `deployment.versionState` | `verified` for all three |
| A regression was detected | `GET /api/v1/changes/2fa6e28…` | `regressed` on p95 1.44 ms → 10.45 ms, a 7.3x rise |
| Recovery was measured, not assumed | receipt for `c65cd73` | `recovered` |
| Every published link opens | `npm run verify:receipt-links` | every receipt URL resolves |
| Custom metrics reach SigNoz | `greenlight.*` metrics | verdicts, AI state, alert notifications, queue depth, dependency health |
| Logs join to traces by commit | log filter `commit_sha` | resolves to its span |
| Alerts fire and resolve | SigNoz Alerts page under load | p95 rule `inactive` → `firing` on the candidate, `inactive` on the revert |
| MCP answered independently | `npm run mcp:verify` | 3 traces, all resolve; fails loudly without credentials |
| The AI-link chain is diagnosable | `npm run ai-link:verify` | reports each of the four links separately |
| The stack is pinned, not floating | `bash scripts/signoz-runtime-verify.sh` | 6 images matched by digest |

Full detail: [`greenlight-blog-post.md`](greenlight-blog-post.md) is the
submission-ready project story, with verified screenshots and the limitations
stated plainly. The narrated 2:25 demo is available as
[`signoz-hackathon-end-to-end-demo.mp4`](signoz-hackathon-end-to-end-demo.mp4).

## Five-minute local quickstart

Prerequisites: Node 24, Docker with Compose v2, Git, curl, OpenSSL, and SigNoz
Foundry `v0.2.16`.

```bash
npm ci
cp .env.demo.example .env.demo
npm run demo:up
```

The first run generates private local secrets, starts the digest-pinned SigNoz
stack, and provisions its administrator. It then stops at one gate: SigNoz does
not expose an API key through automation. Follow the single remediation message
it prints — sign in at `http://127.0.0.1:8080` with the mode-0600 credentials in
`.workloads/signoz.env`, create a service-account key, put it in `.env.demo`,
and rerun `npm run demo:up`.

The rerun fetches and verifies Blnk, seeds synthetic ledger data, and starts
PostgreSQL, the GreenLight API and worker, and the web UI, each health-gated.

```bash
npm run demo:status
# GreenLight: http://127.0.0.1:4173
# SigNoz:     http://127.0.0.1:8080
# Blnk:       http://127.0.0.1:18081
```

`npm run demo:down` stops the stack and preserves every volume.

### Record an evidence chain

With `GITHUB_REPOSITORY` pointing at a repository whose commits you can read:

```bash
npm run demo:chain -- <baseline-sha> <candidate-sha> [recovery-sha]
```

Each phase deploys a commit as an immutable version, fills the window
GreenLight will actually measure with paced traffic, records the deployment,
and asks for a verdict. Timings come from the API's own settings, so a window
is never evaluated before it closes. A full three-phase run takes about ten
minutes; that is the measurement windows, not overhead.

The `role=baseline` deployment is then **frozen** and reused by later runs
(see [`docs/DEMO_STATE.md`](docs/DEMO_STATE.md)), so a receipt's baseline and
observed windows can sit hours apart in wall-clock time. That is intended: the
comparison is scoped to an immutable `service.version`, so elapsed time between
the two captures is not part of it. The receipt states this where it prints the
two windows.

**This scenario injects nothing.** It measures what the deployed version did, and
asserts nothing about the candidate's traffic — deciding what observed failures
mean is the evaluator's job, not the script's. The only window held to a standard
is the baseline, because a baseline captured from a failing service would poison
every later comparison.

The separate question — what GreenLight does when something the commit never
touched fails inside a measured window — has its own scenario, which stops the
workload's database on purpose and says so:

```bash
bash scripts/demo-reset.sh
npm run demo:dependency-failure -- <baseline-sha> <candidate-sha>
```

It reports `regressed` and refuses to attribute the failures to the commit.

Then capture the agent-native view:

```bash
npm run mcp:capture   # needs BASELINE_SHA and CANDIDATE_SHA
npm run mcp:verify
```

### Repository-level verification

```bash
npm run verify        # clean, lint, typecheck, test, build
npm run quality
npm run validate:signoz-assets
bash scripts/signoz-runtime-verify.sh
```

## What it refuses to say

Every receipt carries this, and it is load-bearing:

> Deployment correlation is evidence of temporal and version association, not
> proof that every observed failure was caused by the commit.

One limitation is stated rather than hidden:

- AI verification reads `missing` for the recorded commits. Marking a change
  `verified` requires a Claude Code session exporting telemetry to SigNoz so the
  exact span resolves. The recorded commits were not authored in such a session,
  and the receipt reports that rather than implying a link.
  [`docs/AI_LINK.md`](docs/AI_LINK.md) is the procedure for producing one, and
  `npm run ai-link:verify` reports which of the four links is not yet armed.

An earlier version of the demo injected a PostgreSQL outage inside the
candidate's measured window, and the verdict fired on the resulting error rate
rather than on the latency the commit caused. That is now a separate, explicitly
labelled scenario, because a verdict is only evidence about a change if nothing
else was done to the service while it was being measured.

## Submission

Track 3 — Build Your Own. Inspired by the deployment-guardian problem in
[SigNoz issue #11657](https://github.com/SigNoz/signoz/issues/11657).
See [`docs/SUBMISSION.md`](docs/SUBMISSION.md).

Further reading: [AI-session link](docs/AI_LINK.md),
[operations runbook](docs/OPERATIONS.md),
[demo state](docs/DEMO_STATE.md),
[telemetry contract](docs/TELEMETRY_CONTRACT.md),
[MCP investigation](docs/MCP_DEMO.md).

## AI assistance disclosure

Planning and implementation may use Codex/ChatGPT, Claude Code, Cursor, or other
AI assistants. AI systems are tools, not repository authors or commit
co-authors. All commits are reviewed and authored under the human maintainer's
verified Git identity. See [PROVENANCE.md](PROVENANCE.md).

## License

MIT. See [LICENSE](LICENSE). The monitored workload is Apache-2.0 and belongs to
its authors.
