# Agent entrypoint

Read [AGENTS.md](AGENTS.md) in full before any work. It is the single source of truth.

Mandatory order every session:
1. **Step 0** — check the `XREQ` queue in AGENTS.md Section 2. Fulfil any `[PENDING]` request for your team first.
2. **Step 1** — load the matching skill from `.claude/skills/<name>/SKILL.md` (routing table: `docs/SKILLS.md`). Read it end to end before writing code in that domain.
3. **Step 2** — for codebase questions run `graphify query "<question>"` before grep/glob/read. After code changes run `graphify update .`.

4. **Quality bar** — every change must satisfy [docs/ENGINEERING_GUIDELINES.md](docs/ENGINEERING_GUIDELINES.md) (checklist `G-01`…`G-52`: lint-not-prose, no slop, verification evidence, no comments-as-excuses). Walk the boxes for the areas you touched before any PR or `[RESOLVED]`.

Git: branch `<name>/<topic>` + PR to `main`, or push to `main` directly after `git pull origin main` (the pre-push hook rejects stale pushes), Conventional Commits, no attribution trailers, never commit `.env`.
