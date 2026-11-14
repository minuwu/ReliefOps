# Graph Report - E:\B-jet Hackathon 1st  (2026-11-14)

## Corpus Check
- Corpus is ~16,012 words - fits in a single context window. You may not need a graph.

## Summary
- 220 nodes · 417 edges · 18 communities (12 shown, 6 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 61 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- API Specification (Shared Contract)
- Routing Table
- AGENTS.md Cross-Functional Team Protocol
- Team Instructions (Human Onboarding)
- XREQ Queue (Active Cross-Functional Request Queue)
- Backend, Database & DevOps Plan — Fraud Relief Case System
- Hackathon Pre-Setup & Parallel Workflow Guide
- steps
- contributors/anim/WORK_LOG.md
- Frontend Team Directives
- Cross-Functional Team & Coding Agent Protocol Plan
- pre-push
- setup.sh script
- app/__init__.py
- models/__init__.py
- routers/__init__.py
- services/__init__.py

## God Nodes (most connected - your core abstractions)
1. `AGENTS.md Cross-Functional Team Protocol` - 29 edges
2. `Routing Table` - 26 edges
3. `API Specification (Shared Contract)` - 23 edges
4. `Installed Skills` - 16 edges
5. `XREQ Queue (Active Cross-Functional Request Queue)` - 15 edges
6. `Hackathon Pre-Setup & Parallel Workflow Guide` - 15 edges
7. `Entry 2026-11-14 evening: Repo Quality Pass` - 14 edges
8. `Team Instructions (Human Onboarding)` - 12 edges
9. `Cross-Functional Team & Coding Agent Protocol Plan` - 11 edges
10. `graphify Knowledge Graph (graphify-out/graph.json)` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Pre-Push Hook (.githooks/pre-push)` --semantically_similar_to--> `Pre-Push Sync Hook (.githooks/pre-push)`  [INFERRED] [semantically similar]
  README.md → AGENTS.md
- `Asif (MdAsif-Hossain)` --semantically_similar_to--> `Asif (MdAsif-Hossain)`  [INFERRED] [semantically similar]
  contributors/README.md → AGENTS.md
- `Asif (MdAsif-Hossain)` --semantically_similar_to--> `Asif (MdAsif-Hossain)`  [INFERRED] [semantically similar]
  README.md → AGENTS.md
- `Git Rules` --semantically_similar_to--> `Git Rules for Agents`  [INFERRED] [semantically similar]
  .github/copilot-instructions.md → AGENTS.md
- `Git Rules` --semantically_similar_to--> `Git Rules for Agents`  [INFERRED] [semantically similar]
  CLAUDE.md → AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Agent startup sequence: Step 0 -> Step 1 -> Step 2** — agents_step_0_rule, agents_step_1_mandatory_skills, agents_step_2_knowledge_graph, agents_critical_directive [EXTRACTED 1.00]
- **Frontend skill set** — docs_skills_vercel_react_best_practices, docs_skills_nextjs_app_router_patterns, docs_skills_frontend_design, docs_skills_tailwind_v4_shadcn, docs_skills_deploy_to_vercel [EXTRACTED 1.00]
- **XREQ lifecycle PENDING -> IN_PROGRESS -> RESOLVED -> VERIFIED_AND_CLOSED -> archived** — agents_state_pending, agents_state_in_progress, agents_state_resolved, agents_state_verified_and_closed, agents_archived_log [EXTRACTED 1.00]

## Communities (18 total, 6 thin omitted)

### Community 0 - "API Specification (Shared Contract)"
Cohesion: 0.09
Nodes (31): AGENTS.md Protocol, AI / LLM Team Directives, Asif (MdAsif-Hossain), Backend XREQ SLA (15-30 min), Backend Team Directives, CORS from First Commit, Secrets Rule (.env never committed, .env.example current), Full-Stack & BaaS / AI Directives (+23 more)

### Community 1 - "Routing Table"
Cohesion: 0.16
Nodes (27): Adding a Skill (team-wide), deploy-to-vercel skill (vercel-labs/agent-skills), fastapi skill (fastapi/fastapi), find-skills skill (vercel-labs/skills), frontend-design skill (anthropics/skills), git-workflow-and-versioning skill (addyosmani/agent-skills), Installed Skills, Local Skills (project-specific) (+19 more)

### Community 2 - "AGENTS.md Cross-Functional Team Protocol"
Cohesion: 0.15
Nodes (26): Agent Entrypoint, Git Rules, Step 1: Load Matching Skill, Step 2: graphify Query First, Completed & Archived Requests Log, Archiving to Section 7, Critical Directive for Coding Agents, AGENTS.md Cross-Functional Team Protocol (+18 more)

### Community 3 - "Team Instructions (Human Onboarding)"
Cohesion: 0.12
Nodes (25): Contributor Roster, Minhaz (minuwu), Onboarding a New Contributor, Setup Scripts (scripts/setup.sh / setup.ps1), Entry Sections (Completed / Next / Blockers / Related), Work Log Template, Daily Entry Template, Minhaz (minuwu) (+17 more)

### Community 4 - "XREQ Queue (Active Cross-Functional Request Queue)"
Cohesion: 0.14
Nodes (21): Step 0: XREQ Queue Check, Conventional Commits, Creating an XREQ Request, No Silent Breaking Changes, Priority Levels P0/P1/P2, Recipient Agent Rules, [IN_PROGRESS], [PENDING] (+13 more)

### Community 5 - "Backend, Database & DevOps Plan — Fraud Relief Case System"
Cohesion: 0.10
Nodes (19): asif/WORK_LOG.md, 2026-11-13, Asif's Work Log, Blockers / handoff, Completed, Daily entry template, Next, Related issues / commits / PRs (+11 more)

### Community 6 - "Hackathon Pre-Setup & Parallel Workflow Guide"
Cohesion: 0.16
Nodes (16): Branch Convention <name>/<topic>, Quick Rules of Engagement, Agents Follow the Protocol, Hour 0-1 API Contract (docs/API_SPEC.md), Simple Branch Strategy, Contract-First Development, Deploy on Hour 2, Environment Variables (.env.example) (+8 more)

### Community 7 - "steps"
Cohesion: 0.13
Nodes (14): name, runs-on, steps, jobs, check-sync, name, on, pull_request (+6 more)

### Community 8 - "contributors/anim/WORK_LOG.md"
Cohesion: 0.18
Nodes (11): contributors/anim/WORK_LOG.md, Anim's Work Log, Next, Blockers / handoff, Related issues / commits / PRs, Completed, 2026-11-14, Blockers / handoff (+3 more)

### Community 9 - "Frontend Team Directives"
Cohesion: 0.28
Nodes (9): Frontend API Client (frontend/src/services/api.ts), Frontend Team Directives, Requester Agent Rules, [VERIFIED_AND_CLOSED], USE_MOCK Toggle, GET /api/health, Mock-First Rule (USE_MOCK = true), Component C: Per-Team Guidelines (+1 more)

### Community 10 - "Cross-Functional Team & Coding Agent Protocol Plan"
Cohesion: 0.31
Nodes (9): Merge-Conflict Prevention, Pre-Push Sync Hook (.githooks/pre-push), Entry 2026-11-14: Protocol Authored, Component E: Management & Maintenance Manual, Pre-Push Hook (automatic remote sync), Cross-Functional Team & Coding Agent Protocol Plan, Coding Agent Startup Sequence, Component A: The Step 0 Rule (+1 more)

## Ambiguous Edges - Review These
- `POST /api/auth/login` → `Standard Response Envelope`  [AMBIGUOUS]
  docs/API_SPEC.md · relation: conceptually_related_to

## Knowledge Gaps
- **49 isolated node(s):** `setup.sh script`, `name`, `runs-on`, `name`, `branches` (+44 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `POST /api/auth/login` and `Standard Response Envelope`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `AGENTS.md Cross-Functional Team Protocol` connect `AGENTS.md Cross-Functional Team Protocol` to `API Specification (Shared Contract)`, `Team Instructions (Human Onboarding)`, `XREQ Queue (Active Cross-Functional Request Queue)`, `Hackathon Pre-Setup & Parallel Workflow Guide`, `Frontend Team Directives`, `Cross-Functional Team & Coding Agent Protocol Plan`?**
  _High betweenness centrality (0.162) - this node is a cross-community bridge._
- **Why does `API Specification (Shared Contract)` connect `API Specification (Shared Contract)` to `Routing Table`, `AGENTS.md Cross-Functional Team Protocol`, `XREQ Queue (Active Cross-Functional Request Queue)`, `Hackathon Pre-Setup & Parallel Workflow Guide`, `Frontend Team Directives`, `Cross-Functional Team & Coding Agent Protocol Plan`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Why does `Routing Table` connect `Routing Table` to `API Specification (Shared Contract)`, `AGENTS.md Cross-Functional Team Protocol`, `Team Instructions (Human Onboarding)`, `XREQ Queue (Active Cross-Functional Request Queue)`, `Hackathon Pre-Setup & Parallel Workflow Guide`, `Frontend Team Directives`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Routing Table` (e.g. with `Backend Team Directives` and `Frontend Team Directives`) actually correct?**
  _`Routing Table` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `setup.sh script`, `name`, `runs-on` to the rest of the system?**
  _49 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Specification (Shared Contract)` be split into smaller, more focused modules?**
  _Cohesion score 0.08602150537634409 - nodes in this community are weakly interconnected._
## Merge provenance

Combined the committed main graph with the API-contract branch extraction. Feature-source nodes replace their earlier versions; other main graph nodes are retained. New onboarding documents are indexed by headings. No new model extraction or paid API calls were used.
