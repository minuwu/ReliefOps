# Agent Entrypoint & Pre-Flight Arming Hook

Read [AGENTS.md](AGENTS.md) in full before any work. It is the single source of truth.

## Mandatory Pre-Flight Arming Hook (Every Chat & Task)
Before writing code or making design assumptions, run this persistent pipeline:
1. **Step 0: Check Cross-Functional Queue (XREQ)** — Check Section 2 of `AGENTS.md`. Fulfil any `[PENDING]` request for your team first.
2. **Step 1: Grill Me / Interactive Alignment** — Use `/grill-me` or interactive questioning (`ask_question`) to clarify ambiguities, edge cases, and design trade-offs before locking in plans.
3. **Step 2: Skill Discovery & Activation** — Load matching skills from `.claude/skills/<name>/SKILL.md` (see `docs/SKILLS.md`) and global plugins (`superpowers`). Skills are mandatory, not optional. If missing, discover via `find-skills` or marketplace.
4. **Step 3: Web Search for Standards** — Proactively use `search_web` to look up official documentation, current API signatures, RFCs, and modern industry standards.
5. **Step 4: Knowledge Graph Context** — For codebase questions run `graphify query "<question>"` before grep/glob/read. After code changes run `graphify update .`.

6. **Quality Bar** — every change must satisfy [docs/ENGINEERING_GUIDELINES.md](docs/ENGINEERING_GUIDELINES.md) (checklist `G-01`…`G-52`). Walk the boxes for the areas you touched before any PR or `[RESOLVED]`.

## Git & Execution Rules
- **TDD & Verification**: Practice test-driven development and verify with concrete evidence before claiming completion (`verification-before-completion`). Browser verification is permitted.
- **Git**: branch `<name>/<topic>` + PR to `main`, or push to `main` directly after `git pull origin main` (the pre-push hook rejects stale pushes), Conventional Commits, no attribution trailers, never commit `.env`.
