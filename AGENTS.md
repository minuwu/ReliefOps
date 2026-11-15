# AGENTS.md — Cross-Functional Team Protocol & Coding Agent Instructions

> **CRITICAL DIRECTIVE FOR ALL CODING AGENTS (Claude Code, Cursor, Antigravity, Copilot, Gemini CLI, Codex):**
> Whenever you start or resume work in this repository:
> - **STEP 0** — Read Section 2 ("Active Cross-Functional Request Queue"). If a request assigned to your team or contributor is `[PENDING]`, **suspend all backlog work and fulfill it first**.
> - **STEP 1** — **Pre-Flight Arming Hook (MANDATORY)**:
>   - **1A. Grill Me / Align**: Proactively interview the user (`/grill-me` or `ask_question`) to clarify ambiguous requirements, constraints, and edge cases before coding.
>   - **1B. Skill Discovery & Activation**: Check `.claude/skills/` (see Section 3.3 and [docs/SKILLS.md](docs/SKILLS.md)), find missing skills (`npx skills find "<topic>"`), and activate process skills (`superpowers`). Skills are mandatory.
>   - **1C. Web Search for Standards**: Run `search_web` to inspect official docs, modern API standards, and library best practices rather than relying on unverified assumptions.
> - **STEP 2** — For any question about this codebase, query the knowledge graph first: `graphify query "<question>"` (see Section 3.4).
>
> Cross-functional dependencies ALWAYS take precedence over isolated feature implementation.

---

## Table of Contents
1. [Overview & Operating Philosophy](#1-overview--operating-philosophy)
2. [Active Cross-Functional Request Queue (XREQ)](#2-active-cross-functional-request-queue-xreq)
3. [Coding Agent Operational Protocol](#3-coding-agent-operational-protocol)
   - [3.1 Step 0: XREQ Queue](#31-step-0--check-the-xreq-queue)
   - [3.2 Rules for Recipient & Requester Agents](#32-rules-for-recipient--requester-agents)
   - [3.3 Step 1: Mandatory Skills](#33-step-1--load-the-matching-skill-mandatory)
   - [3.4 Step 2: Knowledge Graph (graphify)](#34-step-2--query-the-knowledge-graph-first)
   - [3.5 Git Rules for Agents](#35-git-rules-for-agents)
4. [Per-Team Instructions & Contracts](#4-per-team-instructions--contracts)
5. [Per-Contributor Registry & Instructions](#5-per-contributor-registry--instructions)
6. [File Management & Maintenance Manual](#6-file-management--maintenance-manual)
7. [Completed & Archived Requests Log](#7-completed--archived-requests-log)

---

## 1. Overview & Operating Philosophy

In hackathons, velocity dies from **unresolved cross-team dependencies**. When Frontend waits on a Backend endpoint, or Backend changes a payload without telling Frontend, both stall and integration fails.

This file is:
1. **The Machine-Readable Dispatch Board** — coding agents parse it to find urgent tasks requested by partner teams.
2. **The Bidirectional Contract Ledger** — one place to declare requested schemas, endpoints, mocks, and response shapes.
3. **The Team Operating Standard** — per-team and per-contributor rules that keep branches synced and work unblocked.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BIDIRECTIONAL WORKFLOW ENGINE                         │
│                                                                             │
│   Frontend Needs API ───► Creates [XREQ] ───► Backend Agent Discovers       │
│                                               │ (Maximum Priority)          │
│                                               ▼                             │
│   Frontend Unblocked ◄─── Marks [RESOLVED] ◄── Implements & Verifies        │
│   (Switches Mock)         with Contract Spec                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Active Cross-Functional Request Queue (XREQ)

*Coding Agents: read this table first. If any request targeting your team is `[PENDING]`, start on it immediately.*

### 2.1 Active Queue Summary

| Request ID | Priority | From | To | Target / Title | Status | Updated (UTC+6) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `XREQ-001` | `P0 (Blocker)` | Frontend (Minhaz) | Backend (Asif / Anim) | Core Cases & Bank Tenant Isolation API (`GET/POST /api/cases`) | `[IN_PROGRESS]` | 2026-11-15 13:30 |
| `XREQ-002` | `P0 (Blocker)` | Frontend (Minhaz) | AI (Galib) / Backend (Asif) | Rule D3 Vision OCR Extraction & HITL Queue (`POST /api/documents/extract`) | `[IN_PROGRESS]` | 2026-11-15 11:30 |
| `XREQ-003` | `P1 (High)` | Frontend (Minhaz) | Backend (Anim / Asif) | Public Citizen Intake & 6-Stage Status Tracker (`POST /api/intake`) | `[PENDING]` | 2026-11-15 11:30 |
| `XREQ-004` | `P1 (High)` | Frontend (Minhaz) | Backend (Asif / Anim) / AI (Galib) | Cross-Bank Fraud Ring Topology & Coordinated Freeze API | `[PENDING]` | 2026-11-15 11:30 |

*(When adding a request: append a row above AND add a detailed card in 2.2. Never insert in the middle.)*

---

### 2.2 Detailed Request Cards

#### `[XREQ-001]` Core Case Workstation & Bank Tenant Isolation API
- **Priority**: `P0 (Blocker)`
- **From**: Frontend (Minhaz)
- **To**: Backend (Asif / Anim)
- **Status**: `[IN_PROGRESS]` (Asif: database bank isolation, migrations 001–002; Anim: the case endpoints)
- **Created**: 2026-11-15 11:30 (UTC+6)
- **Target Interface / Endpoints**: `GET /api/cases`, `GET /api/cases/{id}`, `POST /api/cases/{id}/transitions`

**Requirement Details:**
Frontend workstation and case details are fully built, responsive, and running on mock contracts. For ReliefOps to operate as a live real-world solution, we need live FastAPI endpoints hooked to the database.
1. `GET /api/cases` must support filtering by `status`, `bank_id`, `deadline_state` (`on_track`, `due_soon`, `overdue`), and text search.
2. `GET /api/cases/{id}` must return full case facts, victim info, suspect account details, attached documents, allowed status transitions, and audit trail.
3. `POST /api/cases/{id}/transitions` must validate and advance the 6-stage lifecycle (`received` -> `verified` -> `account_check` -> `notice_published` -> `payout_review` -> `closed`).
4. **CRITICAL TENANT PRIVACY RULE (D1 / Banking Secrecy):** When authenticated as a `bank_viewer` (e.g. `viewer@bank-b.test`), the query MUST strictly return ONLY `bank_b` cases. Requesting a case belonging to another bank must return `404 RESOURCE_NOT_FOUND` (never 403, to prevent existence snooping).

**Expected Request (`POST /api/cases/{id}/transitions`):**
```json
{
  "to_status": "account_check",
  "reason": "Voucher optical check verified by operator",
  "expected_version": 1
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "c0000000-0000-4000-8000-000000000042",
    "reference": "RFR-2026-00042",
    "status": "account_check",
    "version": 2,
    "updated_at": "2026-11-15T11:30:00Z"
  },
  "message": "Case transitioned successfully"
}
```

**Fulfillment & Proof (filled by recipient on completion):**
- **Branch / Commit**: `[branch-name or commit-hash]`
- **Status / Notes**: `[Implemented route / schema / component]`
- **Verification Proof**: `[curl command, Swagger link, or test output]`

---

#### `[XREQ-002]` Rule D3 Vision OCR Extraction & HITL Queue
- **Priority**: `P0 (Blocker)`
- **From**: Frontend & Architecture (Minhaz)
- **To**: AI (Galib) / Backend (Asif)
- **Status**: `[IN_PROGRESS]`
- **Created**: 2026-11-15 11:30 (UTC+6)
- **Target Interface / Endpoints**: `POST /api/documents/{id}/extract`, `GET /api/review-queue`, `POST /api/cases/{case_id}/extractions/{extraction_id}/accept`

**Requirement Details:**
Statutory Rule D3 dictates that AI is strictly an assistive advisor: **AI model output can NEVER directly modify bank ledgers or relief claims without certified human operator verification.**
1. AI vision service must extract key fields from Japanese Furikomi vouchers / ATM slips, using the `ExtractableField` names from `docs/API_SPEC.md` §3.4: `amount`, `currency`, `transfer_date`, `account_number`, `account_holder_name` (the payee). Bank and branch are not extractable fields; the case's `bank_id` already sets the bank. The AI function is `extract_fields()` in `backend/app/services/ai_extraction.py` (Galib, API_SPEC §7.1); the caller with timeout and fallback is `backend/app/services/extraction.py` (Asif).
2. Must calculate granular field confidence scores (0.00 to 1.00). Aggregate confidence < 0.85 automatically routes the document into the `low_confidence` review lane.
3. Must implement a **deterministic fallback** (`source: "rules_fallback"`) when Gemini API / vision model is offline or times out, ensuring the system never crashes or halts during live judging.
4. Human operator certification endpoint `POST /api/cases/{case_id}/extractions/{extraction_id}/accept` commits human-verified values to the case record and logs an immutable audit event.

**Expected Response (`GET /api/review-queue`):**
```json
{
  "success": true,
  "data": [
    {
      "extraction_id": "ext-2026-0089",
      "case_id": "c0000000-0000-4000-8000-000000000042",
      "case_reference": "RFR-2026-00042",
      "document_filename": "ATM_Transfer_Slip_Tanaka.jpg",
      "review_lane": "low_confidence",
      "overall_confidence": 0.68,
      "fields": {
        "amount": { "value": 1450000, "confidence": 0.98 },
        "account_number": { "value": "9876543210", "confidence": 0.68 }
      }
    }
  ]
}
```

**Fulfillment & Proof:**
- **Branch / Commit**: `[branch-name or commit-hash]`
- **Status / Notes**: `[Implemented route / schema / component]`
- **Verification Proof**: `[curl command, Swagger link, or test output]`

---

#### `[XREQ-003]` Public Citizen Intake & 6-Stage Progress Tracker
- **Priority**: `P1 (High)`
- **From**: Frontend (Minhaz)
- **To**: Backend (Anim / Asif)
- **Status**: `[PENDING]`
- **Created**: 2026-11-15 11:30 (UTC+6)
- **Target Interface / Endpoints**: `POST /api/intake`, `POST /api/victim/auth`, `GET /api/victim/cases/{reference}`, `POST /api/victim/chat`

**Requirement Details:**
Allows scam victims to report losses via the public web form without prior registration:
1. `POST /api/intake` creates a case with status `received`, generating a human-readable `reference` (`RFR-2026-XXXXX`) and an encrypted 12-character `access_code`.
2. `POST /api/victim/auth` authenticates the victim using their reference + access code.
3. `GET /api/victim/cases/{reference}` returns citizen-safe claim data: 6-stage lifecycle status (`received`, `verified`, `account_check`, `notice_published`, `payout_review`, `closed`), destination bank name, and frozen restitution pool balance.
4. `POST /api/victim/chat` provides two-way messaging between the victim and assigned operations center staff.

**Expected Request (`POST /api/intake`):**
```json
{
  "bank_id": "bank_b",
  "victim_name": "Haruto Tanaka",
  "victim_phone": "090-0000-1122",
  "victim_email": "h.tanaka@example.jp",
  "amount": 1450000,
  "currency": "JPY",
  "transfer_date": "2026-11-10",
  "account_number": "9876543210",
  "scam_type": "impersonation",
  "description": "Pension imposter phone scam requesting escrow transfer"
}
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "case_id": "c0000000-0000-4000-8000-000000000042",
    "reference": "RFR-2026-00042",
    "access_code": "K7QM-4XHP-2RTV",
    "status": "received"
  },
  "message": "Intake report submitted successfully"
}
```

**Fulfillment & Proof:**
- **Branch / Commit**: `[branch-name or commit-hash]`
- **Status / Notes**: `[Implemented route / schema / component]`
- **Verification Proof**: `[curl command, Swagger link, or test output]`

---

#### `[XREQ-004]` Cross-Bank Fraud Ring Topology & Coordinated Freeze API
- **Priority**: `P1 (High)`
- **From**: Frontend & Supervisor (Minhaz)
- **To**: Backend (Asif / Anim) / AI (Galib)
- **Status**: `[PENDING]`
- **Created**: 2026-11-15 11:30 (UTC+6)
- **Target Interface / Endpoints**: `GET /api/analytics/fraud-rings`, `POST /api/analytics/fraud-rings/{account_number}/freeze`

**Requirement Details:**
Provides the showstopper feature for hackathon judging: uncovering organized criminal syndicates operating across member bank walls.
1. `GET /api/analytics/fraud-rings` analyzes destination accounts and flags any account appearing in claims across >1 bank (e.g. account `9876543210` receiving illicit funds from Birch Bank and Aster Bank victims).
2. Returns graph topology structure: root account node, connected bank nodes, linked victim case nodes, total illicit flow (JPY), and active threat level.
3. `POST /api/analytics/fraud-rings/{account_number}/freeze` simulates an emergency broadcast freezing that mule account across all member institutions simultaneously.

**Expected Response (`GET /api/analytics/fraud-rings`):**
```json
{
  "success": true,
  "data": [
    {
      "account_number": "9876543210",
      "holder_name": "GLOBAL ASSET TRUST",
      "case_count": 2,
      "total_amount": 2900000,
      "banks_involved": ["bank_a", "bank_b"],
      "threat_level": "CRITICAL_SYNDICATE",
      "is_frozen": false,
      "cases": [
        { "id": "c0000000-0000-4000-8000-000000000042", "reference": "RFR-2026-00042", "bank_id": "bank_b", "amount": 1450000 },
        { "id": "c0000000-0000-4000-8000-000000000055", "reference": "RFR-2026-00055", "bank_id": "bank_a", "amount": 1450000 }
      ]
    }
  ]
}
```

**Fulfillment & Proof:**
- **Branch / Commit**: `[branch-name or commit-hash]`
- **Status / Notes**: `[Implemented route / schema / component]`
- **Verification Proof**: `[curl command, Swagger link, or test output]`

---

### 2.3 Blank XREQ Template (copy & paste)

```markdown
#### `[XREQ-00X]` [Brief Actionable Title: e.g., POST /api/items Endpoint]
- **Priority**: `[P0 (Blocker) | P1 (High) | P2 (Normal)]`
- **From**: `[Frontend / Backend / AI] ([Contributor Name])`
- **To**: `[Backend / Frontend / AI] ([Contributor Name / Any])`
- **Status**: `[PENDING]`
- **Created**: `YYYY-MM-DD HH:MM (UTC+6)`
- **Target Interface / Endpoint**: `[e.g., POST /api/analyze or UI Error Toast]`

**Requirement Details:**
[Why this is needed, what feature it enables, expected behavior.]

**Expected Request (Payload / Query Params / Headers):**
```json
{ "field": "value" }
```

**Expected Response (Status Code + Payload / Error Codes):**
```json
{ "success": true, "data": {} }
```

**Fulfillment & Proof (filled by recipient on completion):**
- **Branch / Commit**: `[branch-name or commit-hash]`
- **Status / Notes**: `[Implemented route / schema / component]`
- **Verification Proof**: `[curl command, Swagger link, or test output]`
```

### 2.4 Worked Example (illustrative only — not a real request)

```markdown
#### `[XREQ-EXAMPLE]` POST /api/auth/login
- **Priority**: `P0 (Blocker)`
- **From**: Frontend (Minhaz)
- **To**: Backend (Asif)
- **Status**: `[RESOLVED]`
- **Created**: 2026-11-14 18:00 (UTC+6)
- **Target Endpoint**: `POST /api/auth/login`

**Requirement Details:** Navbar + session state need a login endpoint returning a token and user object.

**Expected Request:** `{ "email": "user@example.com", "password": "secret" }`
**Expected Response (200):** `{ "success": true, "data": { "token": "jwt", "user": { "id": "usr_101", "name": "Minhaz", "email": "user@example.com", "role": "admin" } } }`

**Fulfillment & Proof:**
- **Branch / Commit**: `asif/auth-login` (`<commit-hash>`)
- **Status / Notes**: Route live with JWT; persistence stubbed.
- **Verification Proof**: `curl -X POST localhost:8000/api/auth/login -d '{...}'` returns 200 matching schema; visible at `http://localhost:8000/docs`.
```

---

## 3. Coding Agent Operational Protocol

```mermaid
flowchart TD
    Start(["Agent Initiated"]) --> Step0["Step 0: Read AGENTS.md Section 2"]
    Step0 --> CheckQueue{"Any PENDING request<br/>for my team?"}
    CheckQueue -- YES --> Claim["Mark IN_PROGRESS"]
    Claim --> Skill1["Step 1: Load matching skill"]
    Skill1 --> Implement["Implement endpoint / model / UI"]
    Implement --> Verify["Verify: test or curl"]
    Verify --> Document["Fill Fulfillment, mark RESOLVED"]
    Document --> Commit["Commit: fix: fulfill XREQ-XXX"]
    Commit --> Backlog["Resume backlog"]
    CheckQueue -- NO --> Skill2["Step 1: Load matching skill"]
    Skill2 --> Graph["Step 2: graphify query for context"]
    Graph --> ReadLog["Read contributor WORK_LOG.md + task"]
    ReadLog --> Work["Execute planned work"]
```

### 3.1 Step 0 — Check the XREQ Queue
1. Open Section 2.1. Filter rows where `To` matches your team or contributor.
2. Any `[PENDING]` row → change it to `[IN_PROGRESS]`, commit, then implement.
3. Only when the queue is clear for your team may you touch backlog work.

### 3.2 Rules for Recipient & Requester Agents

**Recipient (fulfilling):**
1. **Never ignore `[PENDING]`.** If Frontend logged an `XREQ` for an endpoint, that endpoint is Job #1.
2. **Speed over perfection.** If persistence isn't ready, **return mock data matching the contract immediately**, then wire real logic. Unblock the partner in minutes.
3. **Document proof.** Never mark `[RESOLVED]` without branch/commit + verification snippet.

**Requester (submitting):**
1. **Never guess field names.** Log an `XREQ` with the exact JSON you need.
2. **Provide a fallback mock immediately** behind the `USE_MOCK` toggle (Section 4.1) so your side keeps moving.
3. **Verify and close.** When `[RESOLVED]`, test the live endpoint, switch mock off, mark `[VERIFIED_AND_CLOSED]`.

### 3.3 Step 1 — Load the Matching Skill (MANDATORY)

Skills live in [`.claude/skills/`](.claude/skills/), committed to this repo so every teammate and every agent has the same set. Full catalog and routing table: **[docs/SKILLS.md](docs/SKILLS.md)**.

Rules:
1. **Before writing code in a domain, read that domain's `SKILL.md` end to end.** Routing: React/Next.js → `vercel-react-best-practices` + `nextjs-app-router-patterns`; UI/styling → `frontend-design` + `tailwind-v4-shadcn`; FastAPI/Python → `fastapi` + `python-testing-patterns`; DB → `supabase-postgres-best-practices` (+ `supabase` or `prisma-orm-setup`); API contract → `openapi-spec-generation`; git → `git-workflow-and-versioning`; deploy → `deploy-to-vercel`.
2. **Claude Code** auto-discovers `.claude/skills/`. **Every other agent** (Cursor, Copilot, Gemini CLI, Antigravity, Codex) must open `.claude/skills/<name>/SKILL.md` with its file tool and follow it. Pointer files exist at [`CLAUDE.md`](CLAUDE.md), [`GEMINI.md`](GEMINI.md), [`.cursor/rules/`](.cursor/rules/), and [`.github/copilot-instructions.md`](.github/copilot-instructions.md).
3. **Need a skill that isn't here?** Use `find-skills`: `npx skills find "<topic>"`, then install into the repo with `npx skills add <owner/repo@skill> -a claude-code --copy -y`, add a row to `docs/SKILLS.md`, and commit. Never install only globally — the team won't get it.
4. **Never commit code that contradicts a loaded skill** without noting why in the PR body.
5. **ECC workflow layer (Claude Code).** `scripts/setup` installs [ECC](docs/SKILLS.md#6-ecc-everything-claude-code--workflow-harness) per machine: workflow skills (`tdd-workflow`, `verification-loop`, `e2e-testing`, …), reviewer subagents (`fastapi-reviewer`, `react-reviewer`, `security-reviewer`, …), `/plan` `/code-review` `/learn` commands, rules and hooks. Use `/plan` before multi-file work and `verification-loop` before marking an `XREQ` `[RESOLVED]`. Where ECC rules and this file disagree, this file wins. Never commit ECC-managed files (they are gitignored).

### 3.4 Step 2 — Query the Knowledge Graph First

`graphify-out/` is the local knowledge graph of this repo (untracked in git to prevent sync noise).
- Codebase question → `graphify query "<question>"` before any grep/glob/read.
- Relationship → `graphify path "A" "B"`. One concept → `graphify explain "X"`.
- Broad architecture review only → read `graphify-out/GRAPH_REPORT.md`.
- **After changing code** → `graphify update .` (local AST update, free). **After changing docs** → `/graphify . --update`.
- `graphify` missing → `pip install graphifyy`, or `python -m graphify`.

### 3.5 Git Rules for Agents
- **Branch**: `<name>/<short-topic>` (e.g. `minhaz/dashboard-ui`, `asif/auth-login`). Direct pushes to `main` are allowed **only after `git pull origin main`**; the pre-push hook rejects a push that is missing remote commits.
- **Merge**: small, safe changes may go straight to `main` after pulling. Anything that touches another team's area, the API contract, or shared config goes through a PR with one teammate's approval. Keep PRs small (< 400 lines when possible).
- **Commit messages**: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore(xreq):`). No AI/tool attribution trailers.
- **Sync**: the pre-push hook ([`.githooks/pre-push`](.githooks/pre-push)) fetches and merges `origin/main` before every push. It is enabled by `scripts/setup.sh` / `scripts/setup.ps1`. Commit or stash before pushing — the hook merges and will refuse a dirty tree.
- **Secrets**: never commit `.env`. Keep `.env.example` current in `frontend/` and `backend/`.

---

## 4. Per-Team Instructions & Contracts

### 4.1 Frontend Team Directives
- **Mission**: responsive, intuitive, error-resilient UI for every target user journey.
- **Skills**: `vercel-react-best-practices`, `nextjs-app-router-patterns`, `frontend-design`, `tailwind-v4-shadcn`.
- **Contract-First**:
  - API client in one place, e.g. `frontend/src/services/api.ts`.
  - Mock toggle driven by env, default ON until integration:
    ```ts
    const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') === 'true';
    ```
    (Next.js: `process.env.NEXT_PUBLIC_USE_MOCK`.)
  - Mocks mirror [docs/API_SPEC.md](docs/API_SPEC.md) or the open `XREQ` exactly.
- **Requesting from Backend**: file an `XREQ` with request + response JSON, including error states (400/401/404/500). Don't break existing components while waiting.
- **UI states**: always handle loading, empty, and error (skeletons, toasts).

### 4.2 Backend Team Directives
- **Mission**: fast, documented, reliable REST/SSE endpoints and business logic.
- **Skills**: `fastapi`, `python-testing-patterns`, `supabase-postgres-best-practices`, `openapi-spec-generation`.
- **SLA**: acknowledge an `XREQ` and ship a mock or live response within 15–30 minutes.
- **CORS**: allow `*` or `localhost:<port>` in dev from the first commit.
- **Docs**: every endpoint visible in Swagger (`/docs`, `/openapi.json`).
- **Envelope**: every response uses the envelope in `docs/API_SPEC.md` §1.
- **No silent breaking changes**: never rename/remove a response key without a `P0` `XREQ` to Frontend.

### 4.3 AI / LLM Team Directives
- **Mission**: the model-powered feature that wins the demo. Ship a deterministic fallback for every AI call so the demo never hangs.
- **Streaming**: if using SSE, declare the chunk format (e.g. `data: {"text": "chunk"}\n\n`) in the `XREQ`.
- **Prompts** live in `backend/app/prompts/` (or equivalent), versioned in git, never inline in route handlers.
- **Keys**: `.env` only; `.env.example` lists every variable with a dummy value.
- **Shared types**: if TypeScript is used on both sides, keep shared interfaces in `shared/types/` or mirror them in `docs/API_SPEC.md`.

---

## 5. Per-Contributor Registry & Instructions

### 5.1 Contributor Roster

| Contributor | GitHub Handle | Primary Focus | Branch Prefix | Work Log |
| :--- | :--- | :--- | :--- | :--- |
| **Minhaz** | `minuwu` | Frontend / Full-Stack / Architecture | `minhaz/*` | [contributors/minhaz/WORK_LOG.md](contributors/minhaz/WORK_LOG.md) |
| **Asif** | `MdAsif-Hossain` | Backend / Services / Database | `asif/*` | [contributors/asif/WORK_LOG.md](contributors/asif/WORK_LOG.md) |
| **Anim** | `anim710` | Backend / Services / Database | `anim/*` | [contributors/anim/WORK_LOG.md](contributors/anim/WORK_LOG.md) |
| **Galib** | `Ga-lib` | AI / LLM | `galib/*` | [contributors/galib/WORK_LOG.md](contributors/galib/WORK_LOG.md) |
| *(Next Teammate)* | *TBD* | *Assigned Role* | `<name>/*` | `contributors/<name>/WORK_LOG.md` |

Per-person setup checklists are in [TEAM_INSTRUCTIONS.md](TEAM_INSTRUCTIONS.md).

### 5.2 Minhaz
- **Role**: lead architecture, Frontend / Full-Stack integration, repo hygiene.
- **Branches**: `minhaz/<topic>`; `minhaz` (legacy long-lived branch) merges to `main` via PR.
- **Agent instructions in Minhaz's workspace**: fulfil `XREQ`s where `To: Frontend` or `To: Minhaz`; load Frontend skills (4.1); keep `AGENTS.md` and `docs/SKILLS.md` current.

### 5.3 Asif
- **Role**: Backend engineering, data models, API integrations.
- **Branches**: `asif/<topic>`; PR to `main`, or direct push to `main` after pulling.
- **Agent instructions in Asif's workspace**: fulfil `XREQ`s where `To: Backend` or `To: Asif`; load Backend skills (4.2); keep Swagger `/docs` and `docs/API_SPEC.md` in sync before committing.

### 5.4 Anim
- **Role**: Backend engineering alongside Asif: services, data models, API integrations.
- **Branches**: `anim/<topic>`; PR to `main`, or direct push to `main` after pulling.
- **Agent instructions in Anim's workspace**: fulfil `XREQ`s where `To: Backend` or `To: Anim`; load Backend skills (4.2); coordinate with Asif on shared `backend/` files and keep `docs/API_SPEC.md` in sync before committing.

### 5.5 Galib
- **Role**: AI / LLM engineering: model-powered features, prompts, deterministic fallbacks (Section 4.3).
- **Branches**: `galib/<topic>`; PR to `main`, or direct push to `main` after pulling.
- **Agent instructions in Galib's workspace**: fulfil `XREQ`s where `To: AI` or `To: Galib`; follow AI directives (4.3) and load Backend skills (`fastapi`, `python-testing-patterns`) for code in `backend/`; coordinate with Asif and Anim on shared `backend/` files and declare any SSE chunk format in an `XREQ`.

### 5.6 Onboarding a New Contributor (2 minutes)
1. Add a row to 5.1 and a short 5.x section (role, branch prefix, agent instructions).
2. `cp -r contributors/_template contributors/<name>` and fill the header.
3. Run `scripts/setup.sh` (or `scripts/setup.ps1` on Windows).
4. Add a row to [TEAM_INSTRUCTIONS.md](TEAM_INSTRUCTIONS.md) per-person table.

---

## 6. File Management & Maintenance Manual

### 6.1 Why This File Exists
Single source of truth for: humans coordinating asynchronously; agents discovering blockers without being prompted; Frontend/Backend/AI sharing one contract.

### 6.2 Creating a Request
1. Anyone (human or agent) can create one.
2. Next sequential ID: `XREQ-001`, `XREQ-002`, …
3. Fill the template (2.3), add the card to 2.2 and a row to 2.1.
4. Commit: `git commit -m "chore(xreq): add XREQ-00X for <endpoint/feature>"` and push.

### 6.3 Lifecycle
```
[PENDING] ───► [IN_PROGRESS] ───► [RESOLVED] ───► [VERIFIED_AND_CLOSED] ───► archived (Section 7)
```
- `[PENDING]` logged, waiting for recipient.
- `[IN_PROGRESS]` recipient claimed it.
- `[RESOLVED]` implemented, verified, committed; Fulfillment block complete.
- `[VERIFIED_AND_CLOSED]` requester tested integration and closed it.

### 6.4 Merge-Conflict Prevention
1. **Append only** at the bottom of the active list.
2. **Atomic edits**: change only the one card and row you own.
3. **Pre-push sync** hook stays enabled.

### 6.5 Archiving
Move `[VERIFIED_AND_CLOSED]` requests to Section 7 during cleanups. Keep the active queue under 10 items.

---

## 7. Completed & Archived Requests Log

*Historical log. Do not delete.*

| Request ID | Finished | From | To | Summary | Final Commit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `XREQ-000` | 2026-11-13 | Team | Repository | Initial bootstrap, git hooks, protocol docs | `4619a87` |

---
*End of AGENTS.md. Keep this file current every sprint.*
