# Dependency Graph

The graph shows hard dependencies only. Phase 5 UI can overlap later Phase 4 work once its API contracts are stable.

```mermaid
flowchart TD
  GL_P0_T01["GL-P0-T01<br/>Bootstrap repository, provenance, and validated configuration contract"]
  GL_P0_T02["GL-P0-T02<br/>Create isolated LMS demo workspace and minimal runtime preflight"]
  GL_P1_T01["GL-P1-T01<br/>Validate Foundry casting and start SigNoz with MCP"]
  GL_P1_T02["GL-P1-T02<br/>Export one versioned LMS request trace with JDBC children"]
  GL_P1_T03["GL-P1-T03<br/>Freeze the observed SigNoz attribute and query contract"]
  GL_P2_T01["GL-P2-T01<br/>Enable privacy-safe Claude Code telemetry"]
  GL_P2_T02["GL-P2-T02<br/>Implement shared W3C traceparent vectors and TypeScript parser"]
  GL_P2_T03["GL-P2-T03<br/>Install a safe prepare-commit-msg trace bridge"]
  GL_P2_T04["GL-P2-T04<br/>Produce and freeze one trace-linked LMS commit"]
  GL_P3_T01["GL-P3-T01<br/>Create metadata-only SQLite migrations and repositories"]
  GL_P3_T02["GL-P3-T02<br/>Normalize recorded GitHub Actions fixtures"]
  GL_P3_T03["GL-P3-T03<br/>Select exactly one primary Backend CI run"]
  GL_P3_T04["GL-P3-T04<br/>Emit labeled reconstructed workflow, job, and step spans"]
  GL_P3_T05["GL-P3-T05<br/>Attach a navigable Claude span link to the primary CI trace"]
  GL_P4_T01["GL-P4-T01<br/>Record versioned deployments with explicit roles"]
  GL_P4_T02["GL-P4-T02<br/>Generate and store an auditable good baseline anchor"]
  GL_P4_T03["GL-P4-T03<br/>Implement reviewed SigNoz Query Builder v5 adapter"]
  GL_P4_T04["GL-P4-T04<br/>Evaluate transparent latency and error regression policy"]
  GL_P4_T05["GL-P4-T05<br/>Resolve recovery against the original good baseline"]
  GL_P4_T06["GL-P4-T06<br/>Instrument GreenLight API with OpenTelemetry"]
  GL_P5_T01["GL-P5-T01<br/>Expose the changes-list API contract"]
  GL_P5_T02["GL-P5-T02<br/>Assemble the complete Change Receipt API"]
  GL_P5_T03["GL-P5-T03<br/>Build the changes-list screen"]
  GL_P5_T04["GL-P5-T04<br/>Build the receipt evidence timeline and CI sections"]
  GL_P5_T05["GL-P5-T05<br/>Render impact, policy, recovery, and safe action states"]
  GL_P6_T01["GL-P6-T01<br/>Create the deterministic bad LMS change and incident window"]
  GL_P6_T02["GL-P6-T02<br/>Create and verify the recovery deployment"]
  GL_P6_T03["GL-P6-T03<br/>Implement safe soft reset and full demo preflight"]
  GL_P7_T01["GL-P7-T01<br/>Script and verify the agent-native SigNoz MCP investigation"]
  GL_P7_T02["GL-P7-T02<br/>Freeze documentation, rehearsals, recording, and submission"]
  GL_P0_T01 --> GL_P0_T02
  GL_P0_T02 --> GL_P1_T01
  GL_P1_T01 --> GL_P1_T02
  GL_P1_T02 --> GL_P1_T03
  GL_P1_T01 --> GL_P2_T01
  GL_P2_T01 --> GL_P2_T02
  GL_P2_T02 --> GL_P2_T03
  GL_P2_T03 --> GL_P2_T04
  GL_P0_T01 --> GL_P3_T01
  GL_P3_T01 --> GL_P3_T02
  GL_P3_T02 --> GL_P3_T03
  GL_P3_T02 --> GL_P3_T04
  GL_P3_T03 --> GL_P3_T04
  GL_P2_T04 --> GL_P3_T05
  GL_P3_T04 --> GL_P3_T05
  GL_P3_T01 --> GL_P4_T01
  GL_P1_T02 --> GL_P4_T01
  GL_P4_T01 --> GL_P4_T02
  GL_P1_T03 --> GL_P4_T02
  GL_P1_T03 --> GL_P4_T03
  GL_P4_T02 --> GL_P4_T03
  GL_P4_T03 --> GL_P4_T04
  GL_P4_T04 --> GL_P4_T05
  GL_P3_T01 --> GL_P4_T06
  GL_P1_T01 --> GL_P4_T06
  GL_P3_T03 --> GL_P5_T01
  GL_P4_T04 --> GL_P5_T01
  GL_P5_T01 --> GL_P5_T02
  GL_P4_T05 --> GL_P5_T02
  GL_P3_T05 --> GL_P5_T02
  GL_P5_T01 --> GL_P5_T03
  GL_P5_T02 --> GL_P5_T04
  GL_P5_T04 --> GL_P5_T05
  GL_P4_T05 --> GL_P5_T05
  GL_P2_T04 --> GL_P6_T01
  GL_P4_T04 --> GL_P6_T01
  GL_P6_T01 --> GL_P6_T02
  GL_P4_T05 --> GL_P6_T02
  GL_P6_T02 --> GL_P6_T03
  GL_P6_T01 --> GL_P7_T01
  GL_P4_T03 --> GL_P7_T01
  GL_P6_T03 --> GL_P7_T02
  GL_P5_T05 --> GL_P7_T02
```

## Critical-path discipline

- Do not start P1 work while an unblocked P0 task is available.
- The Claude-to-CI linkage pivot remains time-boxed.
- GL-P3-T05 is a hard dependency of the full receipt and must run immediately when unblocked.
- Phase 6 incident tuning begins as soon as the evaluator is ready and can overlap Phase 5 UI work.
- End-to-end incident visibility is verified in GL-P7-T02 after both the incident and receipt UI are complete.
- Phase 7 begins only after two stable incident/recovery rehearsals.
