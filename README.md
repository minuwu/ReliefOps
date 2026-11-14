# BJET-Hackathon

Monorepo for the team: frontend, backend, AI, docs, and the agent protocol that keeps three workstreams unblocked. Contract-first parallel development, automated pre-push sync, committed agent skills, and a knowledge graph for agentic coding.

## Start Here

```bash
git clone https://github.com/minuwu/BJET-Hackathon.git && cd BJET-Hackathon
sh scripts/setup.sh      # Windows: powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

| Read | Why |
| :--- | :--- |
| [docs/problem-statements/hackathon-1-safer-banking/](docs/problem-statements/hackathon-1-safer-banking/README.md) | **The problem we are solving**: brief, MVP, rules, judging |
| [TEAM_INSTRUCTIONS.md](TEAM_INSTRUCTIONS.md) | Human onboarding, daily loop, per-person checklists, kickoff agenda |
| [AGENTS.md](AGENTS.md) | **Agent protocol**: `XREQ` cross-team queue (Step 0), mandatory skills (Step 1), graph-first (Step 2), git rules |
| [docs/SKILLS.md](docs/SKILLS.md) | Which skill an agent must load for which task; how to add more |
| [docs/API_SPEC.md](docs/API_SPEC.md) | Shared API contract (single source of truth) |
| [HACKATHON_PRESETUP.md](HACKATHON_PRESETUP.md) | Stack options, monorepo layout, contract-first playbooks |
| [docs/README.md](docs/README.md) | Documentation index |

## Repository Layout

```
BJET-Hackathon/
├── AGENTS.md                 # agent + team protocol (source of truth)
├── CLAUDE.md / GEMINI.md     # thin pointers to AGENTS.md for each agent
├── .cursor/rules/ .github/   # same pointers for Cursor / Copilot
├── .claude/skills/           # committed skill packs (see docs/SKILLS.md)
├── skills-lock.json          # pinned skill sources
├── .githooks/pre-push        # auto fetch + merge origin/main before push
├── scripts/setup.sh|.ps1     # one-shot onboarding
├── contributors/<name>/      # per-person WORK_LOG.md
├── docs/                     # API_SPEC, SKILLS, plans/
├── graphify-out/             # knowledge graph: graph.html, graph.json, GRAPH_REPORT.md
├── frontend/                 # (created at Hour 0)
└── backend/                  # (created at Hour 0)
```

## Team

| Contributor | Focus | Branch prefix | Work Log |
| :--- | :--- | :--- | :--- |
| **Minhaz** (`minuwu`) | Frontend / Full-Stack / Architecture | `minhaz/*` | [contributors/minhaz/WORK_LOG.md](contributors/minhaz/WORK_LOG.md) |
| **Asif** (`MdAsif-Hossain`) | Backend / Services / Database | `asif/*` | [contributors/asif/WORK_LOG.md](contributors/asif/WORK_LOG.md) |
| **Anim** (`anim710`) | Backend / Services / Database | `anim/*` | [contributors/anim/WORK_LOG.md](contributors/anim/WORK_LOG.md) |
| **Galib** (`Ga-lib`) | AI / LLM | `galib/*` | [contributors/galib/WORK_LOG.md](contributors/galib/WORK_LOG.md) |

## Conventions

1. **Branches**: `<name>/<topic>` → PR → `main`. Direct pushes to `main` are allowed after `git pull origin main`; the pre-push hook rejects stale ones.
2. **Contract-first**: Frontend ships against mocks mirroring `docs/API_SPEC.md`; Backend implements the same contract. Integration is a toggle flip.
3. **Cross-team needs** go through an `XREQ` in [AGENTS.md §2](AGENTS.md#2-active-cross-functional-request-queue-xreq). The partner's agent treats it as top priority.
4. **Skills are mandatory** for agents ([docs/SKILLS.md](docs/SKILLS.md)). **Knowledge graph first** for codebase questions: `graphify query "<question>"`.
5. **Commits**: Conventional Commits. **Secrets**: `.env` never committed; `.env.example` always current.
