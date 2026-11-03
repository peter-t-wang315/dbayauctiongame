# CLAUDE.md

Start with [docs/README.md](docs/README.md): the status, the open items, the usage-limit rules and the Git workflow.

## Subagents: standing permission
The user has given standing permission to spawn subagents. Don't ask, and don't wait to be told.
- Spawn any subagents the work needs: coding workstreams, research sweeps, pre-PR reviewers, verification runs.
- Choose the agent type, model (Haiku, Sonnet, Opus) and effort level yourself, based on the task. The defaults in docs/README "Working within usage limits" are guidance, not a cap.
- Still follow the checkpoint protocol and the Git workflow (branch per task, draft PRs, pre-PR review). Avoid running agents in parallel on files that conflict.
