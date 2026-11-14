# Graph Report - BJET-Hackathon  (2026-11-14)

## Corpus Check
- 58 files · ~57,906 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .mdc 1, .excalidraw 1)

## Summary
- 545 nodes · 1073 edges · 32 communities (24 shown, 8 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 63 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9778d25b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- API Specification (Shared Contract)
- Repo Protocol & Onboarding
- Contributor Roster & Work Logs
- CaseDetailModal.tsx
- XREQ Queue Lifecycle
- Backend Directives & API Envelope
- Contract-First Workflow
- CI Branch Sync Workflow
- Asif's Work Log
- Pre-Push Hook Script
- Setup Script (sh)
- setup.sh script
- 7. Testing
- package.json
- services/api.ts
- Hackathon 1: Shared Operations for Safer Banking
- types/api.ts
- compilerOptions
- Suggestions for the AI module, from the backend team
- Git Rules for Agents
- useCaseStore.ts
- useAuthStore.ts
- Extraction
- useVictimSessionStore.ts
- BJET-Hackathon Monorepo

## God Nodes (most connected - your core abstractions)
1. `API Specification (Shared Contract)` - 30 edges
2. `AGENTS.md Cross-Functional Team Protocol` - 29 edges
3. `Routing Table` - 26 edges
4. `Hackathon 1: Shared Operations for Safer Banking` - 20 edges
5. `compilerOptions` - 19 edges
6. `react` - 17 edges
7. `Badge()` - 16 edges
8. `cn()` - 16 edges
9. `Installed Skills` - 16 edges
10. `XREQ Queue (Active Cross-Functional Request Queue)` - 15 edges

## Surprising Connections (you probably didn't know these)
- `3. Requirement → contract map` --references--> `CaseSummary`  [INFERRED]
  docs/plans/backend-plan.md → frontend/src/types/api.ts
- `Git Rules` --semantically_similar_to--> `Git Rules for Agents`  [INFERRED] [semantically similar]
  .github/copilot-instructions.md → AGENTS.md
- `Asif (MdAsif-Hossain)` --semantically_similar_to--> `Asif (MdAsif-Hossain)`  [INFERRED] [semantically similar]
  contributors/README.md → AGENTS.md
- `Breaking Change Protocol` --semantically_similar_to--> `No Silent Breaking Changes`  [INFERRED] [semantically similar]
  docs/plans/cross-functional-protocol-plan.md → AGENTS.md
- `Mock-First Rule (USE_MOCK = true)` --semantically_similar_to--> `USE_MOCK Toggle`  [INFERRED] [semantically similar]
  docs/plans/cross-functional-protocol-plan.md → AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Agent startup sequence: Step 0 -> Step 1 -> Step 2** — agents_step_0_rule, agents_step_1_mandatory_skills, agents_step_2_knowledge_graph, agents_critical_directive [EXTRACTED 1.00]
- **Frontend skill set** — docs_skills_vercel_react_best_practices, docs_skills_nextjs_app_router_patterns, docs_skills_frontend_design, docs_skills_tailwind_v4_shadcn, docs_skills_deploy_to_vercel [EXTRACTED 1.00]
- **XREQ lifecycle PENDING -> IN_PROGRESS -> RESOLVED -> VERIFIED_AND_CLOSED -> archived** — agents_state_pending, agents_state_in_progress, agents_state_resolved, agents_state_verified_and_closed, agents_archived_log [EXTRACTED 1.00]

## Communities (32 total, 8 thin omitted)

### Community 0 - "API Specification (Shared Contract)"
Cohesion: 0.06
Nodes (47): AGENTS.md Protocol, Asif (MdAsif-Hossain), Backend XREQ SLA (15-30 min), Backend Team Directives, Contributor Roster, CORS from First Commit, Full-Stack & BaaS / AI Directives, Minhaz (minuwu) (+39 more)

### Community 1 - "Repo Protocol & Onboarding"
Cohesion: 0.10
Nodes (39): Onboarding a New Contributor, Setup Scripts (scripts/setup.sh / setup.ps1), Entry 2026-11-14 evening: Repo Quality Pass, GET /api/health, Adding a Skill (team-wide), deploy-to-vercel skill (vercel-labs/agent-skills), fastapi skill (fastapi/fastapi), find-skills skill (vercel-labs/skills) (+31 more)

### Community 2 - "Contributor Roster & Work Logs"
Cohesion: 0.17
Nodes (19): Agent Entrypoint, Git Rules, Step 1: Load Matching Skill, Step 2: graphify Query First, Critical Directive for Coding Agents, find-skills (npx skills find/add), graphify Knowledge Graph (graphify-out/graph.json), Agent Pointer Files (CLAUDE.md, GEMINI.md, .cursor/rules, copilot-instructions) (+11 more)

### Community 3 - "CaseDetailModal.tsx"
Cohesion: 0.15
Nodes (36): App(), CaseDetailModal(), ExtractionReviewModal(), Navbar(), NavbarProps, Badge(), Button, ButtonProps (+28 more)

### Community 4 - "XREQ Queue Lifecycle"
Cohesion: 0.20
Nodes (15): Step 0: XREQ Queue Check, Recipient Agent Rules, [IN_PROGRESS], [PENDING], [RESOLVED], Step 0: Check the XREQ Queue, XREQ Lifecycle, XREQ Queue (Active Cross-Functional Request Queue) (+7 more)

### Community 5 - "Backend Directives & API Envelope"
Cohesion: 0.15
Nodes (13): 10. Open questions (decide at kickoff), 11. Changes this plan needs in API_SPEC, 1. The brief, in short, 2. Decisions, 3. Requirement → contract map, 4. Data model (Postgres), 5. Bank separation (judge question 1), 6. AI safety and failure plan (judge questions 2 and 3) (+5 more)

### Community 6 - "Contract-First Workflow"
Cohesion: 0.19
Nodes (14): Quick Rules of Engagement, Agents Follow the Protocol, Hour 0-1 API Contract (docs/API_SPEC.md), Simple Branch Strategy, Contract-First Development, Environment Variables (.env.example), Final Integration (toggle flip), Frontend Playbook (+6 more)

### Community 7 - "CI Branch Sync Workflow"
Cohesion: 0.12
Nodes (15): name, runs-on, steps, jobs, check-sync, name, on, pull_request (+7 more)

### Community 8 - "Asif's Work Log"
Cohesion: 0.05
Nodes (38): Anim's Work Log, Next, Blockers / handoff, Related issues / commits / PRs, Completed, 2026-11-13, 2026-11-14, 2026-11-14 (session 2) (+30 more)

### Community 9 - "Pre-Push Hook Script"
Cohesion: 0.20
Nodes (12): Frontend API Client (frontend/src/services/api.ts), Frontend Team Directives, No Silent Breaking Changes, Priority Levels P0/P1/P2, Requester Agent Rules, [VERIFIED_AND_CLOSED], USE_MOCK Toggle, Breaking Change Protocol (+4 more)

### Community 10 - "Setup Script (sh)"
Cohesion: 0.23
Nodes (14): Completed & Archived Requests Log, Archiving to Section 7, AGENTS.md Cross-Functional Team Protocol, Merge-Conflict Prevention, Pre-Push Sync Hook (.githooks/pre-push), XREQ-000 Initial Bootstrap, Entry 2026-11-14: Protocol Authored, AGENTS.md as Primary File (+6 more)

### Community 18 - "7. Testing"
Cohesion: 0.05
Nodes (40): 10. Contract changes for v0.4.0 (Asif), 1.1 Areas, 1.2 Files (who may edit what), 1. Who does what, 2. Phases and timeline, 3.1 Tools, 3.2 Dev database, 3.3 First run (+32 more)

### Community 19 - "package.json"
Cohesion: 0.07
Nodes (36): dependencies, clsx@^2.1.1, lucide-react@^0.475.0, react@^18.3.1, react-dom@^18.3.1, tailwind-merge@^3.0.1, tailwindcss@^4.0.9, @tailwindcss/vite@^4.0.9 (+28 more)

### Community 20 - "services/api.ts"
Cohesion: 0.09
Nodes (28): API_BASE_URL, memoryAuditLogs, memoryCases, memoryChatThreads, memoryExtractions, memoryKbDocuments, memoryReviewQueue, USE_MOCK (+20 more)

### Community 21 - "Hackathon 1: Shared Operations for Safer Banking"
Cohesion: 0.06
Nodes (32): 10. Suggested team roles (5 people), 11. Checkpoints (be honest with yourselves), 12. What you must deliver, 13. How you are judged (100 points), 14. Questions the judges may ask (prepare answers), 15. Common mistakes to avoid, 16. Simple words glossary, 17. What to send back after the 2 days (+24 more)

### Community 22 - "types/api.ts"
Cohesion: 0.08
Nodes (25): BadgeProps, AnswerType, ApiErrorResponse, ApiResult, AuditAction, CaseFlags, ChatRole, Citation (+17 more)

### Community 23 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleDetection (+12 more)

### Community 24 - "Suggestions for the AI module, from the backend team"
Cohesion: 0.13
Nodes (15): 1. Who owns what, 2. Document extraction (API_SPEC §7.1), 3. Case assistant (API_SPEC §3.6, §7.2), 4. Cost and abuse, 5. What backend does when your function fails, 6. Open questions for you, 7. Suggested order, `answer()`: rules for the prompt (+7 more)

### Community 25 - "Git Rules for Agents"
Cohesion: 0.20
Nodes (11): AI / LLM Team Directives, Branch Convention <name>/<topic>, Conventional Commits, Creating an XREQ Request, Secrets Rule (.env never committed, .env.example current), Git Rules for Agents, Prompts Directory (backend/app/prompts/), Shared Types (shared/types/) (+3 more)

### Community 26 - "useCaseStore.ts"
Cohesion: 0.43
Nodes (7): CaseDetailModalProps, CaseFilters, CaseState, Case, CaseStatus, CaseSummary, ClosureReason

### Community 27 - "useAuthStore.ts"
Cohesion: 0.40
Nodes (5): getAuthToken(), getStoredUser(), request(), AuthState, User

### Community 28 - "Extraction"
Cohesion: 0.50
Nodes (4): ExtractionReviewModalProps, ReviewQueueState, Extraction, ReviewQueueItem

### Community 29 - "useVictimSessionStore.ts"
Cohesion: 0.83
Nodes (3): VictimSessionState, ChatThread, VictimCase

### Community 30 - "BJET-Hackathon Monorepo"
Cohesion: 1.00
Nodes (3): BJET-Hackathon Monorepo, Repository Layout, Setup Scripts (scripts/setup.sh|.ps1)

## Ambiguous Edges - Review These
- `POST /api/auth/login` → `Standard Response Envelope`  [AMBIGUOUS]
  docs/API_SPEC.md · relation: conceptually_related_to

## Knowledge Gaps
- **17 isolated node(s):** `Local Skills (project-specific)`, `Entry Sections (Completed / Next / Blockers / Related)`, `Prompts Directory (backend/app/prompts/)`, `SSE Chunk Format Declaration`, `Backend XREQ SLA (15-30 min)` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 218 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Backend, Database & DevOps Plan — Fraud Relief Case System` connect `Backend Directives & API Envelope` to `API Specification (Shared Contract)`?**
  _High betweenness centrality (0.348) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Routing Table` (e.g. with `Backend Team Directives` and `Frontend Team Directives`) actually correct?**
  _`Routing Table` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Local Skills (project-specific)`, `Entry Sections (Completed / Next / Blockers / Related)`, `Prompts Directory (backend/app/prompts/)` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Specification (Shared Contract)` be split into smaller, more focused modules?**
  _Cohesion score 0.05656565656565657 - nodes in this community are weakly interconnected._
- **Why does `3. Requirement → contract map` connect `Backend Directives & API Envelope` to `useCaseStore.ts`?**
  _High betweenness centrality (0.324) - this node is a cross-community bridge._
- **Should `Repo Protocol & Onboarding` be split into smaller, more focused modules?**
  _Cohesion score 0.1039136302294197 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `POST /api/auth/login` and `Standard Response Envelope`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._