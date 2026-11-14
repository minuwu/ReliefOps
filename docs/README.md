# Repository Documentation & Artifacts Hub

Welcome to the documentation hub for **BJET-Hackathon**. All architectural plans, API specifications, and team guidelines are indexed here.

---

## 📁 Directory Structure & Index

| Directory / File | Description | Audience |
| :--- | :--- | :--- |
| **[AGENTS.md](../AGENTS.md)** | **Master Protocol**: Coding agent directives, active `XREQ` queue, team & contributor rules | AI Agents & Developers |
| **[TEAM_INSTRUCTIONS.md](../TEAM_INSTRUCTIONS.md)** | Human onboarding, daily loop, per-person checklists | Human Developers |
| **[scripts/](../scripts/)** | `setup.sh` / `setup.ps1` one-shot onboarding | Entire Team |
| **[graphify-out/](../graphify-out/)** | Knowledge graph (`graph.html`, `graph.json`, `GRAPH_REPORT.md`) — query with `graphify query` | AI Agents & Developers |
| **[HACKATHON_PRESETUP.md](../HACKATHON_PRESETUP.md)** | Architecture options, stack recommendation, contract-first guide | Entire Team |
| **[docs/SKILLS.md](SKILLS.md)** | Mandatory agent skill packs: routing table, catalog, how to add | AI Agents & Developers |
| **[docs/API_SPEC.md](../docs/API_SPEC.md)** | Shared API contract ledger, data models & endpoints | Frontend & Backend |
| └── [openapi.yaml](../docs/openapi.yaml) | Machine-readable contract (OpenAPI 3.1); runs as a mock API at `localhost:4010` with no backend | Frontend, Backend & AI |
| **[docs/plans/](../docs/plans/)** | Architecture plans, RFCs, and agent design artifacts | Product & Architecture |
| ├── [cross-functional-protocol-plan.md](../docs/plans/cross-functional-protocol-plan.md) | Architectural plan for cross-functional queue & agent priority | Architecture & Agents |
| ├── [backend-development-guide.md](../docs/plans/backend-development-guide.md) | How Asif and Anim build and test the backend: work split, phases, CRUD recipe, testing (pytest, curl, contract), Definition of Done | Backend |
| └── [backend-plan.md](../docs/plans/backend-plan.md) | Backend, database & devops plan: decisions, data model, bank separation, AI failure plan, milestones | Backend, AI & Frontend |
| **[docs/problem-statements/](../docs/problem-statements/)** | Hackathon problem statements | Entire Team |
| └── [hackathon-1-safer-banking](../docs/problem-statements/hackathon-1-safer-banking/Hackathon_1_Explained.md) | Practice brief: shared scam-relief operations center for 5 banks (MVP, rules, judging) | Entire Team |
| **[contributors/](../contributors/)** | One folder per teammate with `WORK_LOG.md`; `_template/` for newcomers | Entire Team |
| **[contributors/minhaz/WORK_LOG.md](../contributors/minhaz/WORK_LOG.md)** | Minhaz's active sprint log & handoffs | Minhaz & Collaborators |
| **[contributors/asif/WORK_LOG.md](../contributors/asif/WORK_LOG.md)** | Asif's active sprint log & handoffs | Asif & Collaborators |

---

## ⚡ Quick Rules of Engagement

1. **Coding Agents**: Before starting any feature work, execute **Step 0 in [AGENTS.md](../AGENTS.md)**: check the active `XREQ` queue and fulfill any pending blocker targeting your team.
2. **Contract-First**: Never block frontend on backend. Wire mock JSON using `docs/API_SPEC.md` or `AGENTS.md`.
3. **Skills First**: Agents load the matching skill from `.claude/skills/` before coding ([docs/SKILLS.md](SKILLS.md)).
4. **Graph First**: `graphify query "<question>"` before grepping the repo.
5. **Daily Logs**: Keep `contributors/<name>/WORK_LOG.md` updated with completed work and handoffs.
