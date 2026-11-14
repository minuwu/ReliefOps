# Agent entrypoint

Read [AGENTS.md](AGENTS.md) in full before any work. It is the single source of truth.

Mandatory order every session:
1. **Step 0** — check the `XREQ` queue in AGENTS.md Section 2. Fulfil any `[PENDING]` request for your team first.
2. **Step 1** — load the matching skill from `.claude/skills/<name>/SKILL.md` (routing table: `docs/SKILLS.md`). Read it end to end before writing code in that domain.
3. **Step 2** — for codebase questions run `graphify query "<question>"` before grep/glob/read. After code changes run `graphify update .`.

Git: branch `<name>/<topic>`, PR to `main`, Conventional Commits, no attribution trailers, never commit `.env`.
