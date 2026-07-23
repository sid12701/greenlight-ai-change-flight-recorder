# GreenLight — AI Change Flight Recorder

GreenLight connects an AI coding session to the Git commit it produced, the CI run that validated it, the deployed application version, the resulting SigNoz telemetry, and the evidence that the application recovered.

This repository is the new hackathon project. The pre-existing Bhawana LMS is used only as a monitored demo workload.

## Track

GreenLight is filed under **Track 3 — Build Your Own** because it instruments an otherwise unobserved surface: the AI-authored software-delivery lifecycle, rather than the application or coding agent in isolation. It is inspired by the deployment-guardian problem described in [SigNoz issue #11657](https://github.com/SigNoz/signoz/issues/11657).

The Track 3 path requires GL-P7-T01's fixed SigNoz MCP investigation. If the schedule forces that P1 task to be cut, the remaining product is submitted only to Track 1; the repository must not claim Track 3 without the MCP demonstration.

## Status

Repository scaffolding and implementation planning are complete. Product implementation has not started.

Start with:

1. [Authoritative implementation plan](GREENLIGHT_IMPLEMENTATION_PLAN.md)
2. [Tracer-bullet task index](docs/IMPLEMENTATION_TASKS.md)
3. [Dependency graph](docs/DEPENDENCY_GRAPH.md)
4. [Test strategy](docs/TEST_STRATEGY.md)
5. [Commit strategy](docs/COMMIT_STRATEGY.md)
6. [Machine-readable task manifest](TASKS.yaml)

The manifest currently contains 27 P0 tasks and three pre-declared P1 cuts. Its bottom-up estimate is 2,660 focused minutes; see the execution-budget section of the authoritative plan before starting implementation.

## Core evidence chain

```text
Claude Code trace
  → AI-Traceparent Git trailer
  → reconstructed GitHub Actions trace
  → LMS deployment with service.version=<SHA>
  → SigNoz regression evidence
  → GreenLight Change Receipt
  → recovery proof
```

## AI assistance disclosure

Planning and implementation may use Codex/ChatGPT, Claude Code, Cursor, or other AI assistants. AI systems are tools, not repository authors or commit co-authors. All commits are reviewed and authored under the human maintainer's verified Git identity. See [PROVENANCE.md](PROVENANCE.md).

## License

MIT. See [LICENSE](LICENSE).
