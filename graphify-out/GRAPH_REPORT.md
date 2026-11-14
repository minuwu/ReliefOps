# Graph Report - BJET-Hackathon  (2026-11-14)

## Corpus Check
- Corpus is ~5,124 words - fits in a single context window. You may not need a graph.

## Summary
- 60 nodes · 127 edges · 8 communities (7 shown, 1 thin omitted)
- Extraction: 90% EXTRACTED · 9% INFERRED · 1% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.84)
- Token cost: 80,000 input · 13,000 output

## Community Hubs (Navigation)
- Pre-Push Sync Hook
- API Contract & Frontend Directives
- Repo Docs & Work Logs
- XREQ Queue & Step-0 Protocol
- Contributor Roster & Onboarding
- Contract-First Mock Workflow
- Backend Directives & Stack

## God Nodes (most connected - your core abstractions)
1. `API Specification (Shared Contract)` - 15 edges
2. `XREQ Queue` - 14 edges
3. `Cross-Functional Protocol Plan` - 13 edges
4. `Minhaz Work Log` - 11 edges
5. `BJET-Hackathon Repository` - 9 edges
6. `Documentation Hub` - 9 edges
7. `AGENTS.md Protocol` - 8 edges
8. `Hackathon Pre-Setup Guide` - 8 edges
9. `Contract-First Development` - 8 edges
10. `XREQ Lifecycle States` - 6 edges

## Surprising Connections (you probably didn't know these)
- `POST /api/auth/login (XREQ contract)` --shares_data_with--> `POST /api/auth/login`  [INFERRED]
  AGENTS.md → docs/API_SPEC.md
- `minhaz.md Legacy Alias` --references--> `Minhaz Work Log`  [EXTRACTED]
  minhaz.md → contributors/minhaz/WORK_LOG.md
- `API Specification (Shared Contract)` --references--> `AGENTS.md Protocol`  [EXTRACTED]
  docs/API_SPEC.md → AGENTS.md
- `Step-0 Rule` --implements--> `Component A: Step 0 Rule`  [EXTRACTED]
  AGENTS.md → docs/plans/cross-functional-protocol-plan.md
- `Contract-First Development` --semantically_similar_to--> `XREQ Queue`  [INFERRED] [semantically similar]
  HACKATHON_PRESETUP.md → AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **XREQ Request Lifecycle** — agents_xreq_queue, agents_xreq_template, agents_xreq_lifecycle, agents_maximum_priority_mode, agents_use_mock_toggle, agents_archiving_policy, docs_api_spec_spec_update_procedure [EXTRACTED 1.00]
- **Step-0 Coding Agent Protocol** — agents_step_0_rule, agents_xreq_queue, agents_maximum_priority_mode, minhaz_work_log_minhaz_work_log, asif_work_log_asif_work_log, docs_plans_cross_functional_protocol_plan_component_a_step_0 [EXTRACTED 1.00]
- **Contract-First Parallel Workflow** — hackathon_presetup_contract_first_development, docs_api_spec_api_specification, hackathon_presetup_api_client_layer, agents_use_mock_toggle, hackathon_presetup_backend_playbook, hackathon_presetup_cors_middleware [INFERRED 0.85]

## Communities (8 total, 1 thin omitted)

### Community 0 - "Pre-Push Sync Hook"
Cohesion: 0.24
Nodes (3): Archiving Policy, XREQ-000 Repository Bootstrap, Component E: Maintenance Manual

### Community 1 - "API Contract & Frontend Directives"
Cohesion: 0.29
Nodes (10): Frontend Team Directives, Full-Stack & BaaS / AI Directives, USE_MOCK Toggle, API Specification (Shared Contract), Bearer Token Authentication, Conventions & Base URLs, GET /api/health, POST /api/auth/login (+2 more)

### Community 2 - "Repo Docs & Work Logs"
Cohesion: 0.64
Nodes (9): AGENTS.md Protocol, Asif Work Log, Daily Entry Template, Cross-Functional Protocol Plan, Documentation Hub, Hackathon Pre-Setup Guide, Minhaz Work Log, BJET-Hackathon Repository (+1 more)

### Community 3 - "XREQ Queue & Step-0 Protocol"
Cohesion: 0.33
Nodes (6): XREQ Queue, Blank XREQ Template, How to Update This Specification, Component A: Step 0 Rule, Component B: XREQ Queue, Quick Rules of Engagement

### Community 4 - "Contributor Roster & Onboarding"
Cohesion: 0.32
Nodes (8): Asif (MdAsif-Hossain), Contributor Roster, Minhaz (minuwu), Onboarding a New Contributor, POST /api/auth/login (XREQ contract), XREQ-001 Auth & Session Endpoint, Component D: Per-Contributor Instructions, minhaz.md Legacy Alias

### Community 5 - "Contract-First Mock Workflow"
Cohesion: 0.40
Nodes (5): frontend/src/services/api.ts Mock Toggle Client, Frontend Playbook, Recommended Monorepo Structure, POST /api/analyze (example), Repository Conventions

### Community 6 - "Backend Directives & Stack"
Cohesion: 0.40
Nodes (4): Backend Team Directives, Backend Playbook, CORS Middleware, Recommended Tech Stacks

## Ambiguous Edges - Review These
- `Standard Response Envelope` → `POST /api/auth/login`  [AMBIGUOUS]
  docs/API_SPEC.md · relation: conceptually_related_to

## Knowledge Gaps
- **2 isolated node(s):** `Full-Stack & BaaS / AI Directives`, `GET /api/health`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 7 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `API Specification (Shared Contract)` connect `API Contract & Frontend Directives` to `Repo Docs & Work Logs`, `XREQ Queue & Step-0 Protocol`, `Contract-First Mock Workflow`, `Backend Directives & Stack`?**
  _High betweenness centrality (0.249) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `pre-push hook` (e.g. with `Git Merge Conflict Prevention` and `Git & Team Rules for Speed`) actually correct?**
  _`pre-push hook` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Full-Stack & BaaS / AI Directives`, `GET /api/health` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Why does `XREQ Queue` connect `XREQ Queue & Step-0 Protocol` to `Pre-Push Sync Hook`, `API Contract & Frontend Directives`, `Repo Docs & Work Logs`, `Contributor Roster & Onboarding`, `Contract-First Mock Workflow`, `Backend Directives & Stack`?**
  _High betweenness centrality (0.179) - this node is a cross-community bridge._
- **Why does `Cross-Functional Protocol Plan` connect `Repo Docs & Work Logs` to `Pre-Push Sync Hook`, `API Contract & Frontend Directives`, `XREQ Queue & Step-0 Protocol`, `Contributor Roster & Onboarding`?**
  _High betweenness centrality (0.151) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Standard Response Envelope` and `POST /api/auth/login`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._