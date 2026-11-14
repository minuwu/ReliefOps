# Team Instructions — Human Onboarding & Per-Person Checklists

Read this once. Everything an AI agent needs is in [AGENTS.md](AGENTS.md); this file is for the humans driving those agents.

---

## 1. First 10 Minutes (everyone)

```bash
git clone https://github.com/minuwu/BJET-Hackathon.git
cd BJET-Hackathon
sh scripts/setup.sh            # Windows: powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

`setup` enables the pre-push sync hook, checks git/node/python/graphify, lists installed skills, and verifies your git identity.

Then:
1. Read [AGENTS.md](AGENTS.md) — Section 2 (XREQ queue) and your team's section in 4.
2. Read [docs/SKILLS.md](docs/SKILLS.md) — know which skill your agent must load for your work.
3. Open [graphify-out/graph.html](graphify-out/graph.html) in a browser — a 2-minute map of the repo.
4. Create your branch: `git checkout -b <name>/<topic>`.

## 2. Daily Loop (everyone)

1. **Start**: `git pull origin main`. Open AGENTS.md §2. Anything `[PENDING]` for you → do it first.
2. **Work**: tell your agent *"Follow AGENTS.md. Load the skill for <domain>."* Agents in this repo auto-read `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` / `.cursor/rules` / `.github/copilot-instructions.md`.
3. **Need something from another team?** File an `XREQ` (AGENTS.md §2.3), commit, push, ping the person. Keep working against a mock.
4. **End**: update `contributors/<you>/WORK_LOG.md` (newest first), commit, push. Open a PR to `main` when a slice is demoable.

## 3. Non-negotiables

- No direct pushes to `main`. Branch `<name>/<topic>` → PR → one approval → merge.
- Never commit `.env`. Keep `.env.example` current.
- Skills are mandatory: an agent coding in a domain without its skill loaded is doing it wrong (AGENTS.md §3.3).
- Breaking an API field without an `XREQ` to Frontend is a `P0` incident.
- Deploy a hello-world to Vercel (frontend) and Render/Railway (backend) in the first 2 hours, not the last 2.

## 4. Per-Person Checklists

| | Minhaz (`minuwu`) | Asif (`MdAsif-Hossain`) | Anim (`anim710`) | New teammate |
| :--- | :--- | :--- | :--- | :--- |
| **Role** | Frontend / Full-Stack / Architecture, repo owner | Backend / Services / Database | Backend / Services / Database (with Asif) | assigned at kickoff |
| **Branch prefix** | `minhaz/*` | `asif/*` | `anim/*` | `<name>/*` |
| **Work log** | [contributors/minhaz/WORK_LOG.md](contributors/minhaz/WORK_LOG.md) | [contributors/asif/WORK_LOG.md](contributors/asif/WORK_LOG.md) | [contributors/anim/WORK_LOG.md](contributors/anim/WORK_LOG.md) | `cp -r contributors/_template contributors/<name>` |
| **Skills your agent loads** | `vercel-react-best-practices`, `nextjs-app-router-patterns`, `frontend-design`, `tailwind-v4-shadcn`, `deploy-to-vercel` | `fastapi`, `python-testing-patterns`, `supabase-postgres-best-practices`, `openapi-spec-generation` | `fastapi`, `python-testing-patterns`, `supabase-postgres-best-practices`, `openapi-spec-generation` | per role, see [docs/SKILLS.md §1](docs/SKILLS.md) |
| **XREQs you answer** | `To: Frontend` / `To: Minhaz` | `To: Backend` / `To: Asif` | `To: Backend` / `To: Anim` | `To: <Team>` / `To: <name>` |
| **You own** | `frontend/`, `AGENTS.md`, `docs/SKILLS.md`, graphify graph, PR merges | `backend/`, `docs/API_SPEC.md`, Swagger `/docs`, DB schema | `backend/` services agreed with Asif; keep `docs/API_SPEC.md` in sync | agreed at kickoff, recorded in AGENTS.md §5 |
| **Hour-0 task** | Scaffold `frontend/` with mock toggle; deploy hello-world to Vercel | Scaffold `backend/` with CORS + `/api/health`; deploy to Render/Railway | Pair with Asif on `backend/` scaffold; claim first endpoint in WORK_LOG | run `scripts/setup`, read AGENTS.md, claim first task in WORK_LOG |

Add a column when a teammate joins (AGENTS.md §5.5).

## 5. Hour-0 Kickoff Agenda (45 min)

1. Problem statement + the one demo moment judges will remember (10 min).
2. Screens on paper/Excalidraw (10 min).
3. Endpoints + JSON into [docs/API_SPEC.md](docs/API_SPEC.md) (15 min). Use the envelope in §1 of that file.
4. Stack decision from [HACKATHON_PRESETUP.md §2](HACKATHON_PRESETUP.md#2-recommended-tech-stacks) (5 min).
5. Assign Hour-0 tasks from the table above; everyone opens a branch (5 min).

## 6. Keeping the Knowledge Graph Fresh

`graphify-out/` is committed so agents can answer "how does X connect to Y" without reading everything.
- After code changes: `graphify update .`
- After doc changes: ask your agent `/graphify . --update`
- Ask questions: `graphify query "how does the frontend mock toggle work"`
