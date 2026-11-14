# Skills — Mandatory Agent Knowledge Packs

Skills are versioned instruction packs (`SKILL.md` + reference files) that make a coding agent follow proven patterns instead of improvising. They are **committed into this repo** at [`.claude/skills/`](../.claude/skills/) so every teammate and every agent works from the same playbook. `skills-lock.json` pins the source and hash of each one.

**Rule (from [AGENTS.md §3.3](../AGENTS.md#33-step-1--load-the-matching-skill-mandatory)): before writing code in a domain, read that domain's `SKILL.md` end to end. No exceptions.**

---

## 1. Routing Table — which skill for which task

| You are about to… | Load first | Then |
| :--- | :--- | :--- |
| Write or review React / Next.js code | `vercel-react-best-practices` | `nextjs-app-router-patterns` (App Router, server components, streaming) |
| Build or restyle UI, pick layout/typography/colors | `frontend-design` | `tailwind-v4-shadcn` (Tailwind v4 + shadcn/ui + Vite setup, dark mode) |
| Write FastAPI routes, Pydantic models, SSE streaming | `fastapi` | `python-testing-patterns` (pytest, fixtures, mocking) |
| Design, create or alter database tables / queries | `supabase-postgres-best-practices` | `supabase` (Auth, Realtime, Storage, Edge Functions) **or** `prisma-orm-setup` |
| Define or change the API contract | `openapi-spec-generation` | update [`docs/API_SPEC.md`](API_SPEC.md) |
| Commit, branch, resolve conflicts, split messy work | `git-workflow-and-versioning` | — |
| Deploy frontend | `deploy-to-vercel` | — |
| Need a capability no skill covers | `find-skills` | install per §3, add a row here |

Skill paths: `.claude/skills/<name>/SKILL.md`.

---

## 2. Installed Skills

| Skill | Source | Installs (skills.sh) | Purpose |
| :--- | :--- | :--- | :--- |
| `find-skills` | `vercel-labs/skills` | — | Discover and install new skills from the open ecosystem |
| `vercel-react-best-practices` | `vercel-labs/agent-skills` | ~900K | React/Next.js performance and correctness rules from Vercel Engineering |
| `nextjs-app-router-patterns` | `wshobson/agents` | ~34K | Next.js 14+ App Router, server components, parallel routes, data fetching |
| `frontend-design` | `anthropics/skills` | ~1.1M | Distinctive, intentional UI design; avoids generic "AI look" |
| `tailwind-v4-shadcn` | `secondsky/claude-skills` | ~8K | Tailwind v4 + shadcn/ui + Vite/React setup, dark mode, troubleshooting |
| `fastapi` | `fastapi/fastapi` (official) | ~15K | FastAPI conventions, Pydantic, dependencies, SSE, serving frontend |
| `python-testing-patterns` | `wshobson/agents` | ~40K | pytest, fixtures, mocking, TDD |
| `supabase` | `supabase/agent-skills` (official) | ~365K | Any Supabase task: DB, Auth, Edge Functions, Realtime, Storage |
| `supabase-postgres-best-practices` | `supabase/agent-skills` (official) | ~485K | Postgres schema, indexing, RLS, query patterns (any Postgres) |
| `prisma-orm-setup` | `prisma/skills` (official) | ~425K | Prisma ORM setup and schema workflow |
| `openapi-spec-generation` | `wshobson/agents` | ~17K | OpenAPI 3.1 specs, design-first contracts, validation |
| `git-workflow-and-versioning` | `addyosmani/agent-skills` | ~72K | Atomic commits, branching, conflict resolution, versioning |
| `deploy-to-vercel` | `vercel-labs/agent-skills` | ~192K | Deploy and get preview/production links |

Install counts as of 2026-11-14. Verify a skill on https://skills.sh/ before trusting a new one; prefer official org sources and 1K+ installs.

---

## 3. Adding a Skill (team-wide, committed)

```bash
npx skills find "<topic>"                                   # search
npx skills add <owner/repo@skill> -a claude-code --copy -y  # install INTO the repo (.claude/skills/)
```

Then:
1. Open `.claude/skills/<name>/SKILL.md` and skim it — skills run with full agent permissions; reject anything that shells out to unknown URLs.
2. Add a row to §2 and, if it changes routing, §1.
3. Commit `.claude/skills/<name>/`, `skills-lock.json`, and this file together: `chore(skills): add <name>`.

Do **not** use `-g` (global). Global installs land on your machine only; teammates never see them.

Update everything: `npx skills update -p -y`.

---

## 4. Using Skills From Each Agent

| Agent | How skills load |
| :--- | :--- |
| **Claude Code** | Automatic — reads `.claude/skills/*/SKILL.md`; invoke by name (`/fastapi`) or let it trigger on description. |
| **Cursor** | `.cursor/rules/agents.mdc` (always-apply) tells it to read `AGENTS.md` and open the skill file. Ask: "Read .claude/skills/fastapi/SKILL.md and follow it." |
| **GitHub Copilot** | `.github/copilot-instructions.md` is auto-loaded. Reference the skill file in chat with `#file`. |
| **Gemini CLI** | Reads `GEMINI.md`. Ask it to read the skill file before coding. |
| **Antigravity / Codex / others** | Read `AGENTS.md` (standard agent entrypoint), then open the skill file with the file tool. |

If an agent starts coding in a domain without having read the skill, stop it and point it at the file.

---

## 5. Local Skills (project-specific)

Project-specific knowledge (domain glossary, demo script, judge rubric) belongs in a local skill: `npx skills init <name>` inside `.claude/skills/`, write `SKILL.md`, commit. Keep it under 200 lines; link to `docs/` for detail.
