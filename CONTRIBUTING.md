# Contributing

Implementation is organized as vertical tracer bullets. Each GitHub issue represents one independently testable slice.

## Workflow

1. Select the next unblocked issue from `docs/IMPLEMENTATION_TASKS.md`.
2. Create a branch named `agent/<issue-id>-<short-description>`.
3. Follow Red–Green–Refactor.
4. Run the issue's focused tests and relevant regression gates.
5. Commit one coherent slice with a Conventional Commit message and issue reference.
6. Do not use `--no-verify`.
7. Do not add AI `Co-authored-by` trailers.
8. Push and record evidence on the issue.

Never modify the original dirty `/Users/siddhant/Desktop/lms` checkout. LMS changes use a separate clean clone or worktree.
