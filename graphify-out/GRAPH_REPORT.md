# Graph Report - B-jet Hackathon 1st  (2026-11-14)

## Corpus Check
- 23 files · ~15,825 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 123 nodes · 166 edges · 18 communities (13 shown, 5 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 1% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fce0887e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- pre-push hook
- API Specification (Shared Contract)
- Skills — Mandatory Agent Knowledge Packs
- XREQ Queue
- Frontend Team Directives
- Backend, Database & DevOps Plan — Fraud Relief Case System
- 2026-11-13
- pre-push
- 2026-11-14
- CLAUDE.md
- GEMINI.md
- copilot-instructions.md
- setup.sh script

## God Nodes (most connected - your core abstractions)
1. `API Specification (Shared Contract)` - 14 edges
2. `XREQ Queue` - 13 edges
3. `Backend, Database & DevOps Plan — Fraud Relief Case System` - 11 edges
4. `Cross-Functional Protocol Plan` - 11 edges
5. `Contract-First Development` - 8 edges
6. `AGENTS.md Protocol` - 7 edges
7. `Documentation Hub` - 7 edges
8. `Hackathon Pre-Setup Guide` - 7 edges
9. `BJET-Hackathon Repository` - 7 edges
10. `Skills — Mandatory Agent Knowledge Packs` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Contract-First Development` --semantically_similar_to--> `XREQ Queue`  [INFERRED] [semantically similar]
  HACKATHON_PRESETUP.md → AGENTS.md
- `Git & Team Rules for Speed` --semantically_similar_to--> `Git Merge Conflict Prevention`  [INFERRED] [semantically similar]
  HACKATHON_PRESETUP.md → AGENTS.md
- `frontend/src/services/api.ts Mock Toggle Client` --implements--> `USE_MOCK Toggle`  [INFERRED]
  HACKATHON_PRESETUP.md → AGENTS.md
- `Backend Team Directives` --conceptually_related_to--> `CORS Middleware`  [INFERRED]
  AGENTS.md → HACKATHON_PRESETUP.md
- `Frontend Team Directives` --references--> `API Specification (Shared Contract)`  [EXTRACTED]
  AGENTS.md → docs/API_SPEC.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **XREQ Request Lifecycle** — agents_xreq_queue, agents_xreq_template, agents_xreq_lifecycle, agents_maximum_priority_mode, agents_use_mock_toggle, agents_archiving_policy, docs_api_spec_spec_update_procedure [EXTRACTED 1.00]
- **Contract-First Parallel Workflow** — hackathon_presetup_contract_first_development, docs_api_spec_api_specification, hackathon_presetup_api_client_layer, agents_use_mock_toggle, hackathon_presetup_backend_playbook, hackathon_presetup_cors_middleware [INFERRED 0.85]

## Communities (18 total, 5 thin omitted)

### Community 0 - "pre-push hook"
Cohesion: 0.21
Nodes (12): git fetch, git merge --no-edit, git push (re-push after merge), git rev-list --count behind check, pre-push hook, PRE_PUSH_RUNNING Recursion Guard, Archiving Policy, Git Merge Conflict Prevention (+4 more)

### Community 1 - "API Specification (Shared Contract)"
Cohesion: 0.17
Nodes (16): Full-Stack & BaaS / AI Directives, POST /api/auth/login (XREQ contract), API Specification (Shared Contract), Bearer Token Authentication, Conventions & Base URLs, GET /api/health, POST /api/auth/login, Standard Response Envelope (+8 more)

### Community 2 - "Skills — Mandatory Agent Knowledge Packs"
Cohesion: 0.12
Nodes (13): Contributors, Blockers / handoff, Completed, <Name>'s Work Log, Next, Related issues / commits / PRs, YYYY-MM-DD, 1. Routing Table — which skill for which task (+5 more)

### Community 3 - "XREQ Queue"
Cohesion: 0.30
Nodes (15): AGENTS.md Protocol, Maximum Priority Mode, Step-0 Rule, XREQ Lifecycle States, XREQ Queue, Blank XREQ Template, How to Update This Specification, Component A: Step 0 Rule (+7 more)

### Community 4 - "Frontend Team Directives"
Cohesion: 0.25
Nodes (11): Asif (MdAsif-Hossain), Backend Team Directives, Contributor Roster, Frontend Team Directives, Minhaz (minuwu), No Silent Breaking Changes, Onboarding a New Contributor, USE_MOCK Toggle (+3 more)

### Community 5 - "Backend, Database & DevOps Plan — Fraud Relief Case System"
Cohesion: 0.15
Nodes (11): 10. Open questions (decide at kickoff), 1. The brief, in short, 2. Decisions, 3. Requirement → contract map, 4. Data model (Postgres), 5. Bank separation (judge question 1), 6. AI safety and failure plan (judge questions 2 and 3), 7. DevOps (+3 more)

### Community 6 - "2026-11-13"
Cohesion: 0.17
Nodes (12): 2026-11-13, 2026-11-14, Asif's Work Log, Blockers / handoff, Blockers / handoff, Completed, Completed, Daily entry template (+4 more)

### Community 8 - "2026-11-14"
Cohesion: 0.17
Nodes (12): 2026-11-14, 2026-11-14 (evening) — repo quality pass, Blockers / handoff, Blockers / handoff, Completed, Completed, Daily entry template, Minhaz's Work Log (+4 more)

## Ambiguous Edges - Review These
- `POST /api/auth/login` → `Standard Response Envelope`  [AMBIGUOUS]
  docs/API_SPEC.md · relation: conceptually_related_to

## Knowledge Gaps
- **44 isolated node(s):** `setup.sh script`, `Agent entrypoint`, `Agent entrypoint`, `Agent entrypoint`, `Contributors` (+39 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `POST /api/auth/login` and `Standard Response Envelope`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Asif's Work Log` connect `2026-11-13` to `Backend, Database & DevOps Plan — Fraud Relief Case System`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `Minhaz's Work Log` connect `2026-11-14` to `Skills — Mandatory Agent Knowledge Packs`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `pre-push hook` (e.g. with `Git Merge Conflict Prevention` and `Git & Team Rules for Speed`) actually correct?**
  _`pre-push hook` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `setup.sh script`, `Agent entrypoint`, `Agent entrypoint` to the rest of the system?**
  _44 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Skills — Mandatory Agent Knowledge Packs` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._