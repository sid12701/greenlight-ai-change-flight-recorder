# GreenLight: End-to-End Hackathon Implementation Plan

**Project:** GreenLight — AI Change Flight Recorder
**Track:** Track 3, Build Your Own
**Demo workload:** Pre-existing Bhawana LMS repository
**Implementation window:** July 23–26, 2026
**Primary objective:** Demonstrate a standards-based evidence chain from a Claude Code action to a Git commit, CI run, LMS deployment, production regression, and verified recovery in SigNoz.

## 1. Technical summary

GreenLight is a local-first observability application that explains what happened when an AI-assisted code change reaches production. It does not replace SigNoz and it does not monitor the LMS independently. It connects identifiers that already exist across the software delivery lifecycle and presents the result as a single **AI Change Receipt**.

The locked MVP is:

1. Claude Code emits OpenTelemetry traces to SigNoz.
2. When Claude Code runs `git commit`, its W3C `TRACEPARENT` is captured by a Git `prepare-commit-msg` hook and stored as an `AI-Traceparent` commit trailer.
3. GreenLight reads the completed GitHub Actions run, converts its workflow, jobs, and steps into a post-hoc OpenTelemetry trace, and adds a span link to the Claude Code span from the commit trailer.
4. A local deployment script starts the LMS backend with `service.version=<commit SHA>` and records the deployment.
5. The instrumented LMS sends traces to SigNoz. A deterministic load script generates traffic against `/api/v1/internal/home/overview`.
6. GreenLight compares a pre-deployment baseline with the post-deployment window using SigNoz Query Builder v5. A seeded, realistic LMS query regression causes p95 latency or error rate to cross the threshold.
7. The GreenLight UI displays the Claude trace, commit, CI run, deployment, affected LMS traces, measured regression, and recovery evidence in one receipt.

The project stays hackathon-sized by using outbound polling instead of a public webhook server, SQLite instead of a production database, a single GitHub repository and LMS service, one regression rule, and one polished incident page.

## 2. Success criteria and non-goals

### 2.1 Must-have success criteria

The submission is demo-ready only when all of the following are true:

- A Claude-created commit contains a valid `AI-Traceparent` trailer.
- The Claude Code trace is visible in SigNoz without prompt or tool-content capture.
- A completed LMS GitHub Actions run appears as a workflow → job → step trace in SigNoz.
- The CI root span links to the Claude Code span represented by the commit trailer.
- The CI span link is clickable in SigNoz and resolves to the preserved Claude Code trace.
- The running LMS backend emits traces with the exact full commit SHA as `service.version`.
- The GreenLight API emits its own traces as `service.name=greenlight-api`.
- GreenLight records a deployment for that SHA and environment.
- At least 200 baseline and 200 post-deployment LMS request spans exist for the selected route.
- A seeded bad version causes a visible, repeatable latency or error regression.
- GreenLight creates one Change Receipt with working links to GitHub and SigNoz evidence.
- A good version is redeployed and the receipt shows recovery.
- A fixed SigNoz MCP investigation independently returns the bad version's latency/error comparison and three representative slow traces.
- `casting.yaml` and the generated `casting.yaml.lock` reproduce SigNoz plus its MCP server.
- The README clearly separates the pre-existing LMS from hackathon-built GreenLight code and declares AI-assistant usage.

### 2.2 Explicit non-goals

Do not build these before submission:

- Automatic rollback or production mutation.
- A predictive AI risk score.
- Support for GitLab, Jenkins, CircleCI, or multiple GitHub repositories.
- General-purpose DORA reporting or flaky-test analytics.
- Browser/frontend OpenTelemetry instrumentation.
- Multi-user authentication, organizations, billing, or RBAC.
- A long-running webhook receiver or SaaS deployment.
- Full prompt, transcript, source-code, or tool-output capture.
- Line-level AI blame.
- A custom observability database; SigNoz remains the telemetry system of record.

## 3. Provenance and rule compliance

The LMS is a pre-existing monitored workload. GreenLight is the new hackathon project.

Record this provenance in the submission README:

> **Pre-existing work:** The Bhawana LMS application and its existing business functionality were created before the hackathon and are used solely as the monitored demo workload. The baseline commit is `2269d064f0be50e7f6485c0be38e3cdcef6137d2`, dated July 16, 2026.
> **Hackathon work:** GreenLight's Claude-to-commit trace bridge, GitHub Actions trace synthesis, deployment correlation, SigNoz queries, alerts and dashboards, regression evaluation, Change Receipt interface, and demo automation were built during July 20–26, 2026.

Additional compliance requirements:

- GreenLight lives in a separate repository.
- Use a clean LMS clone or worktree; never modify the current dirty `/Users/siddhant/Desktop/lms` working tree.
- Only synthetic LMS data may appear in telemetry or recordings.
- Declare Claude Code, Codex/ChatGPT, and any other AI assistants in the submission.
- Generate and commit `casting.yaml.lock` through Foundry rather than writing it manually.
- Keep a short `PROVENANCE.md` or README section listing pre-existing and hackathon-built components.
- Explain the Track 3 choice in the README: “Filed under Build Your Own because GreenLight instruments an unobserved surface—the AI-authored software-delivery lifecycle—rather than the application or agent in isolation.” Reference SigNoz issue `#11657` as the deployment-guardian problem anchor.

## 4. Target users and product flow

### 4.1 Primary user

An engineer or SRE investigating a production regression after an AI-assisted software change.

### 4.2 Primary user flow

1. The engineer opens GreenLight's **Changes** page.
2. Each row shows commit, workflow result, deployment status, regression status, and whether an AI trace is linked.
3. The engineer opens the suspicious commit.
4. GreenLight displays a chronological receipt:
   - Claude Code interaction and tool span.
   - Commit SHA and changed files summary.
   - GitHub Actions workflow, jobs, and important steps.
   - Deployment time and environment.
   - Before/after p95 latency, error rate, and request counts.
   - Representative slow or failed LMS traces.
   - Recovery deployment and recovered measurements.
5. The engineer follows deep links to the underlying GitHub run and SigNoz traces/dashboard.
6. GreenLight offers a copyable `git revert <sha>` command, but performs no rollback.

### 4.3 Pre-deployment review flow

This is P1, after the incident flow works:

1. GreenLight reads the commit diff metadata.
2. It evaluates transparent review rules such as sensitive path, large diff, or production code changed without related tests.
3. It displays `review_required=true` with the exact reasons.
4. It may emit `greenlight.review_required` to SigNoz and show a non-blocking warning.

This is a policy check, not a prediction that the change will fail.

## 5. System architecture

```text
Claude Code
  └─ OTLP traces ───────────────────────────────────────────────┐
  └─ TRACEPARENT → git prepare-commit-msg hook                 │
                         └─ AI-Traceparent commit trailer       │
                                                               ▼
GitHub repository ── GitHub Actions ── GitHub REST API ── GreenLight API
                                                              │
                                   synthesize CI spans + link ─┤
                                                              │ OTLP
Clean LMS demo worktree ── deploy script ── deployment record ┤
          │                                                   │
          └─ Java OTel agent ── LMS request/JDBC traces ──────┤
                                                              ▼
                                                        SigNoz + MCP
                                                              │
                                 Query Builder v5 / deep links │
                                                              ▼
                                                        GreenLight UI
                                                        Change Receipt
```

### 5.1 Runtime topology

All demo components run locally on the presenter laptop:

| Component | Default address | Purpose |
|---|---:|---|
| SigNoz UI | `http://localhost:8080` | Traces, metrics, dashboards, alerts |
| OTLP gRPC | `localhost:4317` | Exposed by SigNoz's default collector; unused by GreenLight MVP |
| OTLP HTTP | `http://localhost:4318` | Primary ingestion for Claude, GreenLight, and LMS |
| SigNoz MCP | `http://localhost:8000/mcp` | Agent-native investigation and demo query |
| GreenLight API | `http://localhost:4000` | Correlation, GitHub sync, query evaluation |
| GreenLight Web | `http://localhost:4173` | Change list and Change Receipt |
| LMS Backend | `http://localhost:8081` | Monitored workload; avoid collision with SigNoz UI |
| LMS Frontend | `http://localhost:5173` | Existing LMS interface |
| LMS PostgreSQL | `localhost:5432` | Existing LMS infrastructure |

Run the LMS backend on `8081`, because SigNoz occupies `8080`.

### 5.2 OTLP, OLTP, and the transport choice

The plan uses **OTLP**, not OLTP:

- **OTLP** means OpenTelemetry Protocol. It is the standard envelope used to send traces, metrics, and logs to SigNoz.
- **OLTP** means Online Transaction Processing. It is a database workload term and is unrelated to GreenLight's telemetry transport.

OTLP supports gRPC on port `4317` and HTTP/protobuf on port `4318`. GreenLight deliberately standardizes on **OTLP over HTTP/protobuf** because it is easier to configure, inspect, and troubleshoot on one laptop. gRPC's persistent HTTP/2 connection and compact Protocol Buffers transport are useful at high production volume, but GreenLight does not need that optimization. Port `4317` may remain exposed by the default SigNoz collector, but it is not a dependency or acceptance gate.

### 5.3 Component responsibilities

#### GreenLight API

- Owns SQLite metadata and migrations.
- Reads GitHub workflow, job, and step data using outbound REST calls.
- Parses and validates AI trace context from commit trailers.
- Emits post-hoc CI spans with original timestamps.
- Records deployment events and emits deployment spans.
- Queries SigNoz `/api/v5/query_range` for baseline and observed measurements.
- Applies the deterministic regression and recovery rules.
- Builds the Change Receipt response consumed by the web UI.
- Never stores raw prompts, transcripts, source code, LMS request bodies, or secrets.

#### GreenLight Web

- Provides one required receipt detail page; the standalone changes list is a P1 enhancement and is cut first if the schedule slips.
- Makes the evidence chain understandable without requiring SigNoz knowledge.
- Uses links to GitHub and SigNoz for auditability.
- Displays loading, insufficient-data, regression, recovered, and integration-error states.

#### Git bridge

- Runs as `prepare-commit-msg` only when a Claude Code Bash process supplies `TRACEPARENT`.
- Validates W3C Trace Context before storing it.
- Adds exactly one `AI-Traceparent` trailer.
- Does nothing for human commits without trace context.

#### GitHub synchronizer and CI trace synthesizer

- Fetches completed workflow runs and their jobs/steps.
- Marks the configured backend workflow—the workflow gating the deployed backend artifact—as the single primary run for each change.
- Calculates the root start as the earliest job start and root end as the latest job completion.
- Emits one workflow root, job children, and step grandchildren.
- Uses error status when conclusion is not `success`.
- Adds a span link from the primary workflow root to the AI span context when available.
- Upserts by GitHub run ID so sync is idempotent.

#### LMS adapter

- Starts a clean LMS build with the OpenTelemetry Java agent.
- Supplies `service.name=lms-backend`, full SHA as `service.version`, and `deployment.environment.name=hackathon-demo`.
- Runs deterministic login and home-overview load.
- Provides prepared good, bad, and recovery commits or patches on the isolated demo branch.

#### SigNoz

- Is the telemetry source of truth.
- Derives application RED metrics from LMS spans.
- Stores Claude, CI, deployment, and LMS telemetry.
- Hosts the Pipeline Health and Deployment Impact dashboards.
- Fires the p95/error alert.
- Provides trace and dashboard deep links.
- Runs its MCP server so Claude Code can query the same evidence during the demo.

### 5.4 Deliberate architectural decisions and judge answers

#### Reconstructed CI traces

GreenLight creates CI spans after a workflow completes, using timestamps and conclusions from GitHub's REST API. These are not runtime instrumentation from the GitHub runner. Keep this design because it enables the required cross-trace link to the earlier Claude span, but label it unambiguously:

- root span name begins with `Reconstructed GitHub Actions:`;
- root carries `greenlight.telemetry.origin=reconstructed`;
- root carries `greenlight.telemetry.source=github_rest_api`;
- root carries the GitHub run ID and reconstruction timestamp;
- UI and documentation call it a **reconstructed CI trace**, never a native runner trace.

Rehearsed judge answer:

> “This is a faithful reconstruction of a completed run, emitted for correlation. Every timing and conclusion comes from GitHub's API, and every reconstructed span is explicitly labeled.”

#### Prepared traffic, live analysis

The good/bad LMS versions and 90-second traffic windows are deliberately prepared for demo reliability. The conclusion is not pre-baked: during the demonstration GreenLight performs the GitHub sync, SigNoz queries, regression evaluation, receipt assembly, and MCP investigation live against that preserved telemetry.

Rehearsed judge answer:

> “The workload is staged and disclosed; the analysis is recomputed live. GreenLight does not know whether a regression was planted—it applies the same version-and-time correlation to whatever telemetry SigNoz contains.”

#### Polling rather than webhooks

Outbound GitHub polling avoids a public ingress endpoint during a one-week local-first build. It is automatic when the sync script runs but not real-time. A hosted version would replace polling with authenticated GitHub webhooks while keeping the same normalization and idempotency modules.

#### Local-first MVP versus production shape

Local-first is a scope decision, not the proposed final operating model. A production evolution would use an authenticated hosted API, GitHub webhooks, a durable job queue, PostgreSQL metadata, managed or self-hosted SigNoz/collector endpoints, multi-repository configuration, and RBAC. None of those changes alter the core identifiers, telemetry contract, or deterministic evaluator demonstrated by the MVP.

## 6. Technology stack

| Area | Choice | Reason |
|---|---|---|
| GreenLight runtime | Node.js 20 + TypeScript | Matches LMS frontend toolchain and GitHub/OpenTelemetry SDKs |
| API framework | Fastify | Small, fast, typed, minimal ceremony |
| Validation | Zod | Shared API and configuration schemas |
| Database | SQLite + `better-sqlite3` | Local, deterministic, no extra service |
| Web UI | React + Vite + TypeScript | Existing familiarity and fast iteration |
| Styling | Tailwind CSS + small local components | Polished UI without a large component dependency |
| Data fetching | TanStack Query | Loading/error/refetch states |
| Telemetry | OpenTelemetry JS SDK + OTLP HTTP exporter | Native span creation and explicit timestamps/links |
| LMS telemetry | OpenTelemetry Java agent | Zero-code Spring/JDBC/HTTP instrumentation |
| CI source | GitHub REST API | Provides run, job, step, start/end, status, and URLs |
| Telemetry backend | Self-hosted SigNoz installed by Foundry | Hackathon requirement and reproducibility |
| Required test gates | Vitest, Fastify inject, React component tests, in-memory OTel exporter | Fast deterministic coverage on the critical path |
| Optional browser smoke | Pre-warmed Playwright harness | One thin happy path without making browser setup or flake debugging a release gate |
| Package management | npm workspaces | Already available with Node; no extra package manager |
| Load generation | Node 20 script using `fetch` | No k6 installation required |

Avoid an ORM, message queue, background worker framework, or separate state service.

## 7. Repository and folder structure

```text
greenlight/
├── README.md
├── PROVENANCE.md
├── LICENSE
├── package.json
├── package-lock.json
├── tsconfig.base.json
├── playwright.config.ts
├── .env.example
├── .gitignore
├── casting.yaml
├── casting.yaml.lock
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── config.ts
│   │   │   ├── db/
│   │   │   │   ├── connection.ts
│   │   │   │   ├── migrate.ts
│   │   │   │   └── migrations/
│   │   │   ├── modules/
│   │   │   │   ├── changes/
│   │   │   │   ├── github/
│   │   │   │   ├── ci-telemetry/
│   │   │   │   ├── deployments/
│   │   │   │   ├── signoz/
│   │   │   │   ├── regressions/
│   │   │   │   └── receipts/
│   │   │   └── routes/
│   │   └── test/fixtures/github/
│   └── web/
│       ├── package.json
│       └── src/
│           ├── app/
│           ├── api/
│           ├── components/
│           ├── features/changes/
│           ├── features/receipts/
│           └── styles/
├── packages/
│   └── shared/
│       ├── src/
│           ├── contracts.ts
│           ├── telemetry.ts
│           └── traceparent.ts
│       └── test-vectors/
│           └── traceparent.json
├── instrumentation/
│   ├── git-hooks/
│   │   ├── prepare-commit-msg
│   │   └── install.sh
│   ├── claude-code/
│   │   └── env.example
│   └── lms-java-agent/
│       └── env.example
├── integrations/
│   └── lms/
│       ├── README.md
│       ├── demo-config.example
│       ├── load-home-overview.mjs
│       ├── deploy.sh
│       ├── patches/
│       │   ├── regression.patch
│       │   └── recovery.patch
│       └── verify.sh
├── signoz/
│   ├── dashboards/
│   │   ├── pipeline-health.json
│   │   └── deployment-impact.json
│   ├── alerts/
│   │   └── lms-home-regression.json
│   ├── queries/
│   │   ├── baseline-p95.json
│   │   ├── observed-p95.json
│   │   ├── error-rate.json
│   │   └── slow-traces.json
│   └── saved-views.md
├── scripts/
│   ├── bootstrap.sh
│   ├── demo-baseline.sh
│   ├── demo-regression.sh
│   ├── demo-recover.sh
│   ├── demo-reset.sh
│   └── smoke.sh
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEMO_SCRIPT.md
│   ├── TELEMETRY_CONTRACT.md
│   ├── SECURITY.md
│   └── SUBMISSION_CHECKLIST.md
├── tests/
│   └── e2e/
│       ├── fixtures/
│       ├── pages/
│       │   ├── changes.page.ts
│       │   └── receipt.page.ts
│       ├── boot.smoke.spec.ts
│       └── receipt.smoke.spec.ts
└── .github/workflows/
    ├── ci.yml
    └── e2e-smoke.yml
```

## 8. Telemetry and correlation contract

Use exact, stable identifiers across every component.

| Stage | Required attributes |
|---|---|
| Claude Code | `session.id`, native trace ID/span ID, `service.name=claude-code` if configurable |
| Commit | full SHA, `AI-Traceparent` trailer |
| CI root | `vcs.ref.head.revision`, `vcs.repository.name`, `cicd.pipeline.name`, `cicd.pipeline.run.id`, `ci.provider=github`, `greenlight.telemetry.origin=reconstructed`, `greenlight.telemetry.source=github_rest_api` |
| CI job | `cicd.pipeline.run.id`, `cicd.pipeline.task.name`, `github.job.id`, `github.job.conclusion` |
| CI step | `github.step.name`, `github.step.number`, `github.step.conclusion` |
| Deployment | `service.name=lms-backend`, `service.version=<full SHA>`, `deployment.environment.name=hackathon-demo` |
| LMS runtime | `service.name=lms-backend`, `service.version=<full SHA>`, `deployment.environment.name=hackathon-demo`, HTTP route/status attributes |
| GreenLight custom | `greenlight.change.id`, `greenlight.ai.linked`, `greenlight.regression.status` |

### 8.1 Trace link handling

Expected trailer:

```text
AI-Traceparent: 00-<32 lowercase hex trace id>-<16 lowercase hex span id>-<2 hex flags>
```

Validation rules:

- Accept only version `00` for the MVP.
- Reject all-zero trace IDs and span IDs.
- Normalize hex to lowercase.
- Store trace ID, span ID, and flags separately.
- Do not store or propagate `tracestate`.
- Treat the trailer as untrusted input.
- If invalid or missing, sync the change with `ai_link_status=missing` or `invalid`; never fail the whole CI sync.

### 8.2 Regression definition

The demo route is:

```text
GET /api/v1/internal/home/overview
```

For each deployment:

- **Baseline window:** one immutable, configured period captured once for the known-good `role=baseline` deployment in GL-P4-T02. Every candidate and recovery comparison reuses that stored `baseline_deployment_id` and its exact UTC window.
- **Observed window:** the configured period after a startup warm-up.
- **Demo configuration:** `90s` frozen baseline, `15s` warm-up, and `90s` observed; generate the baseline once and generate new candidate/recovery windows during rehearsal preparation rather than waiting live during judging.
- **Minimum sample:** 200 completed request spans in each window. The load script targets 250 per window to preserve margin.
- **Latency regression:** observed p95 is greater than both `baseline p95 × 1.5` and `baseline p95 + 250 ms`.
- **Error regression:** observed error rate is at least two percentage points above baseline and at least 5% absolute.
- **Regression status:** `REGRESSED` when either latency or error rule fires.
- **Insufficient data:** no conclusion when either window has fewer than 200 spans.
- **Recovered:** after a later deployment, p95 is at most `baseline × 1.2` and error rate is no more than one percentage point above baseline for at least 200 spans.
- **Stability display:** show p90 alongside p95 for context, but keep the stated p95 rule as the decision contract.

All timestamps are UTC. Store ISO-8601 `Z` timestamps in SQLite, convert external timestamps to epoch milliseconds once at the boundary, and convert epoch milliseconds to OpenTelemetry nanoseconds without local-time parsing.

This is a transparent demo policy, not a universal SLO, causal proof, or statistical model. GreenLight reports correlation anchored to the deployment and version; the representative traces provide diagnostic evidence. Surface the configured thresholds in the receipt so judges can inspect rather than infer the decision rule.

## 9. Database design

SQLite is metadata-only. SigNoz stores telemetry; GitHub stores CI details.

### 9.1 Tables

```sql
CREATE TABLE repositories (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider = 'github'),
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  created_at TEXT NOT NULL,
  UNIQUE(provider, owner, name)
);

CREATE TABLE changes (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id),
  commit_sha TEXT NOT NULL,
  short_sha TEXT NOT NULL,
  branch TEXT,
  commit_subject TEXT,
  committed_at TEXT,
  ai_traceparent TEXT,
  ai_trace_id TEXT,
  ai_span_id TEXT,
  ai_trace_flags TEXT,
  ai_link_status TEXT NOT NULL CHECK (
    ai_link_status IN ('linked', 'missing', 'invalid')
  ),
  changed_files_count INTEGER,
  additions INTEGER,
  deletions INTEGER,
  changed_paths_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(repository_id, commit_sha)
);

CREATE TABLE pipeline_runs (
  id TEXT PRIMARY KEY,
  change_id TEXT NOT NULL REFERENCES changes(id),
  provider_run_id TEXT NOT NULL UNIQUE,
  workflow_name TEXT NOT NULL,
  status TEXT NOT NULL,
  conclusion TEXT,
  started_at TEXT,
  completed_at TEXT,
  html_url TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  emitted_trace_id TEXT,
  synced_at TEXT NOT NULL
);

CREATE TABLE deployments (
  id TEXT PRIMARY KEY,
  change_id TEXT NOT NULL REFERENCES changes(id),
  service_name TEXT NOT NULL,
  environment_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('baseline', 'candidate', 'recovery')),
  status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed')),
  deployed_at TEXT NOT NULL,
  emitted_trace_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE regression_evaluations (
  id TEXT PRIMARY KEY,
  deployment_id TEXT NOT NULL REFERENCES deployments(id),
  baseline_deployment_id TEXT NOT NULL REFERENCES deployments(id),
  route TEXT NOT NULL,
  comparison_kind TEXT NOT NULL CHECK (
    comparison_kind IN ('deployment', 'recovery')
  ),
  baseline_service_version TEXT NOT NULL,
  observed_service_version TEXT NOT NULL,
  baseline_start TEXT NOT NULL,
  baseline_end TEXT NOT NULL,
  observed_start TEXT NOT NULL,
  observed_end TEXT NOT NULL,
  baseline_request_count INTEGER NOT NULL,
  observed_request_count INTEGER NOT NULL,
  baseline_p95_ms REAL,
  observed_p95_ms REAL,
  latency_delta_pct REAL,
  baseline_error_rate REAL,
  observed_error_rate REAL,
  status TEXT NOT NULL CHECK (
    status IN ('insufficient_data', 'healthy', 'regressed', 'recovered')
  ),
  reasons_json TEXT NOT NULL,
  signoz_dashboard_url TEXT,
  evaluated_at TEXT NOT NULL
);

CREATE TABLE evidence_links (
  id TEXT PRIMARY KEY,
  regression_evaluation_id TEXT NOT NULL REFERENCES regression_evaluations(id),
  kind TEXT NOT NULL CHECK (kind IN ('signoz_trace', 'signoz_dashboard')),
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_changes_sha ON changes(commit_sha);
CREATE INDEX idx_pipeline_change ON pipeline_runs(change_id);
CREATE UNIQUE INDEX idx_pipeline_primary_change
  ON pipeline_runs(change_id) WHERE is_primary = 1;
CREATE INDEX idx_deployments_change_time ON deployments(change_id, deployed_at);
CREATE UNIQUE INDEX idx_deployments_demo_baseline
  ON deployments(service_name, environment_name)
  WHERE role = 'baseline' AND status = 'succeeded';
CREATE INDEX idx_regressions_deployment ON regression_evaluations(deployment_id);
CREATE INDEX idx_regressions_baseline ON regression_evaluations(baseline_deployment_id);
```

`changed_paths_json` is nullable and used only if the optional review-policy feature is built. It contains repository-relative paths only—never file content, patches, or diff hunks.

### 9.2 Data retention

- Keep only metadata required for the demo.
- Treat the Claude interaction trace, synthesized CI trace, frozen bad/recovery commits, `changes`, and `pipeline_runs` as immutable upstream evidence once Phases 2–3 pass.
- `demo-reset.sh` is a **soft rehearsal reset**. It may delete only candidate/recovery deployments, their evaluations/evidence links, and transient evaluation state, then regenerate candidate/recovery LMS runtime load.
- A soft reset must never delete the frozen baseline deployment/window, `changes`, `pipeline_runs`, any Claude/CI trace identifiers, the SQLite file itself, or any SigNoz telemetry.
- `demo-reset.sh --hard` is a full rebuild tool only: it regenerates Claude and CI traces and then re-freezes commit trailers and stored trace IDs. Never run it during the demo window.
- Do not copy raw GitHub job logs, Claude prompts, LMS payloads, borrower information, or trace bodies into SQLite.

## 10. API design

All mutation endpoints require `Authorization: Bearer $GREENLIGHT_ADMIN_TOKEN`, even when bound to localhost.

### 10.1 Health and configuration

#### `GET /api/v1/health`

Returns API, database, GitHub, SigNoz, and OTLP readiness.

```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "github": "ok",
    "signoz": "ok",
    "otlp": "ok"
  }
}
```

### 10.2 GitHub synchronization

#### `POST /api/v1/github/sync-runs`

```json
{
  "repository": "owner/lms",
  "runIds": [123456789, 123456790],
  "primaryWorkflowName": "Backend CI"
}
```

Behavior:

- Fetch run, commit, jobs, and steps.
- Parse `AI-Traceparent` from the commit message.
- Upsert repository, change, and pipeline run.
- Mark exactly one run as primary by exact configured workflow name.
- Emit each CI trace once; attach the AI span link only to the primary backend workflow root.
- Return IDs and warnings.

#### `POST /api/v1/github/sync-latest`

```json
{
  "repository": "owner/lms",
  "branch": "greenlight-demo",
  "primaryWorkflowName": "Backend CI"
}
```

Use only for the demo convenience button. It finds the latest completed primary backend run for the branch and may also sync secondary runs for context. If zero or multiple runs match the configured primary workflow, return a configuration error rather than guessing.

### 10.3 Deployment recording

#### `POST /api/v1/deployments`

```json
{
  "repository": "owner/lms",
  "commitSha": "full-40-character-sha",
  "serviceName": "lms-backend",
  "environmentName": "hackathon-demo",
  "role": "candidate",
  "status": "succeeded",
  "deployedAt": "2026-07-24T12:00:00Z"
}
```

Behavior:

- Require an existing change record or sync the commit first.
- Emit a deployment span/event.
- Persist the deployment.
- Permit only one current baseline anchor per service/environment in the prepared demo sequence.
- Return the deployment ID and evaluation-ready time.

### 10.4 Regression evaluation

#### `POST /api/v1/regressions/evaluate`

```json
{
  "deploymentId": "dep_...",
  "baselineDeploymentId": "dep_good_...",
  "route": "/api/v1/internal/home/overview"
}
```

Behavior:

- Execute reviewed SigNoz Query Builder v5 payloads.
- Resolve and persist the baseline deployment according to §11.8. `baselineDeploymentId` is optional only when the deterministic resolver can find exactly one valid candidate.
- Enforce sample minimums.
- Compute latency and error deltas.
- Query representative slow/error traces.
- Persist the result and links.
- Return `healthy`, `regressed`, `recovered`, or `insufficient_data`.
- Return HTTP `409 baseline_required` when the resolver cannot choose one auditable baseline.

### 10.5 Read APIs

#### `GET /api/v1/changes`

Returns the latest 20 changes with AI-link, CI, deployment, and regression status.

#### `GET /api/v1/changes/:commitSha`

Returns the complete Change Receipt DTO.

#### `GET /api/v1/deployments/:id`

Returns one deployment and its latest evaluation.

### 10.6 Optional review-policy API

#### `POST /api/v1/changes/:commitSha/review-policy/evaluate`

Returns deterministic reasons such as:

```json
{
  "reviewRequired": true,
  "reasons": [
    "Sensitive path changed: backend/src/main/java/.../HomeDashboardService.java",
    "Production code changed without a related test change"
  ]
}
```

## 11. Core modules and implementation details

### 11.1 Configuration module

Validate environment variables at startup:

- `GREENLIGHT_PORT=4000`
- `GREENLIGHT_DATABASE_PATH=./data/greenlight.db`
- `GREENLIGHT_ADMIN_TOKEN`
- `GITHUB_TOKEN`
- `GITHUB_REPOSITORY=owner/lms`
- `SIGNOZ_URL=http://localhost:8080`
- `SIGNOZ_API_KEY`
- `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`
- `OTEL_SERVICE_NAME=greenlight-api`
- `LMS_PATH=/absolute/path/to/clean/lms-demo`
- `LMS_DEMO_BRANCH=greenlight-demo`
- `GREENLIGHT_PRIMARY_WORKFLOW_NAME=Backend CI`
- `GREENLIGHT_BASELINE_WINDOW_SECONDS=90`
- `GREENLIGHT_WARMUP_SECONDS=15`
- `GREENLIGHT_OBSERVED_WINDOW_SECONDS=90`
- `GREENLIGHT_MIN_SPANS=200`

Exit with a readable error when required values are missing. Never print secret values.

### 11.2 Traceparent parser

- Parse the W3C four-field format.
- Return a typed `SpanContext` or a structured validation error.
- Unit-test version, length, hex, zero ID, flags, whitespace, duplicate trailer, and missing trailer cases.
- Keep accepted and rejected contexts in `packages/shared/test-vectors/traceparent.json`.
- Run the same vectors against both the TypeScript parser and the shell hook in CI so the validators cannot drift.

### 11.3 Commit trailer hook

Algorithm:

1. Read `$TRACEPARENT`.
2. Exit successfully if it is empty.
3. Read Git's source argument supplied to `prepare-commit-msg`.
4. Inject only for normal commits whose source is empty or `message`.
5. For `merge`, `squash`, `commit`/amend, or other generated-message sources, preserve any existing trailer and do not add a new one.
6. Validate the context with the POSIX-compatible validator covered by the shared test vectors.
7. Exit with a warning, not a failed commit, if invalid.
8. Check whether `AI-Traceparent` already exists.
9. Add it with `git interpret-trailers --in-place --if-exists=doNothing`.
10. Do not log the full environment.

Test the hook in a temporary Git repository before installing it in the LMS demo clone.

### 11.4 GitHub client

- Use the REST API with a fine-grained read-only token.
- Fetch run details, jobs, steps, commit message, and commit stats.
- If the optional review policy is enabled, fetch repository-relative changed paths from GitHub's files response and store paths only.
- Save JSON fixtures from a non-sensitive test repository.
- Add timeouts, limited retries for 429/5xx, and clear rate-limit errors.
- Never fetch or store raw job logs in the MVP.

### 11.5 CI span synthesizer

- Build spans only after the workflow is complete.
- Sync all requested runs but select exactly one primary backend run using `GREENLIGHT_PRIMARY_WORKFLOW_NAME`.
- Only the primary run receives the Claude span link and populates the receipt's main CI section; secondary runs remain available as related CI context.
- Use the original GitHub timestamps as `startTime` and `endTime`.
- Parse GitHub timestamps as ISO-8601 offsets, normalize to UTC epoch milliseconds, and convert to OpenTelemetry epoch nanoseconds exactly once.
- Create one trace per workflow run.
- Prefix the root name with `Reconstructed GitHub Actions:` and add the reconstruction attributes defined in §5.4.
- Create child contexts manually so jobs and steps share the root trace.
- Add the Claude span as a **link**, not a parent, because CI is asynchronous and begins later.
- Set span status to error for failed, cancelled, or timed-out conclusions.
- Flush the exporter before returning from sync.
- Store the emitted trace ID for deep-link support.
- Make repeated sync idempotent by skipping emission when `emitted_trace_id` already exists unless `force=true` is used in development.

### 11.6 Deployment module

- Create a deployment record before/after the LMS start command.
- Emit `deployment.started` and `deployment.succeeded` as spans or events.
- Confirm `/actuator/health` before marking success. Use `/actuator/health/readiness` only if the demo profile explicitly sets `management.endpoint.health.probes.enabled=true`.
- Confirm at least one LMS span with the new `service.version` is visible before enabling evaluation.
- On failed startup, mark the deployment failed and do not run regression evaluation.

### 11.7 SigNoz client

- Implement a small adapter around `POST /api/v5/query_range`.
- Keep each reviewed query payload in `signoz/queries/` and load it through typed templates.
- Use `SIGNOZ-API-KEY` and `Content-Type: application/json` headers.
- Apply a 10-second timeout and one retry for transient failure.
- Parse results defensively; return `integration_error` rather than inventing zero values.
- Keep URL generation in one module so SigNoz route changes affect one place.

### 11.8 Regression evaluator

- Require exact service, version, environment, route, and time windows.
- Read baseline, warm-up, observed, and sample-floor values from validated configuration rather than hard-coding them.
- Baseline selection for a normal deployment:
  1. Use the explicitly supplied `baselineDeploymentId` only when it identifies the unique frozen GL-P4-T02 baseline for the same service/environment and precedes the candidate.
  2. Otherwise select that unique `role=baseline`, `succeeded` deployment and its stored UTC window.
  3. Never select an immediately preceding healthy/recovered deployment and never regenerate the baseline per rehearsal.
  4. If the frozen baseline is missing or ambiguous, return `baseline_required`; never guess.
- Baseline selection for recovery:
  1. Find the most recent earlier `regressed` evaluation for the same service, environment, and route.
  2. Reuse that row's `baseline_deployment_id` and baseline window—not the bad deployment—as the recovery comparison.
  3. Allow an explicit baseline override only when it passes the same service/environment/time-order validation.
- Persist `baseline_deployment_id`, `baseline_service_version`, `observed_service_version`, and `comparison_kind` on every evaluation.
- Evaluate latency and error independently.
- Preserve raw aggregate values used in the decision.
- Record rule reasons as structured JSON.
- Never claim causation. Use wording such as “regression began after deployment of this version” and show evidence.
- Evaluate recovery against the original good baseline rather than the bad version.

### 11.9 Receipt assembler

Produce one stable DTO:

```text
change
  identity, AI link status, GitHub URL, diff summary
pipeline (primary backend run)
  workflow status, duration, slowest step, SigNoz trace URL
relatedPipelines
  secondary workflow names, status, and GitHub URLs
deployment
  service, environment, version, time, status
impact
  route, baseline/observed versions, sample counts, baseline/observed p95, error rates, reasons
evidence
  representative trace links and dashboard link
recovery
  recovery deployment, measurements, recovered time
actions
  copyable revert command
```

The receipt assembler is authoritative about link sources:

- GitHub CI links come from `pipeline_runs.html_url`.
- Regression-scoped SigNoz trace/dashboard links come from `evidence_links`.
- Do not duplicate GitHub run URLs in `evidence_links`.

### 11.10 Web UI

Build only two routes:

- `/changes`
- `/changes/:commitSha`

Receipt layout:

1. Header: commit subject, SHA, regression status, AI-linked badge.
2. Timeline: Claude → commit → CI → deploy → incident → recovery.
3. Before/after impact cards: p95, error rate, request count.
4. CI section: workflow result, duration, slowest job/step.
5. Evidence section: SigNoz trace and dashboard links.
6. Action section: copyable revert command.
7. Caveat: “Deployment correlation is evidence of temporal and version association, not proof that every observed failure was caused by the commit.”

Required states:

- Loading skeleton.
- No deployments yet.
- AI trace missing.
- CI sync failed.
- Insufficient traffic.
- Healthy.
- Regressed.
- Recovered.

## 12. Integrations

### 12.1 Claude Code

Enable only the needed telemetry:

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1
export CLAUDE_CODE_PROPAGATE_TRACEPARENT=1
export OTEL_TRACES_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_TRACES_SAMPLER=always_on
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_LOG_USER_PROMPTS=0
export OTEL_LOG_TOOL_DETAILS=0
export OTEL_LOG_TOOL_CONTENT=0
```

Verify that a Bash subprocess sees `TRACEPARENT` before relying on the hook. Do not assume beta tracing works until one console/debug test proves it.

### 12.2 GitHub Actions

Reuse the existing LMS backend and frontend workflows. Do not rewrite them for the MVP.

GreenLight pulls:

- workflow run ID and URL;
- head SHA and branch;
- run status and conclusion;
- job IDs, names, timestamps, and conclusions;
- step names, numbers, timestamps, and conclusions.

The GreenLight repository's required `ci.yml` runs API tests, web component tests, typecheck, and build. Playwright lives in a separate, non-required `e2e-smoke.yml` workflow so browser installation or flake debugging cannot block the critical path or submission.

### 12.3 LMS

Create a clean clone or worktree at the July 16 baseline, then create a `greenlight-demo` branch. Do not touch the existing dirty LMS workspace.

Instrument the backend with the Java agent:

```bash
export SERVER_PORT=8081
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_TRACES_SAMPLER=always_on
export OTEL_RESOURCE_ATTRIBUTES="service.name=lms-backend,service.version=$LMS_SHA,deployment.environment.name=hackathon-demo"
java -javaagent:/absolute/path/opentelemetry-javaagent.jar -jar backend/target/lms-backend-0.0.1-SNAPSHOT.jar
```

The LMS already uses Java 21, Spring Boot Actuator, PostgreSQL, Redis, RabbitMQ, MinIO, synthetic portfolio generation, and separate backend/frontend GitHub Actions workflows.

### 12.4 SigNoz and Foundry

`casting.yaml`:

```yaml
apiVersion: v1alpha1
kind: Installation
metadata:
  name: signoz
spec:
  deployment:
    flavor: compose
    mode: docker
  mcp:
    spec:
      enabled: true
```

Commands:

```bash
foundryctl gauge -f casting.yaml
foundryctl forge -f casting.yaml
foundryctl cast -f casting.yaml
curl -fsS http://localhost:8000/livez
```

The current official SigNoz Foundry documentation confirms this schema. Still run `gauge` first as the Day-1 environment/schema oracle, then `forge` to generate `casting.yaml.lock`; commit the lock. If `cast` is temporarily blocked, use the generated `pours/deployment/compose.yaml` to continue local development, but a successful Foundry-generated submission remains mandatory.

Create these SigNoz assets:

- **Pipeline Health dashboard:** workflow duration, job duration, conclusion counts, slowest step.
- **Deployment Impact dashboard:** LMS p95, error rate, throughput grouped by `service.version`, plus deployment markers.
- **Saved view:** LMS home-overview traces filtered by environment and version.
- **Alert:** home-overview p95 above the deterministic demo threshold or error rate above 5%.
- **MCP demonstration (required):** run this fixed, rehearsed prompt through SigNoz MCP: “For service `lms-backend` version `<bad-sha>`, environment `hackathon-demo`, compare p95 latency and error rate on route `/api/v1/internal/home/overview` for the configured 90 seconds before versus after the deployment marker, and return the three slowest traces. Report temporal and version correlation only; do not claim the commit caused the change.”
- **Dogfood panel:** show latency/error telemetry for `service.name=greenlight-api`.

## 13. Security and privacy

### 13.1 Secrets

- Store GitHub, SigNoz, LMS, and GreenLight tokens in `.env`; commit only `.env.example`.
- Use a fine-grained GitHub token with repository metadata and Actions read permissions only.
- Use a SigNoz service-account API key; use separate setup and read-only keys if the product supports the necessary scopes.
- Redact authorization headers and secrets from logs and error responses.
- Never put API keys in OTLP resource attributes, commit trailers, screenshots, or demo recordings.

### 13.2 Data minimization

- Use synthetic LMS tenants, borrowers, and loans.
- Do not enable Claude prompt, raw API body, tool detail, or tool-content export.
- Do not store LMS request/response bodies.
- Do not display borrower names, account numbers, PAN, Aadhaar, email, phone, or bank information in GreenLight.
- Route and aggregate data are sufficient for the demo.

### 13.3 API safety

- Bind GreenLight API to `127.0.0.1` by default.
- Allow CORS only from `http://localhost:4173`.
- Require bearer authentication for mutation routes.
- Validate repository names, run IDs, SHAs, URLs, timestamps, and trace context.
- Permit GitHub API calls only to `api.github.com` and the configured repository.
- Set body-size limits and timeouts.
- Return generic integration errors to the UI; keep sanitized diagnostics in local logs.

### 13.4 Operational safety

- GreenLight never executes rollback automatically.
- `demo-reset.sh` performs only the soft reset defined in §9.2 and refuses to run if its database is not the dedicated GreenLight demo database.
- `demo-reset.sh --hard` requires an explicit confirmation phrase and is prohibited during rehearsals, recording, and judging.
- Never clear SigNoz data during the demo window; Claude and CI trace links rely on immutable upstream telemetry.
- Deployment scripts operate only on the clean LMS demo path supplied by `LMS_PATH`.
- Never run destructive Git commands against the existing LMS working tree.

## 14. Testing strategy

### 14.1 Unit tests

Must cover:

- Traceparent parsing and validation.
- Commit-trailer extraction, duplicates, and invalid input.
- GitHub run/job/step normalization.
- Primary-workflow selection with zero-match, one-match, and multiple-match cases.
- Span hierarchy, timestamps, attributes, status mapping, and links using an in-memory span exporter.
- Reconstructed-span naming and required provenance attributes.
- Regression rules, 200-span sample minimum, boundary values, and recovery calculation.
- Normal and recovery baseline-selection rules, including explicit override validation and `baseline_required`.
- One timestamp test that parses a known offset timestamp, normalizes it to UTC, converts it to epoch nanoseconds, and round-trips without drift.
- SigNoz response parsing and missing-series handling.
- Configuration validation and secret redaction.
- Receipt assembly with linked, missing, regressed, and recovered states.

### 14.2 API integration tests

Use Fastify `inject`, temporary SQLite, and mocked outbound HTTP:

- Sync a recorded successful GitHub run fixture.
- Sync backend and frontend workflow fixtures for one commit and prove exactly one is primary.
- Sync the same run twice and prove idempotency.
- Sync a commit without an AI trailer.
- Record deployment for a known change.
- Evaluate healthy, regressed, insufficient-data, and recovered fixtures.
- Prove recovery reuses the original good baseline deployment and persists both compared versions.
- Verify auth and CORS behavior.
- Verify integration failures do not produce fabricated metrics.

### 14.3 Git hook tests

Use a temporary repository:

- Commit without `TRACEPARENT`: no trailer.
- Commit with valid context: one trailer.
- Commit with existing trailer: no duplicate.
- Commit with invalid context: commit succeeds, warning emitted, no trailer.
- Run the shared accepted/rejected traceparent vectors through both validators.
- Merge and squash commit: no new trailer.
- Amend: existing trailer is preserved and never replaced.

### 14.4 Required web tests

- Component tests for status badges, timeline, metrics, caveat, and link rendering.
- API error and insufficient-data states.

### 14.5 Playwright harness and optional happy-path smoke

Playwright is not a required build, phase, CI, or submission gate.

Front-load the generic harness before product-specific UI work:

- Install Playwright and cache the browser binary.
- Add `playwright.config.ts`, base URL, local `webServer` wiring, and the separate smoke workflow.
- Add reusable synthetic seed/auth fixtures and login helpers.
- Add a required page-object skeleton for `/changes/:sha`; add `/changes` only if the P1 standalone list remains in scope.
- Prove only a generic boot smoke: the application loads and the document title renders.

Product assertions cannot be fully authored in advance because they depend on the Phase 5 selectors, text, and flows. As each screen lands, add only small isolated assertions against the real DOM. If time remains after the required gates pass, complete one happy path:

`direct receipt route → status/timeline visible → evidence link present → revert command copyable`

If GL-P5-T03 remains in scope, prepend the changes-list navigation to that smoke.

Do not spend critical-path time expanding the suite or debugging non-deterministic browser behavior. A failing or absent optional Playwright smoke does not block release if the required Vitest, Fastify-inject, component, build, telemetry, and rehearsal gates pass.

Provenance rule:

- If the generic harness and cached browser were genuinely created before kickoff as reusable scaffolding, list them as pre-existing in `PROVENANCE.md`.
- Product-specific GreenLight assertions, selectors, fixtures, and page-object implementations remain hackathon work.
- If the harness was not actually created before kickoff, do not label it pre-existing; set it up early as hackathon work and keep it off the critical path.

### 14.6 LMS and telemetry smoke tests

- Existing backend tests: `cd backend && ./mvnw test` in the clean demo clone.
- Existing frontend gate: `cd frontend && npm run verify` only if frontend code changes.
- Readiness: `/actuator/health` returns healthy.
- Generate at least one request and verify `lms-backend` appears in SigNoz.
- Verify the span has full `service.version` and the target route.
- Verify one Claude trace reaches SigNoz.
- Verify one synthetic CI trace and its span link are exported.
- Verify `greenlight-api` traces reach SigNoz.

### 14.7 Demo rehearsal tests

Run the complete demo twice from reset state. The second rehearsal must succeed without code edits.

Record:

- baseline p95 and sample count;
- bad-version p95/error and sample count;
- time from deployment to visible regression;
- recovery p95/error and sample count;
- all required browser tabs and links.

Freeze the demo commits and thresholds after the second successful rehearsal.

## 15. Deployment and local setup

### 15.1 Prerequisites

- macOS with Docker Desktop allocated at least 4 GB for SigNoz, preferably 8 GB total available.
- Java 21.
- Node.js 20.
- Git and GitHub access.
- An exact pinned Claude Code version supporting beta tracing and Bash `TRACEPARENT` propagation; record `claude --version` in README and the preflight output.
- Foundry `foundryctl`.
- OpenTelemetry Java agent JAR pinned to a known version.

### 15.2 Bootstrap order

1. Create GreenLight repository.
2. Create clean LMS demo clone/worktree and branch.
3. Start the minimal verified LMS infrastructure profile rather than every service in `infra/docker-compose.yml`.
4. Install Foundry and cast SigNoz plus MCP.
5. Create SigNoz service account and local API key.
6. Configure Claude Code OTLP export.
7. Build and test GreenLight API and web.
8. Install the Git hook only in the LMS demo clone.
9. Instrument and launch the LMS backend on port `8081`.
10. Import SigNoz dashboards and create the alert.
11. Run the smoke script.

### 15.3 GreenLight commands

Define these root scripts:

```json
{
  "scripts": {
    "dev": "npm-run-all --parallel dev:api dev:web",
    "dev:api": "npm --workspace apps/api run dev",
    "dev:web": "npm --workspace apps/web run dev",
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces --if-present",
    "verify": "npm run typecheck --workspaces --if-present && npm test && npm run build",
    "test:e2e:smoke": "playwright test --grep @smoke",
    "db:migrate": "npm --workspace apps/api run db:migrate",
    "demo:baseline": "bash scripts/demo-baseline.sh",
    "demo:regression": "bash scripts/demo-regression.sh",
    "demo:recover": "bash scripts/demo-recover.sh",
    "demo:smoke": "bash scripts/smoke.sh"
  }
}
```

If avoiding `npm-run-all`, use two terminals rather than adding it.

### 15.4 Reproducibility decision

By the end of Phase 0, decide whether judges can access the LMS demo branch:

- **Preferred:** publish or provide a sanitized, license-safe LMS demo branch pinned by commit.
- **If LMS must remain private:** include a minimal fixture HTTP service solely for judge reproduction while using LMS in the recorded demo. The fixture should expose one route with good/bad latency modes and must take no more than one hour to build.

Do not publish proprietary LMS code or real data merely for reproducibility.

## 16. Phased implementation plan

### Phase 0 — Freeze scope and isolate work (1–2 hours)

**Dependencies:** None.
**Goal:** Create clean provenance and protect the existing LMS worktree.

Tasks:

1. Create the separate GreenLight repository after the hackathon start date.
2. Add README skeleton, `PROVENANCE.md`, license, `.gitignore`, and `.env.example`.
3. Record LMS baseline commit `2269d064f0be50e7f6485c0be38e3cdcef6137d2`.
4. Create a clean LMS demo clone or worktree and `greenlight-demo` branch.
5. Decide whether the LMS demo branch may be shared with judges.
6. Inventory any genuinely pre-existing generic Playwright harness, browser cache, auth helpers, or fixtures and record them in `PROVENANCE.md`.
7. If no harness exists, time-box generic setup before UI work; do not make it a phase gate.
8. Verify `better-sqlite3` installs and opens a database on the presentation machine's Apple Silicon/Node 20 environment.
9. Add the Track 3 rationale and SigNoz issue `#11657` anchor to the README skeleton.
10. Write the one-sentence pitch and lock the demo route.
11. Create an issue/task board with only phases in this plan.

Expected outputs:

- Clean GreenLight repository.
- Isolated LMS demo path.
- Provenance statement.
- Reproducibility decision.
- Frozen MVP/non-goal list.

Exit gate:

- `git status` is clean in GreenLight and the LMS demo clone.
- The original `/Users/siddhant/Desktop/lms` tree remains untouched.

### Phase 1 — Establish SigNoz and LMS baseline telemetry (2–3 hours)

**Dependencies:** Phase 0.
**Goal:** See correctly versioned LMS traffic in SigNoz before building GreenLight logic.

Tasks:

1. Add `casting.yaml` with MCP enabled.
2. Run `foundryctl gauge -f casting.yaml` first. Treat failure as a Day-1 blocker and correct the environment/configuration before continuing.
3. Run Foundry forge and cast; commit the generated `casting.yaml.lock`.
4. Verify SigNoz UI, required OTLP HTTP port `4318`, and MCP health. Port `4317` is not a GreenLight gate.
5. Create a SigNoz service account/API key.
6. Trace the `/home/overview` dependency path and start only the PostgreSQL/Redis/RabbitMQ/MinIO services it genuinely requires; record the minimal demo profile.
7. Download and pin the exact OpenTelemetry Java agent version.
8. Build the clean LMS backend.
9. Run it on port `8081` with `service.version=<baseline SHA>` and `OTEL_TRACES_SAMPLER=always_on`.
10. Build `load-home-overview.mjs` to authenticate with synthetic credentials and call the target route at controlled concurrency.
11. Generate at least 250 request spans.
12. Inspect a real span and pin the filterable keys used by the evaluator—expected `http.route`, resource `service.version`, `deployment.environment.name`, status code, and JDBC attributes—in `TELEMETRY_CONTRACT.md`.
13. Prove Query Builder can filter the exact route and full version value.
14. Save a baseline Query Builder view and record its URL.

Expected outputs:

- Working Foundry deployment and lock file.
- Healthy LMS backend with zero-code instrumentation.
- Deterministic load script.
- Visible baseline spans and measurements.

Exit gate:

- Query Builder returns at least 200 baseline spans for the exact route and version.
- The exact route, version, environment, status, and JDBC attribute keys are documented from observed telemetry rather than assumed.
- SigNoz MCP responds and can list/query the LMS service.

### Phase 2 — Build the Claude-to-commit trace bridge (2–3 hours)

**Dependencies:** Phase 1 OTLP ingestion.
**Goal:** Produce one commit that carries a real Claude Code trace context.

Tasks:

1. Configure Claude Code beta traces, logs, and metrics with content flags disabled, `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1`, and `OTEL_TRACES_SAMPLER=always_on`.
2. Verify a Claude interaction trace appears in SigNoz.
3. Run a harmless Bash command through Claude and verify `TRACEPARENT` is present in that subprocess.
4. Implement and unit-test the shared traceparent parser.
5. Implement the `prepare-commit-msg` hook.
6. Test the hook in a temporary repository.
7. Install it only in the clean LMS demo repository.
8. Ask Claude Code to make a harmless documentation change and commit it.
9. Verify the commit trailer and corresponding SigNoz trace.

Expected outputs:

- Privacy-safe Claude Code telemetry.
- Tested Git hook installer.
- Real commit with `AI-Traceparent`.

Exit gate:

- The trace ID in the trailer opens or can be found in SigNoz.
- The later CI span link can navigate to this preserved trace in SigNoz's Links tab.
- A human commit without trace context remains unmodified.

Fallback:

- If beta tracing or `TRACEPARENT` propagation fails, use a Claude `SessionStart` hook to place `session_id` in a dedicated environment variable and add an `AI-Session-Id` trailer. Record this as a degraded correlation mode and continue; do not block the entire project.

### Phase 3 — Build GitHub sync and CI trace synthesis (3–4 hours)

**Dependencies:** Phase 2 trailer format; completed GitHub Actions run.
**Goal:** Render the LMS workflow as a linked trace in SigNoz.

Tasks:

1. Scaffold Fastify API, configuration, SQLite connection, and migrations.
2. Add repository/change/pipeline tables and data access functions.
3. Implement read-only GitHub client and recorded fixtures.
4. Implement commit-trailer extraction.
5. Configure the exact backend workflow name and implement single-primary selection across backend/frontend runs.
6. Implement workflow/job/step normalization.
7. Implement explicitly labeled reconstructed span creation using original timestamps.
8. Add the AI span context as a link only on the primary workflow root.
9. Map conclusions to span status.
10. Implement idempotent `/github/sync-runs`.
11. Push a harmless LMS demo commit and let both existing workflows complete.
12. Sync the runs and inspect the primary and related traces in SigNoz.

Expected outputs:

- Migrated SQLite database.
- Tested GitHub sync endpoint.
- Workflow → job → step trace.
- Linked AI context on the CI root.
- Exactly one primary backend run plus any secondary related runs.

Exit gate:

- Re-sync creates no duplicate database row or duplicate trace.
- Zero or multiple primary-workflow matches fail explicitly rather than choosing arbitrarily.
- Start/end times and hierarchy match GitHub.
- GitHub run URL and SigNoz trace URL are available.

### Phase 4 — Record deployments and evaluate regressions (3–4 hours)

**Dependencies:** Phases 1 and 3.
**Goal:** Connect a deployed SHA to measured LMS impact.

Tasks:

1. Add deployment and regression database migrations.
2. Implement authenticated deployment recording.
3. Write LMS deploy script with health/readiness checks.
4. Confirm the deployed SHA is passed as `service.version`.
5. Implement SigNoz Query Builder v5 client.
6. Save and test baseline p95, observed p95, error rate, request count, and slow-trace payloads.
7. Implement sample gates, normal/recovery baseline selection, and deterministic rules.
8. Persist results and evidence links.
9. Add regression evaluation endpoint.
10. Add recovery evaluation against the original baseline.
11. Instrument the GreenLight API itself and verify `service.name=greenlight-api` traces in SigNoz.

Expected outputs:

- Deployment spans and database records.
- Reviewed, version-controlled SigNoz queries.
- Regression/recovery evaluator with fixtures.

Exit gate:

- Healthy baseline evaluates as healthy.
- Insufficient traffic evaluates as insufficient rather than healthy.
- Recorded regression fixture evaluates as regressed.
- Recovery reuses the original good baseline and both compared versions are auditable from its evaluation row.
- No integration error is converted to a zero metric.
- GreenLight's own health, sync, deployment, and evaluation requests are visible in SigNoz.

### Phase 5 — Build the GreenLight Change Receipt UI (3–4 hours)

**Dependencies:** Stable receipt API from Phases 3–4.
**Goal:** Make the evidence chain understandable in under 30 seconds.

Tasks:

1. Scaffold React/Vite web app and API client.
2. Build `/changes` list.
3. Build receipt header and status system.
4. Build chronological evidence timeline.
5. Build before/after measurement cards.
6. Build CI duration/slowest-step section.
7. Add GitHub and SigNoz evidence links.
8. Add recovery state and copyable revert command.
9. Implement all empty/error/insufficient-data states.
10. Add responsive and accessibility pass.
11. Add required component tests.
12. Fill only the product-specific page-object methods needed by the finished DOM and, if the critical path is already green, add the optional isolated Playwright happy path.

Expected outputs:

- Polished two-route application.
- Stable receipt visual hierarchy.
- Working evidence links.

Exit gate:

- A first-time viewer can answer “what changed, what broke, and where is the proof?” without explanation.
- UI is usable at laptop and narrow viewport widths.

### Phase 6 — Create and freeze the LMS regression scenario (2–3 hours)

**Dependencies:** Phases 1, 2, 3, 4, and the Phase 5 receipt shell.
**Goal:** Produce a realistic, deterministic incident and recovery.

Selected scenario:

- Claude Code changes `HomeDashboardService` in the isolated LMS demo branch.
- The change introduces a believable N+1 or repeated repository-call regression while preserving functional output.
- The bad-version demo profile applies a prepared request or database statement timeout so the slow tail can produce a controlled 5–15% 5xx rate while repeated JDBC spans still identify the N+1 as the cause.
- Existing functional tests pass.
- Synthetic portfolio data makes the performance difference visible.
- The load script repeatedly calls `/api/v1/internal/home/overview`.
- JDBC child spans show why the request became slower.

Tasks:

1. Record the clean good deployment with `role=baseline` and measure its synthetic-data window.
2. Ask Claude Code to make the prepared bad change and commit it through the trace-enabled path.
3. Add or retain tests that verify functional correctness but do not artificially force the failure.
4. Push and allow GitHub Actions to pass.
5. Sync CI trace.
6. Deploy the bad SHA.
7. Generate traffic and evaluate.
8. Tune data scale, concurrency, and the prepared timeout only until both latency and the 5–15% error band repeat; never tune evaluator thresholds to one lucky run.
9. Time-box the timeout/error-band work to 30 minutes. If it is not repeatable, explicitly frame the incident as latency-only and hide/de-emphasize an unchanged error card rather than displaying a misleading `0% → 0%` headline.
10. Prepare a corrective commit restoring the efficient query.
11. Deploy recovery and prove recovered status.
12. Save bad/recovery patches or exact commits for repeatability.

Expected outputs:

- Fixed baseline, bad, and recovery SHAs.
- Repeatable p95/error measurements.
- Representative JDBC-heavy slow traces.
- Complete regressed and recovered receipt.

Exit gate:

- Two consecutive clean rehearsals produce the same qualitative outcome.
- The bad version crosses the rule with enough samples.
- The good version returns within the recovery bound.
- The receipt either shows a repeatable real error-rate increase or explicitly presents the incident as latency-only.

Fallback scenario:

- If a natural N+1 regression is not deterministic within one hour, use a clearly disclosed demo-only latency fault guarded by `GREENLIGHT_DEMO_FAULT=true`. Reliability is more important than pretending an unstable fault is organic.

### Phase 7 — Polish, verify, record, and submit (3h 15m bottom-up; 4h 15m risk budget)

**Dependencies:** All P0 phases; P1 work is included only when explicitly retained.
**Goal:** Freeze a reliable submission and demonstration.

Tasks:

1. Run required unit, integration, component, hook, build, and telemetry smoke tests.
2. Run backend LMS tests in the clean demo clone.
3. Import/finalize SigNoz dashboards and alert.
4. If submitting to Track 3, run and capture the GL-P7-T01 fixed MCP investigation prompt; otherwise record that P1 cut in the submission checklist.
5. Run a soft `demo-reset`, baseline, regression, and recovery sequence without regenerating preserved upstream traces.
6. Write final README with architecture, setup, provenance, limitations, screenshots, and AI disclosure.
7. Write a four-minute `DEMO_SCRIPT.md` with exact clicks and narration.
8. Pre-open and order browser tabs.
9. Record a backup successful demo before making cosmetic changes.
10. Record final video.
11. Verify repository is public or accessible as required, secrets are absent, and setup is reproducible.
12. If the required gates are green and time remains, run the optional Playwright happy-path smoke once; do not hold submission for browser flake debugging.
13. Add one README paragraph explaining why CI spans are synthesized: the GitHub REST reconstruction permits the required OTel span link to the Claude context.
14. Add concise README sections for prepared workload versus live analysis, polling versus webhooks, transparent demo thresholds, and the production evolution path.
15. Submit early; do not wait until the final minutes.

Expected outputs:

- Passing verification suite.
- Stable dashboards and alert.
- Final README and demo script.
- Backup and final recordings.
- Submission-ready repository.

Exit gate:

- The demo can be completed from memory in under four minutes.
- All links, credentials, tabs, data, and recovery commits are prepared.
- No must-have depends on a live code edit during judging.

## 17. Execution order and dependency map

Critical path:

```text
Phase 0 isolate work
  → Phase 1 SigNoz + LMS baseline
  → Phase 2 AI trace bridge
  → Phase 3 CI trace synthesis
  → Linkage pivot gate
  → Phase 4 deployment + regression evaluator
  ├→ Phase 5 receipt UI
  └→ Phase 6 deterministic incident
       → Phase 7 end-to-end verification, rehearsal, and submission
```

Phase 5 UI begins after the Phase 3 API contract stabilizes and continues alongside Phase 4/6. GL-P3-T05 is a hard dependency of the full receipt and runs immediately when GL-P2-T04 plus GL-P3-T04 unblock it. Incident tuning starts after GL-P4-T04; it does not wait for finished UI polish. GL-P7-T02 verifies that the prepared incident is visible end to end after both branches converge.

The generated 30-issue manifest is the estimating authority. Its bottom-up estimate is **2,660 focused minutes = 44 hours 20 minutes**, not 26.5 hours. A 1.3× integration factor yields roughly **57 hours 40 minutes of solo wall-clock effort**. The earlier 26.5/36-hour claim was top-down and is retired because it contradicted the implementable slices.

| Phase | Bottom-up focused | 1.3× risk budget | Blocking gate |
|---|---:|---:|---|
| 0. Scope and isolation | 2h 30m | 3h 15m | Clean repositories, provenance, workflow triggers, SQLite native-module check |
| 1. SigNoz and baseline | 4h 20m | 5h 40m | Foundry validated Day 1; backdated span, versioned spans, and filterable keys confirmed |
| 2. AI trace bridge | 4h 30m | 5h 50m | Backend-triggering trailer commit resolves to preserved Claude trace |
| 3. CI trace synthesis | 7h 15m | 9h 25m | Linked workflow trace; SigNoz navigation works |
| **Linkage pivot** | — | — | **No later than July 24, 2026 at 18:00 IST: if the clickable Claude→CI link is not green, freeze the deterministic session-ID fallback and stop debugging beta linkage** |
| 4. Deployment and regression | 9h | 11h 40m | Healthy, regressed, recovered, and insufficient states are correct |
| 5. Receipt UI | 8h 30m | 11h 5m | First-time comprehension in 30 seconds |
| 6. Incident scenario | 5h | 6h 30m | Two qualitatively identical rehearsals |
| 7. Polish and submission | 3h 15m | 4h 15m | Sub-four-minute demo; Track 3 MCP beat if retained |
| **Total** | **44h 20m** | **57h 40m** | — |

This is not a 26.5-hour solo plan. Either add human teammates or accept a compressed, high-risk solo schedule. Three pre-declared P1 cuts save 3h 45m focused, leaving a **40h 35m P0 spine**. Cut them in this order when a gate slips:

1. **GL-P5-T03 standalone changes list** — route the demo directly to the prepared receipt.
2. **GL-P4-T06 GreenLight self-observability panel** — retain LMS/CI/Claude telemetry and disclose the cut.
3. **GL-P7-T01 fixed MCP investigation** — this preserves a Track 1 submission but gives up the Track 3 differentiator. If submitting to Track 3, promote this task back to P0 and do not cut it.

No optional policy, notification, screenshot, or export work begins while any unblocked P0 issue remains. Protect the linkage pivot and submission buffer rather than silently borrowing from them.

## 18. Must-have versus optional backlog

### P0 — minimum judged spine

- Foundry SigNoz + MCP with casting lock.
- Early proof that SigNoz accepts and displays a two-hour-backdated span.
- LMS Java-agent instrumentation and version propagation.
- Claude trace export and traceparent Git trailer.
- A harmless backend no-op proof commit that actually triggers Backend CI and retains `AI-Traceparent`.
- GitHub run/job/step sync.
- CI trace with AI span link.
- Deployment recording.
- One frozen good baseline plus candidate/recovery queries.
- Deterministic regression and recovery evaluation.
- Change Receipt detail page.
- Dashboard, alert, deep links.
- Repeatable bad and recovery LMS commits.
- Tests, provenance, AI disclosure, README, demo script.

### P1 — pre-declared schedule cuts

- GL-P5-T03 standalone changes-list page.
- GL-P4-T06 GreenLight API self-observability panel.
- GL-P7-T01 fixed, rehearsed SigNoz MCP investigation. It is required only if retaining the Track 3 submission path.

### Optional only after all P0 gates pass

- Transparent `review_required` policy.
- Slack notification.
- GitHub PR comment.
- Copyable query/export bundle.
- Minimal public fixture if LMS cannot be shared.
- Cost/queue-time CI metrics.
- Screenshot export of a receipt.

### Explicitly deferred

- Automatic rollback.
- Prediction/model training.
- Multi-repository and multi-CI support.
- DORA/flaky-test suite.
- Team accounts and hosted SaaS.

## 19. Risks, limitations, and mitigations

| Risk | Impact | Mitigation / pivot gate |
|---|---|---|
| Claude beta tracing unavailable | AI span link blocked | Test in Phase 2; fall back to session-ID trailer |
| Claude beta behavior changes later | Reproduction fails | Pin and disclose the exact verified Claude Code version |
| Claude trace sampled out or proxy suppresses context | Dead span link | Force propagation and `always_on`; verify exported target before freezing commit |
| GitHub token/rate limits | CI sync unavailable | Fine-grained token, fixtures, one repository, cached run |
| Post-hoc spans malformed | SigNoz trace unreadable | Fixture tests for timestamps/hierarchy before live sync |
| Reconstructed spans are mistaken for native runtime telemetry | Judge/SRE trust loss | Explicit span names/attributes, architecture note, and rehearsed explanation |
| Multiple workflows compete for one receipt | Wrong CI evidence | Exact primary workflow config and one-primary database constraint |
| Recovery baseline is ambiguous | Incorrect recovery claim | Persist baseline deployment and both compared versions; deterministic selection rule |
| LMS dirty worktree contamination | Loss/misattribution | Separate clone/worktree; never touch original tree |
| LMS startup complexity | Demo delay | Freeze infrastructure, credentials, and seed state after Phase 1 |
| Regression not deterministic | Demo fails | One-hour N+1 gate, 30-minute timeout/error-band gate, then disclosed fault flag or latency-only framing |
| Too little telemetry | False healthy | Minimum 200 spans, load target 250, and explicit insufficient-data status |
| Time-zone conversion error | Wrong comparison window | UTC-only storage and epoch conversion round-trip test |
| SigNoz API changes | Evaluator breaks | Keep queries as versioned payloads behind one adapter |
| Sensitive financial/AI data leaks | Serious privacy issue | Synthetic LMS data; content flags off; no payload storage |
| Local resource exhaustion | Containers fail | Trace route dependencies, start only required LMS services, allocate sufficient Docker memory, and run preflight |
| Polling is not real-time | “Flight recorder” expectation mismatch | Disclose local polling; document authenticated webhooks as production evolution |
| Existing LMS unavailable to judges | Reproduction gap | Share sanitized branch or add one-hour minimal fixture |
| Scope creep | Incomplete core demo | Block optional work until two full rehearsals pass |

## 20. Demo flow and narration

Target duration: 3 minutes 30 seconds to 4 minutes.

### Beat 1 — Problem and baseline (25 seconds)

- Show the LMS home dashboard responding normally.
- Show SigNoz Deployment Impact dashboard with healthy p95 and errors.
- Say: “AI-assisted code can pass CI and still hurt production. The hard part is connecting the agent session to the actual customer impact.”

### Beat 2 — AI change and CI (45 seconds)

- Show the prepared Claude Code session briefly.
- Show the bad commit and `AI-Traceparent` trailer.
- Show the green GitHub Actions run.
- Trigger the GreenLight sync live; show that it selects the backend workflow as primary.
- Open the CI trace in SigNoz and expand workflow → job → slowest step.
- Point out the reconstructed-telemetry labels.
- Say: “GreenLight faithfully reconstructs the completed run from GitHub's timing API, labels it as reconstructed, and links it to the agent trace using OpenTelemetry.”

### Beat 3 — Deployment and incident (45 seconds)

- Deploy the bad SHA using the prepared script or show the recorded successful deployment if timing is risky.
- Use the rehearsal-prepared 90-second baseline and observed windows; do not wait for them live.
- Trigger the GreenLight evaluation live against those preserved SigNoz windows.
- Show the SigNoz alert and p95/error change grouped by `service.version`.
- Open one slow LMS trace and point to repeated JDBC spans.
- Say: “The build was green. Production wasn't.”

### Beat 4 — Change Receipt (60 seconds)

- Open GreenLight's receipt.
- Refresh it live after evaluation rather than opening a pre-authored result.
- Walk down Claude → commit → CI → deployment → impact.
- Point out exact before/after values, sample counts, slow trace, and GitHub/SigNoz links.
- Say: “This is not an AI guess. Every claim links to the underlying telemetry.”

### Beat 5 — Recovery and close (35 seconds)

- Show the corrective deployment and recovered measurements.
- Run the fixed, rehearsed Claude Code prompt through SigNoz MCP and show that its p95/error comparison and three slow traces agree with GreenLight.
- Require the MCP response to describe temporal/version correlation and forbid causal language such as “this commit caused” unless a human investigation establishes it.
- Point out that `greenlight-api` also monitors itself in SigNoz.
- Say: “A Claude session wrote this change; a Claude session, through SigNoz MCP, independently confirmed its impact from the same telemetry.”
- Close with: “Your agent shipped the change. GreenLight carries its trace all the way to production—and shows the receipt.”

### Demo safety rules

- Never rely on a fresh dependency installation during the recording.
- Pre-seed synthetic data and pre-authenticate LMS/GreenLight/SigNoz tabs.
- Keep the bad and recovery commits immutable.
- Keep the Claude and CI traces immutable; use only the soft reset during rehearsals and judging.
- Record a successful backup demo before the final take.
- If live deployment timing is variable, show the deployment command, then use the already-generated telemetry window while clearly saying it was prepared for the demo.
- Prepared traffic is acceptable; prepared conclusions are not. Sync, evaluation, and receipt assembly run live; MCP querying also runs live when the Track 3 P1 task is retained.

## 21. Final definition of done

### Product

- The required Change Receipt page works and handles failure states.
- The standalone changes list works only if GL-P5-T03 remains in scope.
- Complete receipt exists for baseline, bad, and recovery versions.
- Receipt shows exactly one primary backend pipeline and labels any secondary workflows as related.
- No core step requires manual database editing.

### Telemetry

- Claude, CI, deployment, and LMS traces are visible in SigNoz.
- GreenLight API traces are visible in SigNoz only if GL-P4-T06 remains in scope.
- Commit SHA is consistent across GitHub, SQLite, deployment, and `service.version`.
- CI root contains a valid span link or clearly labeled fallback linkage.
- Every reconstructed CI root is labeled as reconstructed and records its GitHub source.
- Every evaluation records its baseline deployment plus baseline and observed versions.
- Dashboard and alert use reviewed Query Builder queries.
- If submitting to Track 3, the fixed MCP investigation agrees with GreenLight's deterministic result; otherwise its omission is disclosed as the GL-P7-T01 P1 cut.

### Engineering

- Required unit, Fastify-inject integration, web component, Git-hook, build, and telemetry smoke tests pass.
- The generic Playwright harness is pre-warmed and provenance is documented; the single product happy-path browser smoke is optional and non-blocking.
- Sync and deployment recording are idempotent.
- Primary-workflow and recovery-baseline selection are deterministic and covered by fixtures.
- Configuration validates on startup.
- Secrets and sensitive data are absent from repository and UI.
- GreenLight and LMS demo repositories are clean and pinned.

### Reproducibility

- `casting.yaml` and `casting.yaml.lock` are committed.
- `.env.example`, bootstrap, smoke, reset, baseline, regression, and recovery scripts exist.
- LMS baseline and demo commits are documented.
- A judge-access plan exists for the LMS or fallback fixture.

### Presentation

- README explains problem, solution, architecture, setup, provenance, limitations, and AI usage.
- Four-minute demo script is rehearsed twice.
- Prepared workload windows are disclosed while sync, evaluation, and receipt assembly run live; MCP analysis runs live when the Track 3 task remains in scope.
- Screenshots and video contain only synthetic data and no secrets.
- Submission is made before the deadline buffer.

## 22. Source references

- Hackathon overview and judging criteria: <https://www.wemakedevs.org/hackathons/signoz>
- Hackathon rules and Foundry requirements: <https://www.wemakedevs.org/hackathons/signoz/rules>
- SigNoz Foundry Docker installation: <https://signoz.io/docs/install/docker/>
- SigNoz Java/OpenTelemetry instrumentation: <https://signoz.io/docs/instrumentation/java/opentelemetry-java/>
- SigNoz Query Builder v5: <https://signoz.io/docs/userguide/query-builder-v5/>
- SigNoz metrics API: <https://signoz.io/docs/metrics-management/query-range-api/>
- SigNoz traces API: <https://signoz.io/docs/apm-and-distributed-tracing/traces-api/>
- SigNoz span links and cross-trace navigation: <https://signoz.io/docs/traces-management/guides/span-links/>
- Claude Code OpenTelemetry monitoring: <https://code.claude.com/docs/en/monitoring-usage>
- GitHub workflow jobs API: <https://docs.github.com/en/rest/actions/workflow-jobs?apiVersion=2022-11-28>
- OpenTelemetry CI/CD semantic conventions: <https://opentelemetry.io/docs/specs/semconv/cicd/>
- OpenTelemetry trace links: <https://opentelemetry.io/docs/specs/otel/trace/api/>
- OpenTelemetry Protocol (OTLP): <https://opentelemetry.io/docs/specs/otlp/>
- OpenTelemetry SDK environment variables and sampling: <https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/>
- Spring Boot health probes: <https://docs.spring.io/spring-boot/reference/actuator/endpoints.html>
- SigNoz deployment-guardian issue `#11657`: <https://github.com/SigNoz/signoz/issues/11657>
- Git hooks: <https://git-scm.com/docs/githooks>
- Git trailers: <https://git-scm.com/docs/git-interpret-trailers>

## 23. Claude audit resolution record

| Finding | Disposition | Roadmap change |
|---|---|---|
| MF-1 reset destroys links | Accepted | Immutable Claude/CI evidence plus separate soft and hard reset contracts |
| MF-2 p95 with 20 samples | Accepted | 200-span verdict floor, 250-span load target, p90 context |
| MF-3 N+1 has no errors | Accepted with bounded fallback | Prepared timeout targets 5–15% errors; 30-minute pivot to honest latency-only UI |
| MF-4 MCP was optional | Accepted | Fixed MCP investigation is now a required success criterion, Phase 7 gate, and closing demo beat |
| MF-5 Foundry schema unknown | Verified and reframed | Official docs confirm the YAML; `gauge` remains the Day-1 oracle and submission gate |
| SF-1 proxy/sampling caveat | Accepted | Force Claude trace propagation and `always_on`; verify the actual exported target |
| SF-2 readiness path | Accepted | Use `/actuator/health` unless probes are explicitly enabled |
| SF-3 query keys assumed | Accepted | Pin agent version and prove actual filterable keys in Phase 1 |
| SF-4 UTC discipline | Accepted | UTC-only storage, boundary conversion, and round-trip unit test |
| SF-5 windows exceed demo | Accepted | Configurable 90-second windows generated during rehearsal preparation |
| SF-6 Playwright critical path | Accepted | Pre-warmed generic harness; optional non-blocking product smoke |
| SF-7 no buffer/pivot | Superseded by bottom-up issue estimate | 44h 20m focused / about 57h 40m risk budget; named July 24 linkage pivot retained |
| SF-8 GreenLight not dogfooded | Accepted | `greenlight-api` traces and dashboard/demo mention |
| SF-9 Track 3 rationale | Accepted | README rationale plus SigNoz issue `#11657` anchor |

## 24. Deep schema and architecture audit resolution

| Finding / decision | Resolution |
|---|---|
| Reconstructed, backdated CI spans | Keep; label every root as reconstructed, record GitHub provenance, and use the rehearsed judge explanation in §5.4 |
| Backend and frontend workflows for one commit | Store both, enforce exactly one configured primary backend run, link Claude only to primary, and show secondary runs as related |
| Recovery baseline ambiguity | Add explicit/automatic baseline selection rules and persist `baseline_deployment_id` |
| Evaluation version ambiguity | Persist `baseline_service_version`, `observed_service_version`, and comparison kind |
| Optional review policy lacks paths | Add nullable, path-only `changed_paths_json`; populate only if P1 is built |
| TypeScript and shell validators can drift | Use one shared accepted/rejected traceparent vector file in both test suites |
| Duplicate GitHub evidence source | Use `pipeline_runs.html_url` for CI; reserve `evidence_links` for regression-scoped SigNoz evidence |
| Phase 6 omitted Phase 2 | Phase 2 is now explicit in the dependency list |
| OTLP versus OLTP confusion | Add the plain-language distinction in §5.2 |
| Why gRPC is exposed | Document `4317` as an unused collector default; standardize the MVP on HTTP/protobuf `4318` |
| Prepared regression credibility | Prepare traffic for reliability, but execute sync, evaluation, receipt assembly, and MCP investigation live |
| Heavy single-laptop topology | Determine route dependencies and start only the minimal LMS infrastructure profile |
| Polling rather than webhook ingestion | Keep for local scope; disclose it and document the production webhook evolution |
| Beta Claude reproducibility | Pin and disclose the exact verified Claude Code version |
| Hand-tuned thresholds | Present them as a transparent demo policy, not a universal SLO |
| Local-first production potential | Add the hosted/webhook/queue/PostgreSQL/multi-repo evolution path |
| Merge/amend/squash hook semantics | Inject only on normal commits; preserve/skip generated commit messages |

## 25. Thirty-issue decomposition audit resolution

| Finding | Disposition | Roadmap change |
|---|---|---|
| Bottom-up estimates total 44 hours rather than 26.5 | Accepted | Retire the top-down claim; publish 2,660 focused minutes and an approximately 57h 40m risk budget |
| All issues are P0 | Accepted | Mark GL-P4-T06, GL-P5-T03, and GL-P7-T01 P1; document their cut order and Track 3 consequence |
| Proof commit may not trigger Backend CI | Accepted | GL-P0-T02 records workflow path filters; GL-P2-T04 changes a harmless matching backend file and proves one Backend CI run exists |
| Baseline temporal model is ambiguous | Accepted | Capture one frozen GL-P4-T02 window and reuse its `baseline_deployment_id` for candidate and recovery comparisons |
| Claude→CI differentiator is a leaf | Accepted | Make GL-P3-T05 a hard dependency of GL-P5-T02 and schedule it immediately when unblocked |
| Backdated-span support is discovered too late | Accepted | Add a 20-minute, two-hour-backdated OTLP span spike to GL-P1-T01 |
| Incident tuning waits for finished UI | Accepted | Remove GL-P5-T05 from GL-P6-T01; converge incident and UI branches in GL-P7-T02 |
| Phase 1 prematurely requires 200 spans | Accepted | Require an accurate small-sample query in GL-P1-T03; enforce the 200-span floor in GL-P4-T02 onward |
| Human-only attribution could strip demo evidence | Accepted | Explicitly retain `AI-Traceparent` on LMS proof and incident commits while keeping GreenLight commits human-authored |
| Universal TDD is too costly for infrastructure | Accepted | Use strict TDD for ten logic-heavy issues and evidence-capturing smoke verification for integration issues |
| Risky integration estimates remain optimistic | Accepted without false precision | Keep the honest bottom-up total, add the 1.3× risk budget, and preserve pivot/cut gates instead of shrinking estimates |
