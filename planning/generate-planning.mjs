import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const task = (id, phase, title, component, estimate, depends, objective, files, tests, steps, acceptance, telemetry, fallback, commit, priority = "p0") => ({
  id, phase, title, component, estimate, depends, objective, files, tests, steps, acceptance, telemetry, fallback, commit, priority,
});

const tasks = [
  task("GL-P0-T01", 0, "Bootstrap repository, provenance, and validated configuration contract", "docs", 60, [],
    "Produce a clean repository whose ownership, pre-existing LMS boundary, secret policy, configuration surface, and authoritative roadmap are immediately auditable.",
    ["README.md", "PROVENANCE.md", ".env.example", "SECURITY.md", "GREENLIGHT_IMPLEMENTATION_PLAN.md"],
    ["Secret-pattern scan rejects credential-like fixtures", "Config-key inventory matches the implementation plan"],
    ["Verify sid12701 repository-local author identity", "Document pre-existing LMS baseline and AI assistance", "Add non-secret environment examples", "Link every planning artifact from README"],
    ["Repository contains no product implementation", "No secret or real borrower data is present", "Provenance separates LMS from GreenLight", "All planning entrypoints resolve"],
    "None; this slice establishes the contract for later telemetry.",
    "Stop if repository identity or licensing is ambiguous; record the decision in docs/OPEN_DECISIONS.md.",
    "chore: initialize GreenLight implementation roadmap (#issue)"),

  task("GL-P0-T02", 0, "Create isolated LMS demo workspace and minimal runtime preflight", "lms", 90, ["GL-P0-T01"],
    "Prove the demo can use the existing LMS without touching its dirty checkout and without starting unnecessary infrastructure.",
    ["integrations/lms/README.md", "integrations/lms/demo-config.example", "scripts/preflight.sh"],
    ["Preflight fails when LMS_PATH points at /Users/siddhant/Desktop/lms", "Preflight confirms baseline SHA and clean demo worktree", "Dependency checklist identifies only services used by home overview"],
    ["Create a clean clone/worktree at baseline commit", "Create greenlight-demo branch", "Inspect home-overview runtime dependencies", "Record minimal compose services and port 8081", "Verify original LMS status is unchanged"],
    ["Original LMS worktree hash/status remains unchanged", "Clean demo worktree is pinned and documented", "Only required infrastructure is selected", "Preflight exits non-zero on unsafe paths"],
    "No telemetry yet; output the exact service and route that Phase 1 will instrument.",
    "If LMS cannot be isolated in 45 minutes, create the documented minimal fixture path without modifying the original checkout.",
    "chore(lms): isolate demo workload and preflight (#issue)"),

  task("GL-P1-T01", 1, "Validate Foundry casting and start SigNoz with MCP", "signoz", 90, ["GL-P0-T02"],
    "Create a reproducible SigNoz installation whose UI, OTLP HTTP receiver, and MCP health endpoints are available.",
    ["casting.yaml", "casting.yaml.lock", "signoz/README.md", "scripts/signoz-smoke.sh"],
    ["Casting schema passes foundryctl gauge", "Smoke test checks UI 8080, OTLP HTTP 4318, and MCP livez 8000", "Port 4317 is not treated as required"],
    ["Add official Foundry casting", "Run gauge before forge", "Generate and inspect lock", "Cast services", "Create service-account setup instructions", "Run health smoke"],
    ["casting.yaml and generated lock are committed", "SigNoz UI responds", "OTLP HTTP accepts telemetry", "MCP livez responds", "No credentials are committed"],
    "SigNoz is the telemetry source of truth; gRPC 4317 is an unused default listener.",
    "If cast is blocked, use Foundry-generated compose for local progress but keep successful Foundry output mandatory for submission.",
    "chore(signoz): add reproducible Foundry stack (#issue)"),

  task("GL-P1-T02", 1, "Export one versioned LMS request trace with JDBC children", "lms", 90, ["GL-P1-T01"],
    "Send a real home-overview request through the Java agent and prove its trace carries the exact baseline commit SHA.",
    ["instrumentation/lms-java-agent/env.example", "integrations/lms/deploy.sh", "integrations/lms/verify.sh"],
    ["Deploy script rejects non-40-character SHAs", "Health gate uses /actuator/health", "Verification fails when service.version differs"],
    ["Pin Java agent version", "Build clean LMS backend", "Run on 8081 with always_on sampling", "Call authenticated synthetic route", "Find server and JDBC spans in SigNoz"],
    ["service.name is lms-backend", "service.version equals full baseline SHA", "environment is hackathon-demo", "At least one JDBC child is visible", "No real data is emitted"],
    "OTLP HTTP/protobuf to localhost:4318 with service/version/environment resource attributes.",
    "If readiness groups are explicitly enabled they may be checked additionally; /actuator/health remains the required gate.",
    "feat(lms): export versioned baseline traces (#issue)"),

  task("GL-P1-T03", 1, "Freeze the observed SigNoz attribute and query contract", "telemetry", 60, ["GL-P1-T02"],
    "Replace assumed semantic-convention keys with keys verified from actual LMS spans and prove route/version filtering.",
    ["docs/TELEMETRY_CONTRACT.md", "signoz/saved-views.md", "test/fixtures/signoz/baseline-query.json"],
    ["Fixture parser resolves observed route, version, environment, status, and JDBC keys", "Query fixture returns only the exact SHA and route"],
    ["Inspect real span attributes", "Record exact filterable keys", "Save Query Builder view URL", "Capture sanitized response fixture", "Pin Java agent version"],
    ["Contract names exact observed keys", "Query isolates /api/v1/internal/home/overview", "Full SHA filter works", "At least 200 spans can be counted"],
    "Reviewed Query Builder v5 contract becomes the boundary for all later evaluator work.",
    "If http.route is absent, document and use the actual stable key rather than rewriting data to match the plan.",
    "docs(telemetry): freeze LMS query contract (#issue)"),

  task("GL-P2-T01", 2, "Enable privacy-safe Claude Code telemetry", "telemetry", 60, ["GL-P1-T01"],
    "Export a Claude interaction and tool-execution trace while keeping prompts, tool details, and tool content disabled.",
    ["instrumentation/claude-code/env.example", "docs/SECURITY.md", "scripts/verify-claude-telemetry.sh"],
    ["Environment validation requires tracing, forced propagation, always_on sampling, and content flags off", "Verification fixture rejects prompt/tool-content attributes"],
    ["Pin claude --version", "Set OTLP HTTP endpoint", "Force TRACEPARENT propagation", "Run harmless tool action", "Verify trace in SigNoz", "Inspect privacy attributes"],
    ["claude-code trace is visible", "TRACEPARENT exists in Bash subprocess", "Prompt/tool contents are absent", "Exact Claude version is documented"],
    "Claude traces use OTLP HTTP and preserved W3C trace context.",
    "If beta tracing fails by the linkage pivot, use the documented SessionStart session-ID fallback.",
    "feat(telemetry): export privacy-safe Claude traces (#issue)"),

  task("GL-P2-T02", 2, "Implement shared W3C traceparent vectors and TypeScript parser", "telemetry", 75, ["GL-P2-T01"],
    "Create one canonical accepted/rejected vector set and a typed parser that cannot accept malformed or all-zero contexts.",
    ["packages/shared/src/traceparent.ts", "packages/shared/test-vectors/traceparent.json", "packages/shared/src/traceparent.test.ts"],
    ["Red tests cover version, length, hex, zeros, flags, whitespace, missing and duplicate trailers", "Parser returns structured errors without leaking input"],
    ["Write vectors first", "Implement Zod/typed result contract", "Normalize lowercase", "Split trace/span/flags", "Run focused and workspace tests"],
    ["Every vector has expected result", "Only version 00 accepted", "All-zero IDs rejected", "No tracestate stored", "Public contract is documented"],
    "Creates SpanContext inputs used by the CI span link.",
    "Invalid context never blocks CI sync; it records ai_link_status=invalid.",
    "test(trace): define traceparent contract and parser (#issue)"),

  task("GL-P2-T03", 2, "Install a safe prepare-commit-msg trace bridge", "github", 90, ["GL-P2-T02"],
    "Add exactly one AI-Traceparent trailer to a normal Claude-triggered commit without changing merge, squash, or amend provenance.",
    ["instrumentation/git-hooks/prepare-commit-msg", "instrumentation/git-hooks/install.sh", "instrumentation/git-hooks/test.sh"],
    ["Shell hook runs the shared vector cases", "Normal valid commit gets one trailer", "No context gets none", "Invalid context warns but commit succeeds", "merge/squash/amend add no new trailer"],
    ["Write temporary-repository tests", "Implement POSIX validator", "Inspect prepare-commit-msg source argument", "Use git interpret-trailers doNothing", "Install only in demo clone"],
    ["TS and shell validators agree", "Trailer is not duplicated", "Generated commits preserve existing provenance", "Original LMS hook directory is untouched"],
    "Stores W3C context in Git metadata; emits no new telemetry.",
    "If shell portability blocks progress, use a small Node hook launched by POSIX shell while retaining the same vectors.",
    "feat(git): bridge Claude trace context to commits (#issue)"),

  task("GL-P2-T04", 2, "Produce and freeze one trace-linked LMS commit", "github", 45, ["GL-P2-T03"],
    "Create a harmless commit through Claude Code and prove its trailer resolves to the preserved SigNoz span.",
    ["docs/EVIDENCE_LOG.md", "PROVENANCE.md"],
    ["Verification script parses commit trailer and checks the target trace/span exists", "Human commit fixture remains unmodified"],
    ["Ask Claude for a harmless docs change in demo clone", "Commit through traced Bash", "Record SHA and trace IDs", "Open target in SigNoz", "Freeze evidence"],
    ["Commit has one valid AI-Traceparent", "Linked span exists", "No content telemetry leaked", "Evidence IDs are recorded without secrets"],
    "This immutable Claude evidence is reused by later CI-link tests.",
    "Do not regenerate after Phase 3; if unavailable, freeze the labeled session-ID degraded mode.",
    "docs(evidence): freeze trace-linked commit proof (#issue)"),

  task("GL-P3-T01", 3, "Create metadata-only SQLite migrations and repositories", "api", 90, ["GL-P0-T01"],
    "Implement the normalized repository/change/pipeline/deployment/evaluation/evidence schema with primary-run and baseline auditability.",
    ["apps/api/src/db/migrations/001_initial.sql", "apps/api/src/db/migrate.ts", "apps/api/src/db/repositories/", "apps/api/test/db.test.ts"],
    ["Fresh migration succeeds", "Repeat migration is idempotent", "One primary pipeline constraint holds", "One demo baseline constraint holds", "Foreign keys and status checks reject invalid rows"],
    ["Write migration tests", "Implement schema from authoritative plan", "Enable foreign keys", "Add transactional migration runner", "Add temporary-db repositories"],
    ["All tables/indexes exist", "Evaluation stores both versions and baseline deployment", "SQLite contains metadata only", "Tests use temporary files"],
    "GreenLight API later emits its own DB request spans; SQLite does not replace SigNoz.",
    "If better-sqlite3 fails on Apple Silicon, stop at the Phase 0 native-module pivot and use the documented compatible version.",
    "feat(api): add GreenLight metadata schema (#issue)"),

  task("GL-P3-T02", 3, "Normalize recorded GitHub Actions fixtures", "github", 90, ["GL-P3-T01"],
    "Fetch and normalize commit, workflow, job, and step metadata without storing raw job logs.",
    ["apps/api/src/modules/github/client.ts", "apps/api/src/modules/github/normalize.ts", "apps/api/test/fixtures/github/", "apps/api/src/modules/github/github.test.ts"],
    ["Successful, failed, cancelled, missing-timestamp, and rate-limit fixtures", "UTC offset timestamps normalize without drift", "Raw logs are never requested"],
    ["Define Zod response schemas", "Implement timeout/retry limits", "Record sanitized backend/frontend fixtures", "Normalize run/job/step hierarchy", "Test error mapping"],
    ["Normalized objects retain IDs, URLs, conclusions, and timestamps", "Token is read-only and redacted", "429/5xx behavior is bounded", "No source/job-log content stored"],
    "Source timestamps later become reconstructed span timestamps.",
    "On GitHub failure, preserve last good metadata and report integration_error; never fabricate a successful run.",
    "feat(github): normalize workflow metadata fixtures (#issue)"),

  task("GL-P3-T03", 3, "Select exactly one primary Backend CI run", "github", 60, ["GL-P3-T02"],
    "Store backend and frontend runs for one change while deterministically selecting Backend CI as the deployed-artifact authority.",
    ["apps/api/src/modules/github/primary-workflow.ts", "apps/api/src/modules/github/primary-workflow.test.ts", "apps/api/src/config.ts"],
    ["Zero match returns configuration error", "One match marks exactly one primary", "Multiple matches return configuration error", "Secondary Frontend CI remains related"],
    ["Add exact config key", "Implement selector", "Persist is_primary", "Enforce unique partial index", "Expose warnings in sync DTO"],
    ["Backend CI is primary", "Frontend CI is stored but not treated as deployment authority", "No arbitrary selection", "Receipt contract can distinguish related runs"],
    "Only the primary run is eligible for the Claude span link.",
    "If the workflow is renamed, configuration must change explicitly; do not use fuzzy matching.",
    "feat(github): designate primary backend workflow (#issue)"),

  task("GL-P3-T04", 3, "Emit labeled reconstructed workflow, job, and step spans", "telemetry", 120, ["GL-P3-T02", "GL-P3-T03"],
    "Reconstruct completed GitHub runs as auditable OpenTelemetry traces using GitHub timestamps and explicit provenance labels.",
    ["apps/api/src/modules/ci-telemetry/synthesizer.ts", "apps/api/src/modules/ci-telemetry/synthesizer.test.ts"],
    ["In-memory exporter proves hierarchy, UTC timestamps, durations, status mapping, attributes, and forced flush", "Re-sync skips already emitted trace IDs"],
    ["Create workflow root and job/step contexts", "Use original start/end epoch nanos", "Prefix root Reconstructed GitHub Actions:", "Add source/origin/reconstructed-at attributes", "Persist emitted trace ID"],
    ["Trace matches fixture timing", "Failed/cancelled conclusions map to error", "Every root is visibly reconstructed", "Emission is idempotent"],
    "OTLP HTTP exports reconstructed CI traces to SigNoz.",
    "If post-hoc timestamps are rejected, capture the SDK limitation and use explicit span events without hiding the change.",
    "feat(telemetry): reconstruct GitHub Actions traces (#issue)"),

  task("GL-P3-T05", 3, "Attach a navigable Claude span link to the primary CI trace", "telemetry", 75, ["GL-P2-T04", "GL-P3-T04"],
    "Link the asynchronous primary CI root to the exact Claude tool-execution span stored in the commit trailer.",
    ["apps/api/src/modules/ci-telemetry/link.ts", "apps/api/src/modules/ci-telemetry/link.test.ts", "docs/EVIDENCE_LOG.md"],
    ["Valid trailer creates one Link", "Missing/invalid trailers create none and preserve sync", "Secondary workflow receives no AI link", "Link targets exact trace/span IDs"],
    ["Parse trailer", "Create remote SpanContext", "Attach link at root creation", "Export to SigNoz", "Click Links tab to source trace", "Record evidence"],
    ["SigNoz link is clickable", "Target Claude trace is preserved", "Primary-only rule holds", "Fallback linkage is labeled"],
    "This is the core cross-trace evidence chain.",
    "At the named pivot, freeze session-ID fallback rather than consuming submission time on beta behavior.",
    "feat(telemetry): link primary CI trace to Claude (#issue)"),

  task("GL-P4-T01", 4, "Record versioned deployments with explicit roles", "api", 75, ["GL-P3-T01", "GL-P1-T02"],
    "Persist baseline, candidate, and recovery deployments and emit versioned deployment telemetry only after application health and span visibility checks.",
    ["apps/api/src/modules/deployments/", "apps/api/src/routes/deployments.ts", "integrations/lms/deploy.sh"],
    ["Auth, input validation, idempotency, role constraint, health failure, and version-visibility cases", "Only one succeeded baseline per service/environment"],
    ["Write Fastify inject tests", "Implement authenticated endpoint", "Run safe deploy command in isolated path", "Check /actuator/health", "Confirm versioned span", "Emit deployment events"],
    ["Full SHA is consistent across change/deployment/span", "Failed start is persisted failed", "Evaluation cannot start before version visibility", "No automatic rollback"],
    "Deployment spans/events use service.name, service.version, and environment attributes.",
    "If live start timing varies, preserve a recorded successful deployment while keeping evaluation live.",
    "feat(api): record versioned deployments (#issue)"),

  task("GL-P4-T02", 4, "Generate and store an auditable good baseline anchor", "lms", 75, ["GL-P4-T01", "GL-P1-T03"],
    "Record the known-good SHA as role=baseline and generate a repeatable 250-request, 90-second synthetic window.",
    ["integrations/lms/load-home-overview.mjs", "scripts/demo-baseline.sh", "apps/api/test/fixtures/signoz/good-window.json"],
    ["Load generator honors duration/concurrency and synthetic credentials", "Abort below 250 target or on real-data configuration", "Baseline record precedes candidate deployment"],
    ["Seed synthetic portfolio", "Record baseline deployment", "Run controlled load", "Capture sample count/p90/p95/error", "Store only sanitized aggregate fixture"],
    ["At least 200 completed spans", "Target 250 provides margin", "Exact baseline SHA/filter recorded", "Window is repeatable twice"],
    "Produces LMS request/JDBC traces in the configured baseline window.",
    "If 250 requests exceed laptop capacity, lengthen preparation time without lowering the 200-span verdict floor.",
    "feat(demo): establish good telemetry baseline (#issue)"),

  task("GL-P4-T03", 4, "Implement reviewed SigNoz Query Builder v5 adapter", "signoz", 120, ["GL-P1-T03", "GL-P4-T02"],
    "Query p90, p95, error rate, request count, and representative traces through one defensive SigNoz adapter.",
    ["apps/api/src/modules/signoz/client.ts", "apps/api/src/modules/signoz/parsers.ts", "signoz/queries/", "apps/api/src/modules/signoz/signoz.test.ts"],
    ["Healthy, empty, malformed, timeout, 429, 5xx, and missing-series fixtures", "No missing value becomes numeric zero"],
    ["Version query payloads", "Template service/version/environment/route/window", "Add API-key header", "Implement timeout and one retry", "Parse typed series", "Generate deep links"],
    ["Reviewed payloads are version controlled", "Errors return integration_error", "Exact attributes match Phase 1 contract", "No credentials enter logs"],
    "Reads telemetry from SigNoz; GreenLight does not duplicate raw spans.",
    "If v5 response shape differs, update only this adapter and fixture set.",
    "feat(signoz): add defensive query adapter (#issue)"),

  task("GL-P4-T04", 4, "Evaluate transparent latency and error regression policy", "api", 120, ["GL-P4-T03"],
    "Compute healthy, regressed, or insufficient status using explicit windows, 200-span floor, and transparent thresholds.",
    ["apps/api/src/modules/regressions/evaluator.ts", "apps/api/src/modules/regressions/evaluator.test.ts", "apps/api/src/routes/regressions.ts"],
    ["Boundary tests for 1.5x and +250ms latency, +2pp and 5% error, sample floor, query failure, and p90 display", "409 baseline_required test"],
    ["Write table-driven rules", "Resolve explicit/automatic baseline", "Query both windows", "Preserve raw aggregates", "Persist reasons and versions", "Return typed status"],
    ["No verdict below 200 spans", "Both latency conditions are required", "Error rule is exact", "Thresholds are returned to UI", "Correlation wording avoids causation"],
    "Queries SigNoz and emits greenlight.regression.status on API spans.",
    "If the controlled error band is unstable, retain latency-only status and suppress misleading error headlines.",
    "feat(api): evaluate deployment regression (#issue)"),

  task("GL-P4-T05", 4, "Resolve recovery against the original good baseline", "api", 90, ["GL-P4-T04"],
    "Ensure a recovery deployment compares to the original good baseline rather than the bad version and stores the complete audit trail.",
    ["apps/api/src/modules/regressions/baseline-resolver.ts", "apps/api/src/modules/regressions/recovery.test.ts"],
    ["Explicit baseline validation", "Newest valid baseline selection", "No/multiple candidate error", "Recovery reuses regressed row baseline", "Cross-service/environment/time rejection"],
    ["Implement resolver", "Persist baseline_deployment_id and both versions", "Set comparison_kind=recovery", "Apply recovery bounds", "Return recovery evidence"],
    ["One row answers which versions were compared", "Recovery uses original window", "Ambiguity returns baseline_required", "Recovered threshold matches plan"],
    "Produces recovered status from the same SigNoz source data.",
    "Allow explicit override only after strict identity and ordering validation.",
    "feat(api): anchor recovery to good baseline (#issue)"),

  task("GL-P4-T06", 4, "Instrument GreenLight API with OpenTelemetry", "telemetry", 60, ["GL-P3-T01", "GL-P1-T01"],
    "Dogfood SigNoz by tracing GreenLight health, sync, deployment, evaluation, and receipt requests.",
    ["apps/api/src/telemetry.ts", "apps/api/src/server.ts", "signoz/dashboards/greenlight-self.json"],
    ["In-memory exporter verifies service name, route, status, error redaction, and exporter shutdown", "No auth header attributes"],
    ["Initialize SDK before Fastify", "Set service.name=greenlight-api", "Instrument HTTP", "Add safe domain attributes", "Export to 4318", "Create compact panel"],
    ["GreenLight API appears in SigNoz", "Core requests have spans", "Secrets/body content absent", "Shutdown flushes"],
    "OTLP HTTP/protobuf to SigNoz.",
    "If auto-instrumentation adds sensitive attributes, install a processor that redacts them before export.",
    "feat(telemetry): trace GreenLight API (#issue)"),

  task("GL-P5-T01", 5, "Expose the changes-list API contract", "api", 75, ["GL-P3-T03", "GL-P4-T04"],
    "Return the latest changes with primary CI, deployment, regression, recovery, and AI-link summaries.",
    ["apps/api/src/modules/changes/service.ts", "apps/api/src/routes/changes.ts", "packages/shared/src/contracts.ts"],
    ["Fastify inject tests for linked/missing CI, no deployment, healthy, regressed, recovered, pagination, and auth-safe errors"],
    ["Define Zod DTO", "Query normalized metadata", "Use only primary pipeline in summary", "Add related count", "Return stable ordering"],
    ["Latest 20 are deterministic", "No raw prompts/diffs returned", "Primary status is unambiguous", "Failure states are explicit"],
    "Request is self-traced by greenlight-api.",
    "If related workflow data is absent, return empty related count rather than fabricate.",
    "feat(api): expose change summaries (#issue)"),

  task("GL-P5-T02", 5, "Assemble the complete Change Receipt API", "api", 120, ["GL-P5-T01", "GL-P4-T05"],
    "Produce one stable receipt containing identity, primary and related CI, deployment, measured impact, evidence, recovery, and safe actions.",
    ["apps/api/src/modules/receipts/assembler.ts", "apps/api/src/modules/receipts/assembler.test.ts", "apps/api/src/routes/receipts.ts"],
    ["Full, missing-AI, secondary-CI, insufficient, regressed, recovered, and integration-error fixtures", "GitHub links originate only from pipeline_runs"],
    ["Define receipt DTO", "Join metadata without telemetry duplication", "Use evidence_links only for SigNoz", "Include threshold/version audit fields", "Generate safe revert command"],
    ["One response answers what changed, what broke, and proof", "Versions and baseline are visible", "No causal claim", "No duplicate evidence URLs"],
    "Returns SigNoz deep links and measured aggregates, not raw telemetry.",
    "On partial integration failure, return available evidence with explicit unavailable sections.",
    "feat(api): assemble auditable change receipt (#issue)"),

  task("GL-P5-T03", 5, "Build the changes-list screen", "web", 90, ["GL-P5-T01"],
    "Give a first-time user a scannable list of commit, AI-link, primary CI, deployment, and regression status.",
    ["apps/web/src/features/changes/", "apps/web/src/api/", "apps/web/src/app/routes.tsx"],
    ["Component tests for loading, empty, error, missing AI, healthy, regressed, and recovered rows", "Keyboard navigation and semantic-link tests"],
    ["Write component tests", "Add TanStack Query client", "Build responsive rows/cards", "Use text plus color for status", "Link to receipt"],
    ["All API states render", "Status is accessible", "No sensitive data shown", "Laptop/narrow layouts work"],
    "Frontend itself is not instrumented in MVP.",
    "If styling time expands, keep semantic HTML and status clarity; defer decorative animation.",
    "feat(web): add changes overview (#issue)"),

  task("GL-P5-T04", 5, "Build the receipt evidence timeline and CI sections", "web", 120, ["GL-P5-T02"],
    "Visualize Claude → commit → reconstructed primary CI → deployment → incident while clearly separating related workflows.",
    ["apps/web/src/features/receipts/ReceiptPage.tsx", "apps/web/src/features/receipts/EvidenceTimeline.tsx", "apps/web/src/features/receipts/CiSection.tsx"],
    ["Component tests for every timeline stage, reconstructed label, primary/related runs, broken links, and missing AI fallback"],
    ["Write fixtures/tests", "Build header and timeline", "Label reconstructed CI", "Add primary duration/slowest step", "List related workflows", "Add GitHub/SigNoz links"],
    ["Timeline is understandable in 30 seconds", "Reconstruction is never presented as native", "Primary workflow is explicit", "Links are keyboard accessible"],
    "Displays deep links into SigNoz and GitHub.",
    "If a deep link format changes, hide only that link and retain trace/run IDs for manual lookup.",
    "feat(web): render receipt evidence timeline (#issue)"),

  task("GL-P5-T05", 5, "Render impact, policy, recovery, and safe action states", "web", 105, ["GL-P5-T04", "GL-P4-T05"],
    "Show before/after versions, p90/p95, errors, counts, transparent thresholds, recovery, and a copyable—but never executed—revert command.",
    ["apps/web/src/features/receipts/ImpactCards.tsx", "apps/web/src/features/receipts/RecoveryPanel.tsx", "apps/web/src/features/receipts/Actions.tsx"],
    ["Boundary display tests, insufficient state, latency-only mode, recovered state, clipboard failure, and no-causation caveat"],
    ["Write component tests", "Build metric cards", "Show sample counts and policy", "Suppress unchanged error headline in latency-only mode", "Add recovery comparison", "Implement copy action"],
    ["Every number names its compared version", "Insufficient data is not healthy", "No auto rollback exists", "Caveat is visible", "Copy failure is recoverable"],
    "Shows representative SigNoz traces and dashboard links.",
    "If clipboard permission fails, select and display the command for manual copy.",
    "feat(web): show impact and recovery evidence (#issue)"),

  task("GL-P6-T01", 6, "Create the deterministic bad LMS change and incident window", "lms", 120, ["GL-P2-T04", "GL-P4-T04", "GL-P5-T05"],
    "Produce a traced N+1/repeated-query commit that passes functional CI but reliably crosses the transparent latency policy under synthetic load.",
    ["integrations/lms/patches/regression.patch", "scripts/demo-regression.sh", "docs/EVIDENCE_LOG.md"],
    ["Existing LMS functional tests remain green", "Load rehearsal crosses latency policy twice", "JDBC child count explains slowdown", "Optional timeout error band is bounded"],
    ["Apply prepared change through Claude trace path", "Commit and push", "Sync primary CI", "Deploy candidate role", "Generate 250 requests", "Evaluate live", "Capture slow traces"],
    ["Bad SHA is immutable", "CI is green", "Regression is repeatable", "Evidence is synthetic and privacy-safe", "No threshold tuned to a lucky run"],
    "LMS and reconstructed CI telemetry land in SigNoz; evaluation runs live.",
    "After one hour use disclosed fault flag; after 30 minutes of unstable errors switch to honest latency-only framing.",
    "feat(demo): create observable LMS regression (#issue)"),

  task("GL-P6-T02", 6, "Create and verify the recovery deployment", "lms", 90, ["GL-P6-T01", "GL-P4-T05"],
    "Restore the efficient query, deploy role=recovery, and prove metrics return to the original good baseline bounds.",
    ["integrations/lms/patches/recovery.patch", "scripts/demo-recover.sh", "docs/EVIDENCE_LOG.md"],
    ["Functional tests pass", "Recovery resolver reuses original baseline", "Two rehearsals satisfy p95/error recovery bounds"],
    ["Create corrective commit", "Push and sync primary CI", "Deploy recovery role", "Generate 250 requests", "Evaluate recovery", "Freeze evidence"],
    ["Recovery SHA is immutable", "Baseline and observed versions are persisted", "Receipt shows recovered", "Representative traces remain accessible"],
    "Produces recovery LMS and deployment telemetry in SigNoz.",
    "If recovery misses bounds, inspect data/infra variance; do not loosen recovery thresholds to fit one run.",
    "fix(demo): restore LMS query performance (#issue)"),

  task("GL-P6-T03", 6, "Implement safe soft reset and full demo preflight", "demo", 90, ["GL-P6-T02", "GL-P4-T06"],
    "Reset only transient deployment/evaluation state and prove every dependency, credential presence, immutable trace, commit, route, and port before rehearsal.",
    ["scripts/demo-reset.sh", "scripts/preflight.sh", "scripts/demo-smoke.sh", "docs/DEMO_STATE.md"],
    ["Soft reset preserves changes/pipeline runs and SigNoz evidence", "Unsafe DB/path fails", "Hard reset requires explicit phrase", "Preflight detects missing links/ports/SHAs"],
    ["Implement allowlisted deletes", "Protect immutable tables", "Add path guards", "Check primary CI/Claude trace targets", "Check minimal services", "Print non-secret status"],
    ["Soft reset is repeatable", "Hard reset prohibited in demo mode", "No destructive broad target", "Preflight gives actionable failures"],
    "Validates SigNoz UI/OTLP/MCP and required evidence.",
    "Never clear SigNoz during demo window; if immutable evidence is missing, stop and use recorded backup rather than silently rebuilding.",
    "feat(demo): add safe reset and preflight (#issue)"),

  task("GL-P7-T01", 7, "Script and verify the agent-native SigNoz MCP investigation", "signoz", 75, ["GL-P6-T01", "GL-P4-T03"],
    "Run one fixed MCP prompt that independently compares the bad version and returns three slow traces without claiming causation.",
    ["docs/MCP_DEMO.md", "docs/EVIDENCE_LOG.md", "scripts/verify-mcp-result.mjs"],
    ["Fixture validator checks service, SHA, route, windows, p95/error fields, three trace IDs, and absence of causal wording"],
    ["Add fixed prompt", "Run via SigNoz MCP", "Compare with GreenLight result", "Validate trace IDs", "Record sanitized output", "Rehearse exact narration"],
    ["MCP result agrees qualitatively and numerically", "Three traces resolve", "No causal overclaim", "Prompt is fixed and repeatable"],
    "Uses SigNoz MCP against the same telemetry GreenLight queries.",
    "If live MCP latency is risky, show a captured successful result after stating it is preserved; GreenLight evaluation remains live.",
    "feat(demo): add fixed MCP investigation (#issue)"),

  task("GL-P7-T02", 7, "Freeze documentation, rehearsals, recording, and submission", "docs", 120, ["GL-P6-T03", "GL-P7-T01"],
    "Deliver a reproducible, provenance-safe, sub-four-minute submission with a successful backup recording and no unresolved P0 gate.",
    ["README.md", "PROVENANCE.md", "docs/ARCHITECTURE.md", "docs/DEMO_SCRIPT.md", "docs/SUBMISSION_CHECKLIST.md"],
    ["Required unit/integration/component/hook/build/telemetry gates pass", "Two full rehearsals pass without edits", "Secret and synthetic-data scans pass", "Optional Playwright smoke is non-blocking"],
    ["Document reconstructed spans and prepared-load/live-analysis distinction", "Document polling and production evolution", "Run all gates", "Rehearse twice", "Record backup then final", "Verify repository access", "Submit with buffer"],
    ["Demo is under four minutes", "README reproduces setup", "AI assistance disclosed", "No secrets/real data", "All P0 issues closed with evidence"],
    "Final demo shows SigNoz dashboards, links, MCP, and GreenLight self-observability.",
    "If cosmetic work threatens the buffer, freeze the backup recording and submit the last verified state.",
    "docs: finalize GreenLight hackathon submission (#issue)")
];

const byId = new Map(tasks.map((t) => [t.id, t]));
for (const t of tasks) {
  for (const dep of t.depends) {
    if (!byId.has(dep)) throw new Error(`${t.id} has unknown dependency ${dep}`);
  }
}
if (tasks.length !== 30) throw new Error(`Expected 30 tasks, received ${tasks.length}`);

for (const t of tasks) t.blocks = tasks.filter((other) => other.depends.includes(t.id)).map((other) => other.id);

const labels = (t) => [`phase:${t.phase}`, `priority:${t.priority}`, `component:${t.component}`, t.component === "docs" ? "type:docs" : "type:implementation"];
const milestoneTitles = [
  "Phase 0 — Scope and isolation",
  "Phase 1 — SigNoz and baseline",
  "Phase 2 — Claude trace bridge",
  "Phase 3 — CI reconstruction",
  "Phase 4 — Deployment and regression",
  "Phase 5 — Change Receipt",
  "Phase 6 — Incident and recovery",
  "Phase 7 — Demo and submission",
];

function issueBody(t) {
  const checklist = (items) => items.map((x) => `- [ ] ${x}`).join("\n");
  const bullets = (items) => items.length ? items.map((x) => `- ${x}`).join("\n") : "- None";
  return `# ${t.id} — ${t.title}

## Outcome

${t.objective}

## Planning metadata

- **Phase:** ${t.phase}
- **Priority:** ${t.priority.toUpperCase()}
- **Component:** ${t.component}
- **Estimate:** ${t.estimate} focused minutes
- **Depends on:** ${t.depends.length ? t.depends.join(", ") : "None"}
- **Blocks:** ${t.blocks.length ? t.blocks.join(", ") : "None"}
- **Labels:** ${labels(t).join(", ")}

## Expected files

${bullets(t.files)}

## Test-first contract

Follow Red–Green–Refactor. Demonstrate the expected failing test before implementation, but do not commit a failing main branch.

${checklist(t.tests)}

## Implementation steps

${checklist(t.steps)}

## Telemetry and integration contract

${t.telemetry}

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

${checklist(t.acceptance)}

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

${t.fallback}

## Suggested atomic commit

\`${t.commit}\`

## Definition of done

This issue is done only when every acceptance item is checked, required tests pass, evidence is posted in the issue, no unrelated files are included, and the commit is authored under the human maintainer's verified identity without AI co-author trailers.
`;
}

const phases = new Map();
for (const t of tasks) {
  const list = phases.get(t.phase) ?? [];
  list.push(t);
  phases.set(t.phase, list);
}

let implementation = `# GreenLight Tracer-Bullet Implementation Tasks

This is the execution index for the authoritative [implementation plan](../GREENLIGHT_IMPLEMENTATION_PLAN.md). Each task is a narrow vertical slice intended to become one GitHub issue and one coherent implementation commit.

## Execution rules

- Work only on unblocked tasks.
- Follow Red–Green–Refactor.
- Post test and telemetry evidence before closing an issue.
- Never modify the original dirty LMS checkout.
- Do not add AI co-author trailers.
- Required test gates are blocking; Playwright remains optional and non-blocking.
- Preserve immutable Claude and CI evidence after Phase 3.

## Phase summary

| Phase | Tasks | Focused estimate |
|---:|---:|---:|
${[...phases].map(([phase, list]) => `| ${phase} | ${list.length} | ${list.reduce((n, t) => n + t.estimate, 0)} min |`).join("\n")}
| **Total** | **${tasks.length}** | **${tasks.reduce((n, t) => n + t.estimate, 0)} min** |
`;

for (const [phase, list] of phases) {
  implementation += `\n## Phase ${phase}\n\n`;
  for (const t of list) implementation += `${issueBody(t)}\n---\n\n`;
}

function yamlString(value) {
  return JSON.stringify(value);
}

let yaml = `version: 1\nproject: greenlight-ai-change-flight-recorder\ngenerated_from: GREENLIGHT_IMPLEMENTATION_PLAN.md\ntasks:\n`;
for (const t of tasks) {
  yaml += `  - id: ${t.id}\n`;
  yaml += `    phase: ${t.phase}\n`;
  yaml += `    title: ${yamlString(t.title)}\n`;
  yaml += `    priority: ${t.priority}\n`;
  yaml += `    component: ${t.component}\n`;
  yaml += `    estimate_minutes: ${t.estimate}\n`;
  yaml += `    depends_on: [${t.depends.join(", ")}]\n`;
  yaml += `    blocks: [${t.blocks.join(", ")}]\n`;
  yaml += `    issue_body: ${yamlString(`docs/issues/${t.id}.md`)}\n`;
  yaml += `    commit: ${yamlString(t.commit)}\n`;
  yaml += `    status: pending\n`;
}

let graph = `# Dependency Graph

The graph shows hard dependencies only. Phase 5 UI can overlap later Phase 4 work once its API contracts are stable.

\`\`\`mermaid
flowchart TD
${tasks.map((t) => `  ${t.id.replaceAll("-", "_")}["${t.id}<br/>${t.title.replaceAll('"', "'")}"]`).join("\n")}
${tasks.flatMap((t) => t.depends.map((d) => `  ${d.replaceAll("-", "_")} --> ${t.id.replaceAll("-", "_")}`)).join("\n")}
\`\`\`

## Critical-path discipline

- Do not start optional work while a P0 dependency is open.
- The Claude-to-CI linkage pivot remains time-boxed.
- Phase 6 requires the Phase 5 receipt shell because the incident must be visible end to end.
- Phase 7 begins only after two stable incident/recovery rehearsals.
`;

fs.mkdirSync(path.join(root, "docs", "issues"), { recursive: true });
fs.writeFileSync(path.join(root, "docs", "IMPLEMENTATION_TASKS.md"), implementation.replace(/\n+$/, "\n"));
fs.writeFileSync(path.join(root, "TASKS.yaml"), yaml);
fs.writeFileSync(path.join(root, "docs", "DEPENDENCY_GRAPH.md"), graph);
fs.writeFileSync(path.join(root, "planning", "issues-index.json"), JSON.stringify(tasks.map((t) => ({
  id: t.id,
  title: `[${t.id}] ${t.title}`,
  body_file: `docs/issues/${t.id}.md`,
  labels: labels(t),
  milestone: milestoneTitles[t.phase],
})), null, 2) + "\n");

for (const t of tasks) fs.writeFileSync(path.join(root, "docs", "issues", `${t.id}.md`), issueBody(t));

console.log(`Generated ${tasks.length} issue bodies and planning indexes.`);
