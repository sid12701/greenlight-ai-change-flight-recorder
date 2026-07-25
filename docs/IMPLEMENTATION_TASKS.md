# GreenLight Tracer-Bullet Implementation Tasks

This is the execution index for the authoritative [archived implementation plan](../planning/archive/GREENLIGHT_IMPLEMENTATION_PLAN.md). Each task is a narrow vertical slice intended to become one GitHub issue and one coherent implementation commit.

## Execution rules

- Work only on unblocked tasks.
- Use strict Red–Green–Refactor only for logic-heavy tasks marked `strict_tdd`.
- Use focused, evidence-capturing smoke verification for environment and integration tasks marked `smoke_verified`.
- Post test and telemetry evidence before closing an issue.
- Never modify the original dirty LMS checkout.
- Do not add AI co-author trailers.
- Required test gates are blocking; Playwright remains optional and non-blocking.
- Preserve immutable Claude and CI evidence after Phase 3.
- Work P0 tasks before P1 tasks. P1 tasks are explicitly sacrificeable when the schedule slips.

## Phase summary

| Phase | Tasks | Focused estimate |
|---:|---:|---:|
| 0 | 2 | 150 min |
| 1 | 3 | 260 min |
| 2 | 4 | 270 min |
| 3 | 5 | 435 min |
| 4 | 6 | 540 min |
| 5 | 5 | 510 min |
| 6 | 3 | 300 min |
| 7 | 2 | 195 min |
| **Total** | **30** | **2660 min** |

## Phase 0

# GL-P0-T01 — Bootstrap repository, provenance, and validated configuration contract

## Outcome

Produce a clean repository whose ownership, pre-existing LMS boundary, secret policy, configuration surface, and authoritative roadmap are immediately auditable.

## Planning metadata

- **Phase:** 0
- **Priority:** P0
- **Component:** docs
- **Verification:** strict_tdd
- **Estimate:** 60 focused minutes
- **Depends on:** None
- **Blocks:** GL-P0-T02, GL-P3-T01
- **Labels:** phase:0, priority:p0, component:docs, type:docs

## Expected files

- README.md
- PROVENANCE.md
- .env.example
- SECURITY.md
- GREENLIGHT_IMPLEMENTATION_PLAN.md

## Verification contract

Strict Red–Green–Refactor applies. Demonstrate the smallest deterministic failing test before implementation, but do not commit a failing main branch.

- [ ] Secret-pattern scan rejects credential-like fixtures
- [ ] Config-key inventory matches the implementation plan

## Implementation steps

- [ ] Verify sid12701 repository-local author identity
- [ ] Document pre-existing LMS baseline and AI assistance
- [ ] Add non-secret environment examples
- [ ] Link every planning artifact from README

## Telemetry and integration contract

None; this slice establishes the contract for later telemetry.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Repository contains no product implementation
- [ ] No secret or real borrower data is present
- [ ] Provenance separates LMS from GreenLight
- [ ] All planning entrypoints resolve

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

Stop if repository identity or licensing is ambiguous; record the decision in docs/OPEN_DECISIONS.md.

## Suggested atomic commit

`chore: initialize GreenLight implementation roadmap (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P0-T02 — Create isolated LMS demo workspace and minimal runtime preflight

## Outcome

Prove the demo can use the existing LMS without touching its dirty checkout and without starting unnecessary infrastructure.

## Planning metadata

- **Phase:** 0
- **Priority:** P0
- **Component:** lms
- **Verification:** smoke_verified
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P0-T01
- **Blocks:** GL-P1-T01
- **Labels:** phase:0, priority:p0, component:lms, type:implementation

## Expected files

- integrations/lms/README.md
- integrations/lms/demo-config.example
- integrations/lms/workflow-trigger-contract.md
- scripts/preflight.sh

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Preflight fails when LMS_PATH points at /Users/siddhant/Desktop/lms
- [ ] Preflight confirms baseline SHA and clean demo worktree
- [ ] Dependency checklist identifies only services used by home overview
- [ ] Workflow-trigger check records Backend CI on.push paths and proves the planned no-op backend file matches them

## Implementation steps

- [ ] Create a clean clone/worktree at baseline commit
- [ ] Create greenlight-demo branch
- [ ] Inspect home-overview runtime dependencies
- [ ] Record minimal compose services and port 8081
- [ ] Inspect Backend CI workflow name and push/path filters
- [ ] Choose a harmless backend file that is guaranteed to trigger Backend CI
- [ ] Verify original LMS status is unchanged

## Telemetry and integration contract

No telemetry yet; output the exact service and route that Phase 1 will instrument.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Original LMS worktree hash/status remains unchanged
- [ ] Clean demo worktree is pinned and documented
- [ ] Only required infrastructure is selected
- [ ] Backend CI trigger contract and proof-commit path are recorded
- [ ] Preflight exits non-zero on unsafe paths

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If LMS cannot be isolated in 45 minutes, create the documented minimal fixture path without modifying the original checkout.

## Suggested atomic commit

`chore(lms): isolate demo workload and preflight (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---


## Phase 1

# GL-P1-T01 — Validate Foundry casting and start SigNoz with MCP

## Outcome

Create a reproducible SigNoz installation whose UI, OTLP HTTP receiver, and MCP health endpoints are available, and retire the backdated-span risk before CI synthesis begins.

## Planning metadata

- **Phase:** 1
- **Priority:** P0
- **Component:** signoz
- **Verification:** smoke_verified
- **Estimate:** 110 focused minutes
- **Depends on:** GL-P0-T02
- **Blocks:** GL-P1-T02, GL-P2-T01, GL-P4-T06
- **Labels:** phase:1, priority:p0, component:signoz, type:implementation

## Expected files

- casting.yaml
- casting.yaml.lock
- signoz/README.md
- scripts/signoz-smoke.sh
- scripts/backdated-span-smoke.mjs

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Casting schema passes foundryctl gauge
- [ ] Smoke test checks UI 8080, OTLP HTTP 4318, and MCP livez 8000
- [ ] Port 4317 is not treated as required
- [ ] A span timestamped two hours in the past is accepted over OTLP HTTP and discoverable in SigNoz

## Implementation steps

- [ ] Add official Foundry casting
- [ ] Run gauge before forge
- [ ] Generate and inspect lock
- [ ] Cast services
- [ ] Create service-account setup instructions
- [ ] Run health smoke
- [ ] Run a 20-minute backdated-span spike and record the query/evidence

## Telemetry and integration contract

SigNoz is the telemetry source of truth; gRPC 4317 is an unused default listener.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] casting.yaml and generated lock are committed
- [ ] SigNoz UI responds
- [ ] OTLP HTTP accepts current and backdated telemetry
- [ ] The two-hour-old span is visible with the supplied timestamps
- [ ] MCP livez responds
- [ ] No credentials are committed

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If cast is blocked, use Foundry-generated compose for local progress but keep successful Foundry output mandatory for submission.

## Suggested atomic commit

`chore(signoz): add reproducible Foundry stack (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P1-T02 — Export one versioned LMS request trace with JDBC children

## Outcome

Send a real home-overview request through the Java agent and prove its trace carries the exact baseline commit SHA.

## Planning metadata

- **Phase:** 1
- **Priority:** P0
- **Component:** lms
- **Verification:** smoke_verified
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P1-T01
- **Blocks:** GL-P1-T03, GL-P4-T01
- **Labels:** phase:1, priority:p0, component:lms, type:implementation

## Expected files

- instrumentation/lms-java-agent/env.example
- integrations/lms/deploy.sh
- integrations/lms/verify.sh

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Deploy script rejects non-40-character SHAs
- [ ] Health gate uses /actuator/health
- [ ] Verification fails when service.version differs

## Implementation steps

- [ ] Pin Java agent version
- [ ] Build clean LMS backend
- [ ] Run on 8081 with always_on sampling
- [ ] Call authenticated synthetic route
- [ ] Find server and JDBC spans in SigNoz

## Telemetry and integration contract

OTLP HTTP/protobuf to localhost:4318 with service/version/environment resource attributes.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] service.name is lms-backend
- [ ] service.version equals full baseline SHA
- [ ] environment is hackathon-demo
- [ ] At least one JDBC child is visible
- [ ] No real data is emitted

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If readiness groups are explicitly enabled they may be checked additionally; /actuator/health remains the required gate.

## Suggested atomic commit

`feat(lms): export versioned baseline traces (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P1-T03 — Freeze the observed SigNoz attribute and query contract

## Outcome

Replace assumed semantic-convention keys with keys verified from actual LMS spans and prove route/version filtering.

## Planning metadata

- **Phase:** 1
- **Priority:** P0
- **Component:** telemetry
- **Verification:** smoke_verified
- **Estimate:** 60 focused minutes
- **Depends on:** GL-P1-T02
- **Blocks:** GL-P4-T02, GL-P4-T03
- **Labels:** phase:1, priority:p0, component:telemetry, type:implementation

## Expected files

- docs/TELEMETRY_CONTRACT.md
- signoz/saved-views.md
- test/fixtures/signoz/baseline-query.json

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Fixture parser resolves observed route, version, environment, status, and JDBC keys
- [ ] Query fixture returns only the exact SHA and route

## Implementation steps

- [ ] Inspect real span attributes
- [ ] Record exact filterable keys
- [ ] Save Query Builder view URL
- [ ] Capture sanitized response fixture
- [ ] Pin Java agent version

## Telemetry and integration contract

Reviewed Query Builder v5 contract becomes the boundary for all later evaluator work.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Contract names exact observed keys
- [ ] Query isolates /api/v1/internal/home/overview
- [ ] Full SHA filter works
- [ ] Count matches the deliberately small Phase 1 sample; the 200-span verdict floor is deferred to GL-P4-T02

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If http.route is absent, document and use the actual stable key rather than rewriting data to match the plan.

## Suggested atomic commit

`docs(telemetry): freeze LMS query contract (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---


## Phase 2

# GL-P2-T01 — Enable privacy-safe Claude Code telemetry

## Outcome

Export a Claude interaction and tool-execution trace while keeping prompts, tool details, and tool content disabled.

## Planning metadata

- **Phase:** 2
- **Priority:** P0
- **Component:** telemetry
- **Verification:** smoke_verified
- **Estimate:** 60 focused minutes
- **Depends on:** GL-P1-T01
- **Blocks:** GL-P2-T02
- **Labels:** phase:2, priority:p0, component:telemetry, type:implementation

## Expected files

- instrumentation/claude-code/env.example
- docs/SECURITY.md
- scripts/verify-claude-telemetry.sh

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Environment validation requires tracing, forced propagation, always_on sampling, and content flags off
- [ ] Verification fixture rejects prompt/tool-content attributes

## Implementation steps

- [ ] Pin claude --version
- [ ] Set OTLP HTTP endpoint
- [ ] Force TRACEPARENT propagation
- [ ] Run harmless tool action
- [ ] Verify trace in SigNoz
- [ ] Inspect privacy attributes

## Telemetry and integration contract

Claude traces use OTLP HTTP and preserved W3C trace context.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] claude-code trace is visible
- [ ] TRACEPARENT exists in Bash subprocess
- [ ] Prompt/tool contents are absent
- [ ] Exact Claude version is documented

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If beta tracing fails by the linkage pivot, use the documented SessionStart session-ID fallback.

## Suggested atomic commit

`feat(telemetry): export privacy-safe Claude traces (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P2-T02 — Implement shared W3C traceparent vectors and TypeScript parser

## Outcome

Create one canonical accepted/rejected vector set and a typed parser that cannot accept malformed or all-zero contexts.

## Planning metadata

- **Phase:** 2
- **Priority:** P0
- **Component:** telemetry
- **Verification:** strict_tdd
- **Estimate:** 75 focused minutes
- **Depends on:** GL-P2-T01
- **Blocks:** GL-P2-T03
- **Labels:** phase:2, priority:p0, component:telemetry, type:implementation

## Expected files

- packages/shared/src/traceparent.ts
- packages/shared/test-vectors/traceparent.json
- packages/shared/src/traceparent.test.ts

## Verification contract

Strict Red–Green–Refactor applies. Demonstrate the smallest deterministic failing test before implementation, but do not commit a failing main branch.

- [ ] Red tests cover version, length, hex, zeros, flags, whitespace, missing and duplicate trailers
- [ ] Parser returns structured errors without leaking input

## Implementation steps

- [ ] Write vectors first
- [ ] Implement Zod/typed result contract
- [ ] Normalize lowercase
- [ ] Split trace/span/flags
- [ ] Run focused and workspace tests

## Telemetry and integration contract

Creates SpanContext inputs used by the CI span link.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Every vector has expected result
- [ ] Only version 00 accepted
- [ ] All-zero IDs rejected
- [ ] No tracestate stored
- [ ] Public contract is documented

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

Invalid context never blocks CI sync; it records ai_link_status=invalid.

## Suggested atomic commit

`test(trace): define traceparent contract and parser (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P2-T03 — Install a safe prepare-commit-msg trace bridge

## Outcome

Add exactly one AI-Traceparent trailer to a normal Claude-triggered commit without changing merge, squash, or amend provenance.

## Planning metadata

- **Phase:** 2
- **Priority:** P0
- **Component:** github
- **Verification:** strict_tdd
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P2-T02
- **Blocks:** GL-P2-T04
- **Labels:** phase:2, priority:p0, component:github, type:implementation

## Expected files

- instrumentation/git-hooks/prepare-commit-msg
- instrumentation/git-hooks/install.sh
- instrumentation/git-hooks/test.sh

## Verification contract

Strict Red–Green–Refactor applies. Demonstrate the smallest deterministic failing test before implementation, but do not commit a failing main branch.

- [ ] Shell hook runs the shared vector cases
- [ ] Normal valid commit gets one trailer
- [ ] No context gets none
- [ ] Invalid context warns but commit succeeds
- [ ] merge/squash/amend add no new trailer

## Implementation steps

- [ ] Write temporary-repository tests
- [ ] Implement POSIX validator
- [ ] Inspect prepare-commit-msg source argument
- [ ] Use git interpret-trailers doNothing
- [ ] Install only in demo clone

## Telemetry and integration contract

Stores W3C context in Git metadata; emits no new telemetry.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] TS and shell validators agree
- [ ] Trailer is not duplicated
- [ ] Generated commits preserve existing provenance
- [ ] Original LMS hook directory is untouched

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If shell portability blocks progress, use a small Node hook launched by POSIX shell while retaining the same vectors.

## Suggested atomic commit

`feat(git): bridge Claude trace context to commits (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P2-T04 — Produce and freeze one trace-linked LMS commit

## Outcome

Create a harmless backend no-op commit through Claude Code that is guaranteed to trigger Backend CI, and prove its retained trailer resolves to the preserved SigNoz span.

## Planning metadata

- **Phase:** 2
- **Priority:** P0
- **Component:** github
- **Verification:** smoke_verified
- **Estimate:** 45 focused minutes
- **Depends on:** GL-P2-T03
- **Blocks:** GL-P3-T05, GL-P6-T01
- **Labels:** phase:2, priority:p0, component:github, type:implementation

## Expected files

- docs/EVIDENCE_LOG.md
- PROVENANCE.md
- integrations/lms/workflow-trigger-contract.md

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Verification script parses commit trailer and checks the target trace/span exists
- [ ] Trigger check proves the changed backend path matches Backend CI filters
- [ ] Human commit fixture remains unmodified

## Implementation steps

- [ ] Use the harmless backend file selected in GL-P0-T02
- [ ] Make only a comment/no-op change through Claude
- [ ] Commit through traced Bash
- [ ] Confirm AI-Traceparent remains present and is never stripped by the human-only GreenLight commit policy
- [ ] Push and confirm exactly one Backend CI run exists
- [ ] Record SHA and trace IDs
- [ ] Open target in SigNoz
- [ ] Freeze evidence

## Telemetry and integration contract

This immutable Claude evidence is reused by later CI-link tests.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Commit has one valid retained AI-Traceparent
- [ ] The commit triggers Backend CI
- [ ] Linked span exists
- [ ] No content telemetry leaked
- [ ] Evidence IDs are recorded without secrets

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

Do not regenerate after Phase 3; if unavailable, freeze the labeled session-ID degraded mode.

## Suggested atomic commit

`docs(evidence): freeze trace-linked commit proof (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---


## Phase 3

# GL-P3-T01 — Create metadata-only SQLite migrations and repositories

## Outcome

Implement the normalized repository/change/pipeline/deployment/evaluation/evidence schema with primary-run and baseline auditability.

## Planning metadata

- **Phase:** 3
- **Priority:** P0
- **Component:** api
- **Verification:** strict_tdd
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P0-T01
- **Blocks:** GL-P3-T02, GL-P4-T01, GL-P4-T06
- **Labels:** phase:3, priority:p0, component:api, type:implementation

## Expected files

- apps/api/src/db/migrations/001_initial.sql
- apps/api/src/db/migrate.ts
- apps/api/src/db/repositories/
- apps/api/test/db.test.ts

## Verification contract

Strict Red–Green–Refactor applies. Demonstrate the smallest deterministic failing test before implementation, but do not commit a failing main branch.

- [ ] Fresh migration succeeds
- [ ] Repeat migration is idempotent
- [ ] One primary pipeline constraint holds
- [ ] One demo baseline constraint holds
- [ ] Foreign keys and status checks reject invalid rows

## Implementation steps

- [ ] Write migration tests
- [ ] Implement schema from authoritative plan
- [ ] Enable foreign keys
- [ ] Add transactional migration runner
- [ ] Add temporary-db repositories

## Telemetry and integration contract

GreenLight API later emits its own DB request spans; SQLite does not replace SigNoz.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] All tables/indexes exist
- [ ] Evaluation stores both versions and baseline deployment
- [ ] SQLite contains metadata only
- [ ] Tests use temporary files

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If better-sqlite3 fails on Apple Silicon, stop at the Phase 0 native-module pivot and use the documented compatible version.

## Suggested atomic commit

`feat(api): add GreenLight metadata schema (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P3-T02 — Normalize recorded GitHub Actions fixtures

## Outcome

Fetch and normalize commit, workflow, job, and step metadata without storing raw job logs.

## Planning metadata

- **Phase:** 3
- **Priority:** P0
- **Component:** github
- **Verification:** smoke_verified
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P3-T01
- **Blocks:** GL-P3-T03, GL-P3-T04
- **Labels:** phase:3, priority:p0, component:github, type:implementation

## Expected files

- apps/api/src/modules/github/client.ts
- apps/api/src/modules/github/normalize.ts
- apps/api/test/fixtures/github/
- apps/api/src/modules/github/github.test.ts

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Successful, failed, cancelled, missing-timestamp, and rate-limit fixtures
- [ ] UTC offset timestamps normalize without drift
- [ ] Raw logs are never requested

## Implementation steps

- [ ] Define Zod response schemas
- [ ] Implement timeout/retry limits
- [ ] Record sanitized backend/frontend fixtures
- [ ] Normalize run/job/step hierarchy
- [ ] Test error mapping

## Telemetry and integration contract

Source timestamps later become reconstructed span timestamps.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Normalized objects retain IDs, URLs, conclusions, and timestamps
- [ ] Token is read-only and redacted
- [ ] 429/5xx behavior is bounded
- [ ] No source/job-log content stored

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

On GitHub failure, preserve last good metadata and report integration_error; never fabricate a successful run.

## Suggested atomic commit

`feat(github): normalize workflow metadata fixtures (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P3-T03 — Select exactly one primary Backend CI run

## Outcome

Store backend and frontend runs for one change while deterministically selecting Backend CI as the deployed-artifact authority.

## Planning metadata

- **Phase:** 3
- **Priority:** P0
- **Component:** github
- **Verification:** strict_tdd
- **Estimate:** 60 focused minutes
- **Depends on:** GL-P3-T02
- **Blocks:** GL-P3-T04, GL-P5-T01
- **Labels:** phase:3, priority:p0, component:github, type:implementation

## Expected files

- apps/api/src/modules/github/primary-workflow.ts
- apps/api/src/modules/github/primary-workflow.test.ts
- apps/api/src/config.ts

## Verification contract

Strict Red–Green–Refactor applies. Demonstrate the smallest deterministic failing test before implementation, but do not commit a failing main branch.

- [ ] Zero match returns configuration error
- [ ] One match marks exactly one primary
- [ ] Multiple matches return configuration error
- [ ] Secondary Frontend CI remains related

## Implementation steps

- [ ] Add exact config key
- [ ] Implement selector
- [ ] Persist is_primary
- [ ] Enforce unique partial index
- [ ] Expose warnings in sync DTO

## Telemetry and integration contract

Only the primary run is eligible for the Claude span link.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Backend CI is primary
- [ ] Frontend CI is stored but not treated as deployment authority
- [ ] No arbitrary selection
- [ ] Receipt contract can distinguish related runs

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If the workflow is renamed, configuration must change explicitly; do not use fuzzy matching.

## Suggested atomic commit

`feat(github): designate primary backend workflow (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P3-T04 — Emit labeled reconstructed workflow, job, and step spans

## Outcome

Reconstruct completed GitHub runs as auditable OpenTelemetry traces using GitHub timestamps and explicit provenance labels.

## Planning metadata

- **Phase:** 3
- **Priority:** P0
- **Component:** telemetry
- **Verification:** strict_tdd
- **Estimate:** 120 focused minutes
- **Depends on:** GL-P3-T02, GL-P3-T03
- **Blocks:** GL-P3-T05
- **Labels:** phase:3, priority:p0, component:telemetry, type:implementation

## Expected files

- apps/api/src/modules/ci-telemetry/synthesizer.ts
- apps/api/src/modules/ci-telemetry/synthesizer.test.ts

## Verification contract

Strict Red–Green–Refactor applies. Demonstrate the smallest deterministic failing test before implementation, but do not commit a failing main branch.

- [ ] In-memory exporter proves hierarchy, UTC timestamps, durations, status mapping, attributes, and forced flush
- [ ] Re-sync skips already emitted trace IDs

## Implementation steps

- [ ] Create workflow root and job/step contexts
- [ ] Use original start/end epoch nanos
- [ ] Prefix root Reconstructed GitHub Actions:
- [ ] Add source/origin/reconstructed-at attributes
- [ ] Persist emitted trace ID

## Telemetry and integration contract

OTLP HTTP exports reconstructed CI traces to SigNoz.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Trace matches fixture timing
- [ ] Failed/cancelled conclusions map to error
- [ ] Every root is visibly reconstructed
- [ ] Emission is idempotent

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If post-hoc timestamps are rejected, capture the SDK limitation and use explicit span events without hiding the change.

## Suggested atomic commit

`feat(telemetry): reconstruct GitHub Actions traces (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P3-T05 — Attach a navigable Claude span link to the primary CI trace

## Outcome

Link the asynchronous primary CI root to the exact Claude tool-execution span stored in the commit trailer.

## Planning metadata

- **Phase:** 3
- **Priority:** P0
- **Component:** telemetry
- **Verification:** smoke_verified
- **Estimate:** 75 focused minutes
- **Depends on:** GL-P2-T04, GL-P3-T04
- **Blocks:** GL-P5-T02
- **Labels:** phase:3, priority:p0, component:telemetry, type:implementation

## Expected files

- apps/api/src/modules/ci-telemetry/link.ts
- apps/api/src/modules/ci-telemetry/link.test.ts
- docs/EVIDENCE_LOG.md

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Valid trailer creates one Link
- [ ] Missing/invalid trailers create none and preserve sync
- [ ] Secondary workflow receives no AI link
- [ ] Link targets exact trace/span IDs

## Implementation steps

- [ ] Parse trailer
- [ ] Create remote SpanContext
- [ ] Attach link at root creation
- [ ] Export to SigNoz
- [ ] Click Links tab to source trace
- [ ] Record evidence

## Telemetry and integration contract

This is the core cross-trace evidence chain.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] SigNoz link is clickable
- [ ] Target Claude trace is preserved
- [ ] Primary-only rule holds
- [ ] Fallback linkage is labeled

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

At the named pivot, freeze session-ID fallback rather than consuming submission time on beta behavior.

## Suggested atomic commit

`feat(telemetry): link primary CI trace to Claude (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---


## Phase 4

# GL-P4-T01 — Record versioned deployments with explicit roles

## Outcome

Persist baseline, candidate, and recovery deployments and emit versioned deployment telemetry only after application health and span visibility checks.

## Planning metadata

- **Phase:** 4
- **Priority:** P0
- **Component:** api
- **Verification:** smoke_verified
- **Estimate:** 75 focused minutes
- **Depends on:** GL-P3-T01, GL-P1-T02
- **Blocks:** GL-P4-T02
- **Labels:** phase:4, priority:p0, component:api, type:implementation

## Expected files

- apps/api/src/modules/deployments/
- apps/api/src/routes/deployments.ts
- integrations/lms/deploy.sh

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Auth, input validation, idempotency, role constraint, health failure, and version-visibility cases
- [ ] Only one succeeded baseline per service/environment

## Implementation steps

- [ ] Write Fastify inject tests
- [ ] Implement authenticated endpoint
- [ ] Run safe deploy command in isolated path
- [ ] Check /actuator/health
- [ ] Confirm versioned span
- [ ] Emit deployment events

## Telemetry and integration contract

Deployment spans/events use service.name, service.version, and environment attributes.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Full SHA is consistent across change/deployment/span
- [ ] Failed start is persisted failed
- [ ] Evaluation cannot start before version visibility
- [ ] No automatic rollback

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If live start timing varies, preserve a recorded successful deployment while keeping evaluation live.

## Suggested atomic commit

`feat(api): record versioned deployments (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P4-T02 — Generate and store an auditable good baseline anchor

## Outcome

Capture one immutable known-good baseline deployment and 250-request, 90-second window exactly once; every candidate and recovery rehearsal reuses its stored baseline_deployment_id and never regenerates this window.

## Planning metadata

- **Phase:** 4
- **Priority:** P0
- **Component:** lms
- **Verification:** smoke_verified
- **Estimate:** 75 focused minutes
- **Depends on:** GL-P4-T01, GL-P1-T03
- **Blocks:** GL-P4-T03
- **Labels:** phase:4, priority:p0, component:lms, type:implementation

## Expected files

- integrations/lms/load-home-overview.mjs
- scripts/demo-baseline.sh
- apps/api/test/fixtures/signoz/good-window.json

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Load generator honors duration/concurrency and synthetic credentials
- [ ] Abort below 250 target or on real-data configuration
- [ ] Baseline record precedes candidate deployment

## Implementation steps

- [ ] Seed synthetic portfolio
- [ ] Record the single baseline deployment
- [ ] Run controlled load once
- [ ] Capture and freeze sample count/p90/p95/error plus UTC window bounds
- [ ] Store only sanitized aggregate fixture
- [ ] Make reset scripts reject baseline deletion or regeneration

## Telemetry and integration contract

Produces LMS request/JDBC traces in the configured baseline window.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] At least 200 completed spans
- [ ] Target 250 provides margin
- [ ] Exact baseline SHA/filter/window and baseline_deployment_id are frozen
- [ ] Candidate and recovery comparisons both reference this same baseline
- [ ] Rehearsals regenerate only candidate/recovery windows

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If 250 requests exceed laptop capacity, lengthen preparation time without lowering the 200-span verdict floor.

## Suggested atomic commit

`feat(demo): establish good telemetry baseline (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P4-T03 — Implement reviewed SigNoz Query Builder v5 adapter

## Outcome

Query p90, p95, error rate, request count, and representative traces through one defensive SigNoz adapter.

## Planning metadata

- **Phase:** 4
- **Priority:** P0
- **Component:** signoz
- **Verification:** strict_tdd
- **Estimate:** 120 focused minutes
- **Depends on:** GL-P1-T03, GL-P4-T02
- **Blocks:** GL-P4-T04, GL-P7-T01
- **Labels:** phase:4, priority:p0, component:signoz, type:implementation

## Expected files

- apps/api/src/modules/signoz/client.ts
- apps/api/src/modules/signoz/parsers.ts
- signoz/queries/
- apps/api/src/modules/signoz/signoz.test.ts

## Verification contract

Strict Red–Green–Refactor applies. Demonstrate the smallest deterministic failing test before implementation, but do not commit a failing main branch.

- [ ] Healthy, empty, malformed, timeout, 429, 5xx, and missing-series fixtures
- [ ] No missing value becomes numeric zero

## Implementation steps

- [ ] Version query payloads
- [ ] Template service/version/environment/route/window
- [ ] Add API-key header
- [ ] Implement timeout and one retry
- [ ] Parse typed series
- [ ] Generate deep links

## Telemetry and integration contract

Reads telemetry from SigNoz; GreenLight does not duplicate raw spans.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Reviewed payloads are version controlled
- [ ] Errors return integration_error
- [ ] Exact attributes match Phase 1 contract
- [ ] No credentials enter logs

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If v5 response shape differs, update only this adapter and fixture set.

## Suggested atomic commit

`feat(signoz): add defensive query adapter (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P4-T04 — Evaluate transparent latency and error regression policy

## Outcome

Compute healthy, regressed, or insufficient status by comparing a candidate window to the single stored GL-P4-T02 baseline_deployment_id, using the 200-span floor and transparent thresholds.

## Planning metadata

- **Phase:** 4
- **Priority:** P0
- **Component:** api
- **Verification:** strict_tdd
- **Estimate:** 120 focused minutes
- **Depends on:** GL-P4-T03
- **Blocks:** GL-P4-T05, GL-P5-T01, GL-P6-T01
- **Labels:** phase:4, priority:p0, component:api, type:implementation

## Expected files

- apps/api/src/modules/regressions/evaluator.ts
- apps/api/src/modules/regressions/evaluator.test.ts
- apps/api/src/routes/regressions.ts

## Verification contract

Strict Red–Green–Refactor applies. Demonstrate the smallest deterministic failing test before implementation, but do not commit a failing main branch.

- [ ] Boundary tests for 1.5x and +250ms latency, +2pp and 5% error, sample floor, query failure, and p90 display
- [ ] 409 baseline_required test

## Implementation steps

- [ ] Write table-driven rules
- [ ] Resolve the immutable stored baseline rather than an immediately preceding window
- [ ] Query the frozen baseline and current candidate windows
- [ ] Preserve raw aggregates
- [ ] Persist baseline_deployment_id, reasons, and versions
- [ ] Return typed status

## Telemetry and integration contract

Queries SigNoz and emits greenlight.regression.status on API spans.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] No verdict below 200 spans
- [ ] Candidate comparison references the frozen baseline_deployment_id
- [ ] Both latency conditions are required
- [ ] Error rule is exact
- [ ] Thresholds are returned to UI
- [ ] Correlation wording avoids causation

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If the controlled error band is unstable, retain latency-only status and suppress misleading error headlines.

## Suggested atomic commit

`feat(api): evaluate deployment regression (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P4-T05 — Resolve recovery against the original good baseline

## Outcome

Ensure a recovery deployment compares to the original good baseline rather than the bad version and stores the complete audit trail.

## Planning metadata

- **Phase:** 4
- **Priority:** P0
- **Component:** api
- **Verification:** strict_tdd
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P4-T04
- **Blocks:** GL-P5-T02, GL-P5-T05, GL-P6-T02
- **Labels:** phase:4, priority:p0, component:api, type:implementation

## Expected files

- apps/api/src/modules/regressions/baseline-resolver.ts
- apps/api/src/modules/regressions/recovery.test.ts

## Verification contract

Strict Red–Green–Refactor applies. Demonstrate the smallest deterministic failing test before implementation, but do not commit a failing main branch.

- [ ] Explicit baseline validation
- [ ] Newest valid baseline selection
- [ ] No/multiple candidate error
- [ ] Recovery reuses regressed row baseline
- [ ] Cross-service/environment/time rejection

## Implementation steps

- [ ] Implement resolver
- [ ] Persist baseline_deployment_id and both versions
- [ ] Set comparison_kind=recovery
- [ ] Apply recovery bounds
- [ ] Return recovery evidence

## Telemetry and integration contract

Produces recovered status from the same SigNoz source data.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] One row answers which versions were compared
- [ ] Recovery uses original window
- [ ] Ambiguity returns baseline_required
- [ ] Recovered threshold matches plan

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

Allow explicit override only after strict identity and ordering validation.

## Suggested atomic commit

`feat(api): anchor recovery to good baseline (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P4-T06 — Instrument GreenLight API with OpenTelemetry

## Outcome

Dogfood SigNoz by tracing GreenLight health, sync, deployment, evaluation, and receipt requests.

## Planning metadata

- **Phase:** 4
- **Priority:** P1
- **Component:** telemetry
- **Verification:** smoke_verified
- **Estimate:** 60 focused minutes
- **Depends on:** GL-P3-T01, GL-P1-T01
- **Blocks:** None
- **Labels:** phase:4, priority:p1, component:telemetry, type:implementation

## Expected files

- apps/api/src/telemetry.ts
- apps/api/src/server.ts
- signoz/dashboards/greenlight-self.json

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] In-memory exporter verifies service name, route, status, error redaction, and exporter shutdown
- [ ] No auth header attributes

## Implementation steps

- [ ] Initialize SDK before Fastify
- [ ] Set service.name=greenlight-api
- [ ] Instrument HTTP
- [ ] Add safe domain attributes
- [ ] Export to 4318
- [ ] Create compact panel

## Telemetry and integration contract

OTLP HTTP/protobuf to SigNoz.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] GreenLight API appears in SigNoz
- [ ] Core requests have spans
- [ ] Secrets/body content absent
- [ ] Shutdown flushes

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If auto-instrumentation adds sensitive attributes, install a processor that redacts them before export.

## Suggested atomic commit

`feat(telemetry): trace GreenLight API (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---


## Phase 5

# GL-P5-T01 — Expose the changes-list API contract

## Outcome

Return the latest changes with primary CI, deployment, regression, recovery, and AI-link summaries.

## Planning metadata

- **Phase:** 5
- **Priority:** P0
- **Component:** api
- **Verification:** smoke_verified
- **Estimate:** 75 focused minutes
- **Depends on:** GL-P3-T03, GL-P4-T04
- **Blocks:** GL-P5-T02, GL-P5-T03
- **Labels:** phase:5, priority:p0, component:api, type:implementation

## Expected files

- apps/api/src/modules/changes/service.ts
- apps/api/src/routes/changes.ts
- packages/shared/src/contracts.ts

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Fastify inject tests for linked/missing CI, no deployment, healthy, regressed, recovered, pagination, and auth-safe errors

## Implementation steps

- [ ] Define Zod DTO
- [ ] Query normalized metadata
- [ ] Use only primary pipeline in summary
- [ ] Add related count
- [ ] Return stable ordering

## Telemetry and integration contract

Request is self-traced by greenlight-api.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Latest 20 are deterministic
- [ ] No raw prompts/diffs returned
- [ ] Primary status is unambiguous
- [ ] Failure states are explicit

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If related workflow data is absent, return empty related count rather than fabricate.

## Suggested atomic commit

`feat(api): expose change summaries (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P5-T02 — Assemble the complete Change Receipt API

## Outcome

Produce one stable receipt containing identity, primary and related CI, deployment, measured impact, evidence, recovery, and safe actions.

## Planning metadata

- **Phase:** 5
- **Priority:** P0
- **Component:** api
- **Verification:** strict_tdd
- **Estimate:** 120 focused minutes
- **Depends on:** GL-P5-T01, GL-P4-T05, GL-P3-T05
- **Blocks:** GL-P5-T04
- **Labels:** phase:5, priority:p0, component:api, type:implementation

## Expected files

- apps/api/src/modules/receipts/assembler.ts
- apps/api/src/modules/receipts/assembler.test.ts
- apps/api/src/routes/receipts.ts

## Verification contract

Strict Red–Green–Refactor applies. Demonstrate the smallest deterministic failing test before implementation, but do not commit a failing main branch.

- [ ] Full, missing-AI, secondary-CI, insufficient, regressed, recovered, and integration-error fixtures
- [ ] GitHub links originate only from pipeline_runs

## Implementation steps

- [ ] Define receipt DTO
- [ ] Join metadata without telemetry duplication
- [ ] Use evidence_links only for SigNoz
- [ ] Include threshold/version audit fields
- [ ] Generate safe revert command

## Telemetry and integration contract

Returns SigNoz deep links and measured aggregates, not raw telemetry.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] One response answers what changed, what broke, and proof
- [ ] Versions and baseline are visible
- [ ] No causal claim
- [ ] No duplicate evidence URLs

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

On partial integration failure, return available evidence with explicit unavailable sections.

## Suggested atomic commit

`feat(api): assemble auditable change receipt (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P5-T03 — Build the changes-list screen

## Outcome

Give a first-time user a scannable list of commit, AI-link, primary CI, deployment, and regression status.

## Planning metadata

- **Phase:** 5
- **Priority:** P1
- **Component:** web
- **Verification:** smoke_verified
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P5-T01
- **Blocks:** None
- **Labels:** phase:5, priority:p1, component:web, type:implementation

## Expected files

- apps/web/src/features/changes/
- apps/web/src/api/
- apps/web/src/app/routes.tsx

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Component tests for loading, empty, error, missing AI, healthy, regressed, and recovered rows
- [ ] Keyboard navigation and semantic-link tests

## Implementation steps

- [ ] Write component tests
- [ ] Add TanStack Query client
- [ ] Build responsive rows/cards
- [ ] Use text plus color for status
- [ ] Link to receipt

## Telemetry and integration contract

Frontend itself is not instrumented in MVP.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] All API states render
- [ ] Status is accessible
- [ ] No sensitive data shown
- [ ] Laptop/narrow layouts work

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If styling time expands, keep semantic HTML and status clarity; defer decorative animation.

## Suggested atomic commit

`feat(web): add changes overview (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P5-T04 — Build the receipt evidence timeline and CI sections

## Outcome

Visualize Claude → commit → reconstructed primary CI → deployment → incident while clearly separating related workflows.

## Planning metadata

- **Phase:** 5
- **Priority:** P0
- **Component:** web
- **Verification:** smoke_verified
- **Estimate:** 120 focused minutes
- **Depends on:** GL-P5-T02
- **Blocks:** GL-P5-T05
- **Labels:** phase:5, priority:p0, component:web, type:implementation

## Expected files

- apps/web/src/features/receipts/ReceiptPage.tsx
- apps/web/src/features/receipts/EvidenceTimeline.tsx
- apps/web/src/features/receipts/CiSection.tsx

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Component tests for every timeline stage, reconstructed label, primary/related runs, broken links, and missing AI fallback

## Implementation steps

- [ ] Write fixtures/tests
- [ ] Build header and timeline
- [ ] Label reconstructed CI
- [ ] Add primary duration/slowest step
- [ ] List related workflows
- [ ] Add GitHub/SigNoz links

## Telemetry and integration contract

Displays deep links into SigNoz and GitHub.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Timeline is understandable in 30 seconds
- [ ] Reconstruction is never presented as native
- [ ] Primary workflow is explicit
- [ ] Links are keyboard accessible

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If a deep link format changes, hide only that link and retain trace/run IDs for manual lookup.

## Suggested atomic commit

`feat(web): render receipt evidence timeline (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P5-T05 — Render impact, policy, recovery, and safe action states

## Outcome

Show before/after versions, p90/p95, errors, counts, transparent thresholds, recovery, and a copyable—but never executed—revert command.

## Planning metadata

- **Phase:** 5
- **Priority:** P0
- **Component:** web
- **Verification:** smoke_verified
- **Estimate:** 105 focused minutes
- **Depends on:** GL-P5-T04, GL-P4-T05
- **Blocks:** GL-P7-T02
- **Labels:** phase:5, priority:p0, component:web, type:implementation

## Expected files

- apps/web/src/features/receipts/ImpactCards.tsx
- apps/web/src/features/receipts/RecoveryPanel.tsx
- apps/web/src/features/receipts/Actions.tsx

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Boundary display tests, insufficient state, latency-only mode, recovered state, clipboard failure, and no-causation caveat

## Implementation steps

- [ ] Write component tests
- [ ] Build metric cards
- [ ] Show sample counts and policy
- [ ] Suppress unchanged error headline in latency-only mode
- [ ] Add recovery comparison
- [ ] Implement copy action

## Telemetry and integration contract

Shows representative SigNoz traces and dashboard links.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Every number names its compared version
- [ ] Insufficient data is not healthy
- [ ] No auto rollback exists
- [ ] Caveat is visible
- [ ] Copy failure is recoverable

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If clipboard permission fails, select and display the command for manual copy.

## Suggested atomic commit

`feat(web): show impact and recovery evidence (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---


## Phase 6

# GL-P6-T01 — Create the deterministic bad LMS change and incident window

## Outcome

Produce a traced N+1/repeated-query commit that passes functional CI but reliably crosses the transparent latency policy under synthetic load.

## Planning metadata

- **Phase:** 6
- **Priority:** P0
- **Component:** lms
- **Verification:** smoke_verified
- **Estimate:** 120 focused minutes
- **Depends on:** GL-P2-T04, GL-P4-T04
- **Blocks:** GL-P6-T02, GL-P7-T01
- **Labels:** phase:6, priority:p0, component:lms, type:implementation

## Expected files

- integrations/lms/patches/regression.patch
- scripts/demo-regression.sh
- docs/EVIDENCE_LOG.md

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Existing LMS functional tests remain green
- [ ] Load rehearsal crosses latency policy twice
- [ ] JDBC child count explains slowdown
- [ ] Optional timeout error band is bounded

## Implementation steps

- [ ] Apply prepared change through Claude trace path
- [ ] Commit while retaining the AI-Traceparent trailer; never clean it under the GreenLight human-only commit policy
- [ ] Push and sync primary CI
- [ ] Deploy candidate role
- [ ] Generate 250 requests
- [ ] Evaluate live against the frozen baseline_deployment_id
- [ ] Capture slow traces

## Telemetry and integration contract

LMS and reconstructed CI telemetry land in SigNoz; evaluation runs live.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Bad SHA is immutable and retains its AI-Traceparent trailer
- [ ] CI is green
- [ ] Regression is repeatable against the frozen baseline
- [ ] Evidence is synthetic and privacy-safe
- [ ] No threshold tuned to a lucky run

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

After one hour use disclosed fault flag; after 30 minutes of unstable errors switch to honest latency-only framing.

## Suggested atomic commit

`feat(demo): create observable LMS regression (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P6-T02 — Create and verify the recovery deployment

## Outcome

Restore the efficient query, deploy role=recovery, and prove metrics return to the original good baseline bounds.

## Planning metadata

- **Phase:** 6
- **Priority:** P0
- **Component:** lms
- **Verification:** smoke_verified
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P6-T01, GL-P4-T05
- **Blocks:** GL-P6-T03
- **Labels:** phase:6, priority:p0, component:lms, type:implementation

## Expected files

- integrations/lms/patches/recovery.patch
- scripts/demo-recover.sh
- docs/EVIDENCE_LOG.md

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Functional tests pass
- [ ] Recovery resolver reuses original baseline
- [ ] Two rehearsals satisfy p95/error recovery bounds

## Implementation steps

- [ ] Create corrective commit
- [ ] Push and sync primary CI
- [ ] Deploy recovery role
- [ ] Generate 250 requests
- [ ] Evaluate recovery
- [ ] Freeze evidence

## Telemetry and integration contract

Produces recovery LMS and deployment telemetry in SigNoz.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Recovery SHA is immutable
- [ ] Baseline and observed versions are persisted
- [ ] Receipt shows recovered
- [ ] Representative traces remain accessible

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If recovery misses bounds, inspect data/infra variance; do not loosen recovery thresholds to fit one run.

## Suggested atomic commit

`fix(demo): restore LMS query performance (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P6-T03 — Implement safe soft reset and full demo preflight

## Outcome

Reset only candidate/recovery deployment and evaluation state—never the frozen baseline—and prove every dependency, credential presence, immutable trace, commit, route, and port before rehearsal.

## Planning metadata

- **Phase:** 6
- **Priority:** P0
- **Component:** demo
- **Verification:** smoke_verified
- **Estimate:** 90 focused minutes
- **Depends on:** GL-P6-T02
- **Blocks:** GL-P7-T02
- **Labels:** phase:6, priority:p0, component:demo, type:implementation

## Expected files

- scripts/demo-reset.sh
- scripts/preflight.sh
- scripts/demo-smoke.sh
- docs/DEMO_STATE.md

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Soft reset preserves changes/pipeline runs, frozen baseline deployment/window, and SigNoz evidence
- [ ] Unsafe DB/path fails
- [ ] Hard reset requires explicit phrase
- [ ] Preflight detects missing links/ports/SHAs

## Implementation steps

- [ ] Implement allowlisted candidate/recovery deletes
- [ ] Protect baseline and immutable tables
- [ ] Add path guards
- [ ] Check primary CI/Claude trace targets
- [ ] Check minimal services
- [ ] Print non-secret status

## Telemetry and integration contract

Validates SigNoz UI/OTLP/MCP and required evidence.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Soft reset is repeatable and regenerates only candidate/recovery windows
- [ ] Frozen baseline_deployment_id remains unchanged
- [ ] Hard reset prohibited in demo mode
- [ ] No destructive broad target
- [ ] Preflight gives actionable failures

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

Never clear SigNoz during demo window; if immutable evidence is missing, stop and use recorded backup rather than silently rebuilding.

## Suggested atomic commit

`feat(demo): add safe reset and preflight (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---


## Phase 7

# GL-P7-T01 — Script and verify the agent-native SigNoz MCP investigation

## Outcome

Run one fixed MCP prompt that independently compares the bad version and returns three slow traces without claiming causation.

## Planning metadata

- **Phase:** 7
- **Priority:** P1
- **Component:** signoz
- **Verification:** smoke_verified
- **Estimate:** 75 focused minutes
- **Depends on:** GL-P6-T01, GL-P4-T03
- **Blocks:** None
- **Labels:** phase:7, priority:p1, component:signoz, type:implementation

## Expected files

- docs/MCP_DEMO.md
- docs/EVIDENCE_LOG.md
- scripts/verify-mcp-result.mjs

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Fixture validator checks service, SHA, route, windows, p95/error fields, three trace IDs, and absence of causal wording

## Implementation steps

- [ ] Add fixed prompt
- [ ] Run via SigNoz MCP
- [ ] Compare with GreenLight result
- [ ] Validate trace IDs
- [ ] Record sanitized output
- [ ] Rehearse exact narration

## Telemetry and integration contract

Uses SigNoz MCP against the same telemetry GreenLight queries.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] MCP result agrees qualitatively and numerically
- [ ] Three traces resolve
- [ ] No causal overclaim
- [ ] Prompt is fixed and repeatable

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If live MCP latency is risky, show a captured successful result after stating it is preserved; GreenLight evaluation remains live.

## Suggested atomic commit

`feat(demo): add fixed MCP investigation (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---

# GL-P7-T02 — Freeze documentation, rehearsals, recording, and submission

## Outcome

Deliver a reproducible, provenance-safe, sub-four-minute submission with a successful backup recording and no unresolved P0 gate.

## Planning metadata

- **Phase:** 7
- **Priority:** P0
- **Component:** docs
- **Verification:** smoke_verified
- **Estimate:** 120 focused minutes
- **Depends on:** GL-P6-T03, GL-P5-T05
- **Blocks:** None
- **Labels:** phase:7, priority:p0, component:docs, type:docs

## Expected files

- README.md
- PROVENANCE.md
- docs/ARCHITECTURE.md
- docs/DEMO_SCRIPT.md
- docs/SUBMISSION_CHECKLIST.md

## Verification contract

Smoke-verified integration applies. Write deterministic validation scripts or fixture checks before configuration where practical; capture before/after failure evidence, but do not manufacture a unit-test seam solely for ceremony.

- [ ] Required unit/integration/component/hook/build/telemetry gates pass
- [ ] Two full rehearsals pass without edits
- [ ] Secret and synthetic-data scans pass
- [ ] Optional Playwright smoke is non-blocking

## Implementation steps

- [ ] Document reconstructed spans and prepared-load/live-analysis distinction
- [ ] Document polling and production evolution
- [ ] Run all gates
- [ ] Rehearse twice
- [ ] Record backup then final
- [ ] Verify repository access
- [ ] Submit with buffer

## Telemetry and integration contract

Final demo always shows SigNoz dashboards and links; MCP and GreenLight self-observability appear when their P1 tasks were retained.

## Security and privacy

- Use synthetic data only.
- Never log or commit credentials, prompts, transcripts, raw job logs, request bodies, or real borrower data.
- Treat external IDs, URLs, timestamps, and trace context as untrusted input.
- Preserve the non-causation wording and immutable-upstream rules from the authoritative plan.

## Acceptance criteria

- [ ] Demo is under four minutes
- [ ] README reproduces setup
- [ ] AI assistance disclosed
- [ ] No secrets/real data
- [ ] All P0 issues closed with evidence

## Required evidence for closure

- [ ] Focused test command and passing output
- [ ] Relevant regression-gate output
- [ ] File/endpoint/trace identifiers needed to audit the result
- [ ] Confirmation that the worktree is clean
- [ ] GitHub comment summarizing result, evidence, limitations, and next unblocked issue

## Fallback / pivot

If cosmetic work threatens the buffer, freeze the backup recording and submit the last verified state.

## Suggested atomic commit

`docs: finalize GreenLight hackathon submission (#issue)`

## Definition of done

This issue is done only when every acceptance item is checked, required verification passes, evidence is posted in the issue, no unrelated files are included, and the GreenLight commit is authored under the human maintainer's verified identity without AI co-author trailers. LMS demonstration commits explicitly requiring `AI-Traceparent` must retain that product-evidence trailer.

---
