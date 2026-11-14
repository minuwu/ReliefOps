# Graph Report - BJET-Hackathon  (2026-11-14)

## Corpus Check
- Corpus is ~8,111 words - fits in a single context window. You may not need a graph.

## Summary
- 184 nodes · 407 edges · 12 communities (9 shown, 3 thin omitted)
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.89)
- Token cost: 120,000 input · 30,000 output

## Community Hubs (Navigation)
- Mandatory Skills & Catalog
- Repo Protocol & Onboarding
- Contributor Roster & Work Logs
- Agent Entrypoint & Git Rules
- XREQ Queue Lifecycle
- Backend Directives & API Envelope
- Contract-First Workflow
- CI Branch Sync Workflow
- Frontend Mock Toggle
- Setup Script (sh)

## God Nodes (most connected - your core abstractions)
1. `AGENTS.md Cross-Functional Team Protocol` - 30 edges
2. `Routing Table` - 27 edges
3. `API Specification (Shared Contract)` - 21 edges
4. `XREQ Queue (Active Cross-Functional Request Queue)` - 16 edges
5. `Hackathon Pre-Setup & Parallel Workflow Guide` - 16 edges
6. `Installed Skills` - 16 edges
7. `Entry 2026-11-14 evening: Repo Quality Pass` - 15 edges
8. `Team Instructions (Human Onboarding)` - 13 edges
9. `Documentation Hub` - 13 edges
10. `graphify Knowledge Graph (graphify-out/graph.json)` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Git Rules` --semantically_similar_to--> `Git Rules for Agents`  [INFERRED] [semantically similar]
  .github/copilot-instructions.md → AGENTS.md
- `Mock-First Rule (USE_MOCK = true)` --semantically_similar_to--> `USE_MOCK Toggle`  [INFERRED] [semantically similar]
  docs/plans/cross-functional-protocol-plan.md → AGENTS.md
- `Breaking Change Protocol` --semantically_similar_to--> `No Silent Breaking Changes`  [INFERRED] [semantically similar]
  docs/plans/cross-functional-protocol-plan.md → AGENTS.md
- `Asif (MdAsif-Hossain)` --semantically_similar_to--> `Asif (MdAsif-Hossain)`  [INFERRED] [semantically similar]
  contributors/asif/WORK_LOG.md → AGENTS.md
- `Asif (MdAsif-Hossain)` --semantically_similar_to--> `Asif (MdAsif-Hossain)`  [INFERRED] [semantically similar]
  contributors/README.md → AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Agent startup sequence: Step 0 -> Step 1 -> Step 2** — agents_step_0_rule, agents_step_1_mandatory_skills, agents_step_2_knowledge_graph, agents_critical_directive [EXTRACTED 1.00]
- **XREQ lifecycle PENDING -> IN_PROGRESS -> RESOLVED -> VERIFIED_AND_CLOSED -> archived** — agents_state_pending, agents_state_in_progress, agents_state_resolved, agents_state_verified_and_closed, agents_archived_log [EXTRACTED 1.00]
- **Frontend skill set** — docs_skills_vercel_react_best_practices, docs_skills_nextjs_app_router_patterns, docs_skills_frontend_design, docs_skills_tailwind_v4_shadcn, docs_skills_deploy_to_vercel [EXTRACTED 1.00]

## Communities (12 total, 3 thin omitted)

### Community 0 - "Mandatory Skills & Catalog"
Cohesion: 0.15
Nodes (29): Step 1: Load Matching Skill, find-skills (npx skills find/add), Step 1: Load the Matching Skill (Mandatory), Step 1: Load Matching Skill, How to Update This Specification, Adding a Skill (team-wide), deploy-to-vercel skill (vercel-labs/agent-skills), fastapi skill (fastapi/fastapi) (+21 more)

### Community 1 - "Repo Protocol & Onboarding"
Cohesion: 0.13
Nodes (28): Completed & Archived Requests Log, Archiving to Section 7, AGENTS.md Cross-Functional Team Protocol, Merge-Conflict Prevention, Onboarding a New Contributor, Pre-Push Sync Hook (.githooks/pre-push), Setup Scripts (scripts/setup.sh / setup.ps1), XREQ-000 Initial Bootstrap (+20 more)

### Community 2 - "Contributor Roster & Work Logs"
Cohesion: 0.14
Nodes (22): Contributor Roster, Minhaz (minuwu), Entry Sections (Completed / Next / Blockers / Related), Work Log Template, Asif (MdAsif-Hossain), Daily Entry Template, Asif Entry 2026-11-13 (repo access + identity), Daily Entry Template (+14 more)

### Community 3 - "Agent Entrypoint & Git Rules"
Cohesion: 0.14
Nodes (21): Agent Entrypoint, Git Rules, Step 2: graphify Query First, AI / LLM Team Directives, Critical Directive for Coding Agents, Secrets Rule (.env never committed, .env.example current), Git Rules for Agents, graphify Knowledge Graph (graphify-out/graph.json) (+13 more)

### Community 4 - "XREQ Queue Lifecycle"
Cohesion: 0.14
Nodes (20): Step 0: XREQ Queue Check, Conventional Commits, Creating an XREQ Request, No Silent Breaking Changes, Priority Levels P0/P1/P2, Recipient Agent Rules, [IN_PROGRESS], [PENDING] (+12 more)

### Community 5 - "Backend Directives & API Envelope"
Cohesion: 0.15
Nodes (20): Asif (MdAsif-Hossain), Backend XREQ SLA (15-30 min), Backend Team Directives, CORS from First Commit, Response Envelope, Swagger /docs and /openapi.json, XREQ-EXAMPLE POST /api/auth/login, API Specification (Shared Contract) (+12 more)

### Community 6 - "Contract-First Workflow"
Cohesion: 0.15
Nodes (17): Branch Convention <name>/<topic>, Quick Rules of Engagement, Agents Follow the Protocol, Hour 0-1 API Contract (docs/API_SPEC.md), Simple Branch Strategy, Contract-First Development, Deploy on Hour 2, Environment Variables (.env.example) (+9 more)

### Community 7 - "CI Branch Sync Workflow"
Cohesion: 0.13
Nodes (14): name, runs-on, steps, jobs, check-sync, name, on, pull_request (+6 more)

### Community 8 - "Frontend Mock Toggle"
Cohesion: 0.38
Nodes (7): Frontend API Client (frontend/src/services/api.ts), Frontend Team Directives, Requester Agent Rules, [VERIFIED_AND_CLOSED], USE_MOCK Toggle, Mock-First Rule (USE_MOCK = true), Component C: Per-Team Guidelines

## Knowledge Gaps
- **11 isolated node(s):** `Backend XREQ SLA (15-30 min)`, `SSE Chunk Format Declaration`, `Prompts Directory (backend/app/prompts/)`, `Environment Variables (.env.example)`, `Setup Scripts` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 24 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AGENTS.md Cross-Functional Team Protocol` connect `Repo Protocol & Onboarding` to `Mandatory Skills & Catalog`, `Contributor Roster & Work Logs`, `Agent Entrypoint & Git Rules`, `XREQ Queue Lifecycle`, `Backend Directives & API Envelope`, `Contract-First Workflow`, `Frontend Mock Toggle`?**
  _High betweenness centrality (0.220) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Routing Table` (e.g. with `Backend Team Directives` and `Frontend Team Directives`) actually correct?**
  _`Routing Table` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Backend XREQ SLA (15-30 min)`, `SSE Chunk Format Declaration`, `Prompts Directory (backend/app/prompts/)` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Repo Protocol & Onboarding` be split into smaller, more focused modules?**
  _Cohesion score 0.12698412698412698 - nodes in this community are weakly interconnected._
- **Why does `Routing Table` connect `Mandatory Skills & Catalog` to `Repo Protocol & Onboarding`, `XREQ Queue Lifecycle`, `Backend Directives & API Envelope`, `Contract-First Workflow`, `Frontend Mock Toggle`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Should `Contributor Roster & Work Logs` be split into smaller, more focused modules?**
  _Cohesion score 0.13852813852813853 - nodes in this community are weakly interconnected._
- **Why does `API Specification (Shared Contract)` connect `Backend Directives & API Envelope` to `Mandatory Skills & Catalog`, `Repo Protocol & Onboarding`, `Contributor Roster & Work Logs`, `Agent Entrypoint & Git Rules`, `XREQ Queue Lifecycle`, `Contract-First Workflow`, `Frontend Mock Toggle`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._