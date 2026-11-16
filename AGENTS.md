# AGENTS.md — Cross-Functional Team Protocol & Coding Agent Instructions

> **CRITICAL DIRECTIVE FOR ALL CODING AGENTS (Claude Code, Cursor, Antigravity, Copilot, Gemini CLI, Codex):**
> Whenever you start or resume work in this repository:
> - **STEP 0** — Read Section 2 ("Active Cross-Functional Request Queue"). If a request assigned to your team or contributor is `[PENDING]`, **suspend all backlog work and fulfill it first**.
> - **STEP 1** — **Pre-Flight Arming Hook (MANDATORY)**:
>   - **1A. Grill Me / Align**: Proactively interview the user (`/grill-me` or `ask_question`) to clarify ambiguous requirements, constraints, and edge cases before coding.
>   - **1B. Skill Discovery & Activation**: Check `.claude/skills/` (see Section 3.3 and [docs/SKILLS.md](docs/SKILLS.md)), find missing skills (`npx skills find "<topic>"`), and activate process skills (`superpowers`). Skills are mandatory.
>   - **1C. Web Search for Standards**: Run `search_web` to inspect official docs, modern API standards, and library best practices rather than relying on unverified assumptions.
> - **STEP 2** — For any question about this codebase, query the knowledge graph first: `graphify query "<question>"` (see Section 3.4).
> - **STEP 3 — Quality Bar (MANDATORY)** — Every change must satisfy [docs/ENGINEERING_GUIDELINES.md](docs/ENGINEERING_GUIDELINES.md) (checklist `G-01`…`G-52`, frontend + backend + AI). Turn every correction into a deterministic check, not another prose rule; keep the codebase free of slop; attach verification evidence. Walk the boxes for the areas you touched before any PR or `[RESOLVED]` (see Section 3.6).
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
   - [3.6 Quality Bar: Engineering Guidelines](#36-quality-bar--engineering-guidelines)
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
| `XREQ-001` | `P0 (Blocker)` | Frontend (Minhaz) | Backend (Asif / Anim) | Core Cases & Bank Tenant Isolation API (`GET/POST /api/cases`, `POST /api/cases/{case_id}/transition`) | `[RESOLVED]` | 2026-11-15 22:30 (path agreed: `/transition`) |
| `XREQ-002` | `P0 (Blocker)` | Frontend (Minhaz) | AI (Galib) / Backend (Asif) | Rule D3 Vision OCR Extraction & HITL Queue (`POST /api/documents/{id}/extract`, `POST /api/extractions/{id}/review`) | `[RESOLVED]` | 2026-11-15 22:15 (all routes live) |
| `XREQ-003` | `P1 (High)` | Frontend (Minhaz) | Backend (Anim / Asif) | Victim accounts, case reports & 6-Stage Status Tracker (`POST /api/victim/cases`) | `[RESOLVED]` | 2026-11-15 22:15 (victim accounts + routes live) |
| `XREQ-004` | `P1 (High)` | Frontend (Minhaz) | Backend (Asif / Anim) / AI (Galib) | Cross-Bank Shared Accounts (`GET /api/alerts/shared-accounts`); freeze needs a team decision | `[IN_PROGRESS]` | 2026-11-15 20:10 (detection done, freeze not agreed) |
| `XREQ-005` | `P1 (High)` | Frontend (Minhaz) | Backend (Anim / Asif) | All 48 v0.4.2 routes mounted; the 3 contract deviations closed (contract v0.4.3) | `[RESOLVED]` | 2026-11-15 22:15 (48/48 routes, v0.4.3) |
| `XREQ-006` | `P0 (Blocker)` | Frontend (Minhaz) | Backend (Asif / Anim) / AI (Galib) | Deploy backend + database + AI to the cloud, post the public HTTPS API URL, allow the frontend origin (CORS) | `[VERIFIED_AND_CLOSED]` | 2026-11-16 23:58 (closed through XREQ-007; API on Azure VM) |
| `XREQ-007` | `P0 (Blocker)` | Frontend (Minhaz) | Backend (Asif / Anim) / AI (Galib) | Free always-on deploy: verify, then implement [docs/DEPLOY-FREE.md](docs/DEPLOY-FREE.md) (Azure for Students VM + Supabase + Firebase), post `API_URL` | `[VERIFIED_AND_CLOSED]` | 2026-11-16 23:58 (frontend on `https://reliefops.web.app` now calls `https://reliefops-api.japaneast.cloudapp.azure.com`, mock off, login verified) |

*(When adding a request: append a row above AND add a detailed card in 2.2. Never insert in the middle.)*

---

### 2.2 Detailed Request Cards

#### `[XREQ-001]` Core Case Workstation & Bank Tenant Isolation API
- **Priority**: `P0 (Blocker)`
- **From**: Frontend (Minhaz)
- **To**: Backend (Asif / Anim)
- **Status**: `[IN_PROGRESS]` (Asif: database bank isolation, migrations 001–002; Anim: the case endpoints)
- **Created**: 2026-11-15 11:30 (UTC+6)
- **Target Interface / Endpoints**: `GET /api/cases`, `GET /api/cases/{id}`, `POST /api/cases/{case_id}/transition`

**Contract reconciliation (Minhaz, 2026-11-15):** Agreed with the backend answer: the route is `/transition` (singular), and the frontend now calls it with `expected_version`. Bank separation is enforced by the database, and other banks' cases return `404`. The `/transitions` wording below is the original request.

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
- **Branch / Commit**: `main`. Anim: N1–N11 (`cb35243` app framework … `36c60cf` reads, N10 create/edit, N11 transition/assign). Asif: migrations 001–002 (bank isolation in the database).
- **Status / Notes**: **`[RESOLVED]`. Every case route is live on the real backend.** Use the contract's paths and payloads (v0.4.2), not this card's older ones:
  - **Routes:** `GET /api/cases` (filters `status` comma-separated, `bank_id` ignored for viewers, `assigned_to` `me`/`unassigned`/ID, `deadline_state`, `scam_type`, `q`, `sort`, `order`, `page`, `page_size`), `GET /api/cases/{id}`, `POST /api/cases` (phone or paper), `PATCH /api/cases/{id}`, **`POST /api/cases/{id}/transition`** (singular) and `POST /api/cases/{id}/assign`.
  - **Every write sends `expected_version`** (except assign); a stale one → `409 STALE_CASE` with `details.current_version`. Render buttons from `allowed_transitions` and `allowed_closure_reasons`.
  - **Errors:** `409 INVALID_STATUS_TRANSITION` `{from, to, allowed}`, `422 MISSING_REQUIRED_INFO` `{missing_fields}`, `409 CASE_CLOSED`, and `403` for money closures by an operator.
  - **Bank isolation:** `viewer@bank-b.test` sees only bank_b, and another bank's case returns `404 RESOURCE_NOT_FOUND` (never 403), enforced by Postgres RLS. Victims get `403` on staff routes.
- **Verification Proof**: `cd backend && uv run pytest tests/api`: test_cases_read (13), test_case_edits (12), test_case_moves (9) and test_contract (4) all pass, and every response is validated against `docs/openapi.yaml`. This includes the full received → paid_out lifecycle, the cross-bank 404, and two concurrent writes giving one `200` and one `409`. Locally: `uv run python -m app.seed`, `uv run fastapi dev`, log in as `operator1@opscenter.test` / `Demo@1234`. **Minhaz:** please test from the frontend and mark it `[VERIFIED_AND_CLOSED]`.
---

#### `[XREQ-002]` Rule D3 Vision OCR Extraction & HITL Queue
- **Priority**: `P0 (Blocker)`
- **From**: Frontend & Architecture (Minhaz)
- **To**: AI (Galib) / Backend (Asif)
- **Status**: `[RESOLVED]`
- **Created**: 2026-11-15 11:30 (UTC+6)
- **Target Interface / Endpoints**: `POST /api/documents/{id}/extract`, `GET /api/review-queue`, `POST /api/extractions/{id}/review`

**Contract reconciliation (Minhaz, 2026-11-15):** Agreed: accept and reject are one call, `POST /api/extractions/{id}/review` with `decision`. The frontend review queue uses it. The `.../accept` route in point 4 below is the original request.

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
- **Branch / Commit**: `main`. Asif `3c506a3` (routes on his services), Galib (AI extraction + rules fallback), Anim `869b477` (contract tests, v0.4.3).
- **Status / Notes**: **`[RESOLVED]`. Live:** `POST /api/cases/{id}/documents` (PDF, PNG, JPEG or TXT, checked from the bytes, at most 10 MB), `GET /api/documents/{id}/file`, `POST /api/documents/{id}/extract`, `GET /api/extractions/{id}`, `POST /api/extractions/{id}/review` (accept and reject in one call, with `decision` and `expected_version`), and `GET /api/review-queue` (low confidence first).
  - The AI only suggests (D3): an extraction is `pending_review`, and nothing reaches the case until a person accepts it.
  - With the AI off or down, extraction still answers `201`, with `source: "rules_fallback"` and the `low_confidence` lane. The threshold is the contract's 0.75, not the 0.85 in this card.
- **Verification Proof**: `uv run pytest tests/api/test_contract_routes.py` checks every response against `openapi.yaml`. `bash scripts/smoke.sh` runs paper case → upload → extraction → review → **Verified**: 39/39 directly and 39/39 through the Prism proxy with no violations.

**Status request (Minhaz, 2026-11-15 14:49):** None of the document, extraction or review-queue routes are mounted yet. The frontend upload, extract and review screens are built against the contract. Galib / Asif: please post progress and an ETA here. If the demo uses only the rules fallback, say so.

---

#### `[XREQ-003]` Public Citizen Intake & 6-Stage Progress Tracker
- **Priority**: `P1 (High)`
- **From**: Frontend (Minhaz)
- **To**: Backend (Anim / Asif)
- **Status**: `[RESOLVED]` (Asif: victim services and chat; Anim: authentication and HTTP integration)
- **Created**: 2026-11-15 11:30 (UTC+6)
- **Target Interface / Endpoints**: `POST /api/victim/cases`, `GET /api/victim/cases/{case_id}`, `/api/victim/cases/{case_id}/chat` (was `POST /api/intake`, `POST /api/victim/auth`, `GET /api/victim/cases/{reference}`, `POST /api/victim/chat`)

**Frontend agreement (Minhaz, 2026-11-15):** Agreed. The frontend now has victim sign-up, email verification, the portal and case reports on these routes, and looks cases up by `id`.

**Contract reconciliation (Asif, 2026-11-15):** This card describes the old access-code flow. Current API_SPEC v0.4.2 uses verified accounts, `POST /api/victim/cases` and `/api/victim/cases/{case_id}/chat`. Implement those agreed routes; do not restore the removed anonymous intake. Service progress and evidence: [Asif remaining work](contributors/asif/REMAINING_WORK.md).

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
- **Branch / Commit**: `main`. Anim: accounts and auth (N2, N3, N7, `09c1493` … `bdf8a05`), staff side of the chat (N17, `bd1f68d`). Asif: victim-case and victim-chat services.
- **Status / Notes** (**`[RESOLVED]`**):
  - **Live (Anim):** the victim account flow that replaced the access codes. `POST /api/auth/signup` (always `202`, no `role` field), `verify-email`, `resend-verification`, `login` (unverified victim → `403 EMAIL_NOT_VERIFIED`), `me`, `logout`, `forgot-password` and `reset-password`. Email links go to `FRONTEND_BASE_URL` + `/verify-email`, `/reset-password` or `/accept-invitation` with `?token=…`, which matches the frontend's routes.
  - **Live (Asif's router, mounted by Anim):** `GET /api/victim/cases/{id}/chat`, `POST …/chat/messages`, `POST …/messages/{id}/feedback`. Staff answer escalations with `POST /api/cases/{id}/chat/reply`.
  - **Now live too (Asif, `3c506a3`):** `POST/GET /api/victim/cases`, `GET/PATCH /api/victim/cases/{id}` and `POST /api/victim/claims`, plus the staff `POST /api/cases/{id}/victim-invite`. Sign-up's `preferred_language` is stored since migration 005.
- **Verification Proof**: `cd backend && uv run pytest tests/api/test_accounts.py tests/api/test_smoke.py tests/api/test_staff_chat.py` passes, including sign-up → verify → login, reset ending every session, one-time tokens under concurrency, and escalation → staff reply. `bash scripts/smoke.sh` gives 29/29 against a live server.

**Status request (Minhaz, 2026-11-15 14:49):** Victim auth and victim chat are live. The victim case routes (`GET/POST /api/victim/cases`, `GET/PATCH /api/victim/cases/{id}`) are still not mounted, so the portal falls back to mock mode. Anim / Asif: please post an ETA. Also, signup drops `preferred_language` (see XREQ-005).

---

#### `[XREQ-004]` Cross-Bank Fraud Ring Topology & Coordinated Freeze API
- **Priority**: `P1 (High)`
- **From**: Frontend & Supervisor (Minhaz)
- **To**: Backend (Asif / Anim) / AI (Galib)
- **Status**: `[IN_PROGRESS]` (Galib: detection done; Backend: endpoints and freeze open)
- **Created**: 2026-11-15 11:30 (UTC+6)
- **Target Interface / Endpoints**: `GET /api/alerts/shared-accounts` (was `GET /api/analytics/fraud-rings`); `POST /api/analytics/fraud-rings/{account_number}/freeze` is **not in the contract**

**Contract reconciliation (Minhaz, 2026-11-15):** Agreed: the dashboard reads cross-bank accounts from `GET /api/alerts/shared-accounts`. Freezing has real-world impact, so nobody builds it until the team decides who may freeze, how it is audited and how it is undone.

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
- **Branch / Commit**: `main` (Galib's detection part; commit in this card's history)
- **Status / Notes**: Split agreed in the card: **AI (Galib), done:** `app/services/fraud_rings.detect_rings(cases, include_same_bank=False, frozen_accounts=...)` returns the response items above, plus `reasons` (plain-language why), `link` (`confirmed` / `possible` / `same_bank`) and `holder_names`. It matches accounts across formats (`98-7654-3210` = `9876543210`) and holder names across spellings (`GLOBAL ASSET TRUST` = `カ）グローバルアセットトラスト`). Same digits with different holder names is only `POSSIBLE_LINK`, never `CRITICAL_SYNDICATE`, so an innocent account isn't flagged. Pure function, no DB or model calls. **Backend (Asif / Anim), open:** load the cases the supervisor may see (`id, reference, bank_id, amount, account_number, account_holder_name, transfer_date`), call `detect_rings`, serve `GET`; the `freeze` POST (supervisor only, audited, a human action) and storing frozen accounts to pass back in.
- **Verification Proof**: `cd backend && uv run pytest tests/ai/test_fraud_rings.py` → 19 passed. On the real demo seed (`app.seed.all_cases()`): exactly one cross-bank ring, account `9876543210`, 3 cases at bank_a + bank_b, ¥4,485,000 → `CRITICAL_SYNDICATE` (test `test_the_real_demo_seed_has_one_critical_cross_bank_ring`).

**Status request (Minhaz, 2026-11-15 14:49):** `GET /api/alerts/shared-accounts` is still not mounted in `backend/app/main.py`, so the dashboard's shared-accounts panel works only in mock mode. Asif / Anim: please mount it (supervisor only), and tell me the ETA here. The freeze stays out until the team decides.

---

#### `[XREQ-005]` Mount the remaining v0.4.2 routes and fix 3 contract deviations
- **Priority**: `P1 (High)`
- **From**: Frontend (Minhaz)
- **To**: Backend (Anim / Asif)
- **Status**: `[RESOLVED]`
- **Created**: 2026-11-15 14:49 (UTC+6)
- **Target Interface / Endpoints**: every route below, exactly as in `docs/openapi.yaml` v0.4.2

**Requirement Details:**
The frontend calls every route in the contract. Against the live backend (`VITE_USE_MOCK=false`), these routes match today: health, banks, all auth routes, the six case routes, and victim chat. The routes below are **not mounted** in `backend/app/main.py`, so those screens work only in mock mode. Please mount them, or reply here with which ones are out of scope for the demo so I can hide those screens in live mode.

1. **Team:** `GET/POST /api/users`, `PATCH /api/users/{id}`, invitations (`GET/POST /api/invitations`, revoke), `POST /api/auth/accept-invitation`
2. **Case work:** `POST /api/cases/{id}/notes`, `POST /api/cases/{id}/victim-invite`, `GET /api/cases/{id}/history` (+ CSV), `GET /api/audit-logs`
3. **Staff chat:** `GET /api/cases/{id}/chat`, `POST /api/cases/{id}/chat`
4. **Documents and AI review (with XREQ-002):** `POST /api/cases/{id}/documents`, `GET /api/documents/{id}/file`, `POST /api/documents/{id}/extract`, `GET /api/extractions/{id}`, `POST /api/extractions/{id}/review`, `GET /api/review-queue`
5. **Dashboard:** `GET /api/dashboard/stats`, `GET /api/alerts/shared-accounts` (XREQ-004)
6. **Knowledge base:** `GET /api/kb/documents`, `POST /api/kb/documents`, publish and archive
7. **Victim portal (with XREQ-003):** `GET/POST /api/victim/cases`, `GET/PATCH /api/victim/cases/{id}`, victim claims

**Contract deviations found in the backend (please fix or update the contract):**
- `preferred_language` is accepted at victim signup but dropped (`backend/app/services/accounts.py` ~line 99).
- The victim chat routes return errors that are not the standard `ErrorEnvelope` (`{success:false, error:{code,message,details}}`).
- `POST /api/cases/{id}/assign` declares a `409` response that the contract does not list. Either add it to `docs/openapi.yaml` or remove it.

**Frontend side (in progress, Minhaz):** the frontend is switching to `q` (not `search`) for case search, reading case documents from `GET /api/cases/{id}`, and treating the notes POST response as a `Note`.

**Status update (Minhaz, 2026-11-15):** Thank you. Every route in items 1-7 is now mounted (`staff`, `dashboard`, `staff_chat`, `kb`, `history`, `victim_cases`, `documents`). Victim chat errors now use the `ErrorEnvelope`. `preferred_language` is now stored at signup (migration 005). One item is still open:
- `POST /api/cases/{id}/assign` still declares `409` (`backend/app/routers/cases.py` ~line 127), and `docs/openapi.yaml` still does not list it.
The frontend is now checking the history and victim case routes against the contract. Any drift will be posted here.

**Fulfillment & Proof (filled by recipient on completion):**
- **Branch / Commit**: `main`. Asif `3c506a3` (routes), Anim `6d55546` (migration 005), `869b477` (contract v0.4.3).
- **Status / Notes**: **`[RESOLVED]`. All 48 contract operations are mounted**: every path and method in `openapi.yaml` is served, with none missing and none extra. Nothing is out of scope.
  - The staff chat reply is `POST /api/cases/{id}/chat/reply` (this card says `/chat`).
  - **Deviation 1 (`preferred_language` dropped):** fixed. Migration 005 adds `users.preferred_language`, and sign-up stores it.
  - **Deviation 2 (victim chat errors not the envelope):** doesn't reproduce in the real app. A bad question → `422` and another victim's case → `404`, both a valid `ErrorEnvelope`. The standalone test app inside Asif's chat tests uses its own handlers.
  - **Deviation 3 (`409` on assign):** the behaviour is right (a closed case can't be reassigned), so the contract was fixed. v0.4.3 declares that `409` (shared `CaseClosed`), plus 20 more operations' `403`/`422`/`409` that the server could already send.
- **Verification Proof**: `uv run pytest tests/api/test_contract_routes.py tests/api/test_contract.py tests/api/test_permissions.py` passes (each response validated against the schema the contract declares for that exact path, method and status); full suite 761 passed. The smoke run through the Prism proxy (`--errors`) gives 39/39 with 0 violations. `redocly lint`: valid.
---

#### `[XREQ-006]` Deploy backend, database and AI to the cloud; give the frontend a public API URL
- **Priority**: `P0 (Blocker)`
- **From**: Frontend (Minhaz)
- **To**: Backend (Asif / Anim) / AI (Galib)
- **Status**: `[VERIFIED_AND_CLOSED]`
- **Created**: 2026-11-15 15:05 (UTC+6)
- **Target Interface / Endpoint**: a public `https://` base URL serving `/api/*` (contract v0.4.2)

**Path change (Minhaz, 2026-11-15 23:30):** Cloud Run `--min-instances=1` and Cloud SQL are not free. Deploy through **XREQ-007** ([docs/DEPLOY-FREE.md](docs/DEPLOY-FREE.md)) instead. Everything else in this card (CORS, env vars, email decision, health) still applies. This card closes when XREQ-007 posts the URL.

**Question to every owner: is your part deployed to the cloud and working? Reply in this card with yes/no and the URL.**

**Status request (Minhaz, 2026-11-15 22:40):** thanks for the image, runbook and v0.4.3. The frontend now handles live errors (retry, FastAPI `detail` parsing, 401 on downloads) and builds against v0.4.3. The only frontend blocker left is the URL. Anim/Asif: when do the Cloud Run + Postgres steps land? Who holds the GCP project access? Galib: are the AI keys ready for the host's secret manager? Post `API_URL` in the reply block below. The live build follows the same hour.

**Where things stand (checked 2026-11-15 15:05):**
- **Frontend: deployed.** Firebase Hosting, `https://reliefops.web.app` (also `https://reliefops.firebaseapp.com`). Both return 200. It runs in mock mode today because there is no backend to call.
- **Backend: not deployed, as far as the repo shows.** There is no Dockerfile, no Cloud Run / Render / Fly / Railway config and no deploy workflow (`.github/workflows` has only `verify-branch-sync.yml`). If it is deployed somewhere, post the URL here.
- **AI: runs inside the backend** (`backend/app/services/ai_extraction.py`, `fraud_rings.py`), so it goes live when the backend does. Its provider keys must be set on the server.

**Requirement Details (please do all of these, then post the URL):**
1. **Deploy the FastAPI app** to a host with HTTPS. Cloud Run is the easiest fit, since the frontend is already on Firebase/GCP. Any HTTPS host works. **It must be `https://`**: the frontend is served over HTTPS, so browsers block calls to a plain `http://` API (mixed content).
2. **Deploy a managed Postgres** (Cloud SQL, Neon or Supabase) with both roles the app expects (`app_user` for the app and `migrator` for migrations), so bank isolation (RLS) still works. Run `alembic upgrade head` with `MIGRATIONS_DATABASE_URL`, then `uv run python -m app.seed`, so the demo accounts (`Demo@1234`) exist.
3. **CORS (blocker):** `cors_origins` in `backend/app/config.py` defaults to localhost only, so the browser will block every call from the deployed site. Set the env var:
   `CORS_ORIGINS=https://reliefops.web.app,https://reliefops.firebaseapp.com,http://localhost:5173,http://localhost:3000`
   CORS must also cover preflight `OPTIONS` (it does today with `allow_methods/headers=["*"]`) and keep the exposed headers `Retry-After`, `X-Request-ID` and `Content-Disposition` (CSV and file downloads need them). Auth is a Bearer token, not cookies, so no `allow_credentials` or SameSite change is needed.
4. **Server env vars:**
   - `APP_ENV=prod`
   - `DATABASE_URL`, `MIGRATIONS_DATABASE_URL`
   - `FRONTEND_BASE_URL=https://reliefops.web.app` (the email verification, reset and invitation links point here)
   - `SESSION_HOURS`
   - `AI_MODE=live`, plus `GEMINI_API_KEY`, `OPENROUTER_API_KEY` and `GROQ_API_KEY`, which are **secrets: set them in the host's secret manager and never commit them**
   - `LOG_LEVEL`
5. **Email decision (blocker for victim sign-up):** with `EMAIL_MODE=console`, verification emails go only to the server log, so a judge cannot verify a new victim account. Choose one:
   - `EMAIL_MODE=smtp`, with SMTP secrets set on the server
   - keep console mode and demo only with the pre-verified seed accounts (victim1 and victim2)
   Post the choice here.
6. **Rate limiting:** `backend/app/rate_limit.py` keeps counters in process memory. Run one instance (Cloud Run `--max-instances=1`), or the limits split across instances. Cold starts are fine; `--min-instances=1` avoids a slow first request during judging.
7. **Uploads:** the host must accept 10 MB multipart bodies (`POST /api/cases/{id}/documents`, `POST /api/kb/documents`). Check the proxy body limit. Cloud Run allows 32 MB.
8. **Health:** `GET /api/health` should return `db: ok` and the AI status in prod. Use it as the host's health check.

**Expected reply (fill in below):**
```text
API_URL=https://<your-host>          # no trailing slash, no /api suffix
CORS_ORIGINS set: yes/no
DB migrated + seeded: yes/no
AI keys set, /api/health ai=ok: yes/no
EMAIL_MODE: console | smtp
```

**After the URL arrives (Minhaz):**
1. Build the frontend with `VITE_USE_MOCK=false VITE_API_URL=<API_URL>`; Vite bakes these in at build time.
2. Redeploy Firebase Hosting.
3. Test every flow against the live API, and report drift in XREQ-005.

**Fulfillment & Proof (filled by recipient on completion):**
- **Branch / Commit**: `9dc1936`: `backend/Dockerfile`, `backend/.dockerignore`, [docs/DEPLOY.md](docs/DEPLOY.md).
- **Status / Notes** (Anim, backend lead, `[IN_PROGRESS]`): **the backend is ready to deploy but not deployed yet.** The remaining steps need the team's Google Cloud project and a database account.
  - **Plan:** Cloud Run (HTTPS, same project as Firebase) plus a managed Postgres 16 with pgvector (Cloud SQL, Neon or Supabase). It's one instance (`--max-instances=1`, because the rate limits are in memory) and `--min-instances=1`, so there's no cold start.
  - **CORS:** `CORS_ORIGINS=https://reliefops.web.app,https://reliefops.firebaseapp.com,http://localhost:5173`, with `FRONTEND_BASE_URL=https://reliefops.web.app`.
  - **Rehearsed locally with the same image on an empty database:** boot without a database URL refuses to start (prod guard); the migrate+seed job applies 001→005 and seeds the demo data; prod-mode health is `ok`; CORS allows `reliefops.web.app` and rejects other origins; the per-client login lockout works behind a proxy (`X-Forwarded-For`); smoke 39/39 against the container.
  - **Left:** (1) **Galib rotates the three AI keys** (the old ones are in git history; removed from `.env.example` in `9018383`); (2) create the database and roles (DEPLOY.md §1); (3) build, push and deploy (§2–5); (4) **email decision:** `console` (demo with the pre-verified seed accounts) or `smtp` (needs SMTP secrets); (5) post the URL here.
- **Verification Proof**: after deploying, `curl -i -H "Origin: https://reliefops.web.app" <API_URL>/api/health` should give `200` and `access-control-allow-origin: https://reliefops.web.app`, and `bash backend/scripts/smoke.sh <API_URL>` should give 39/39.
---

#### `[XREQ-007]` Free always-on deploy: verify the plan, then implement it
- **Priority**: `P0 (Blocker)`
- **From**: Frontend (Minhaz)
- **To**: Backend (Asif / Anim) / AI (Galib)
- **Status**: `[VERIFIED_AND_CLOSED]`
- **Created**: 2026-11-15 23:30 (UTC+6), **revised** 2026-11-16 00:40 (plan re-verified: budget, DB access, job source fixed), **deployed** 2026-11-16 23:50 on Azure (see "Live deploy" at the end of this card)
- **Target Interface / Endpoint**: a public `https://` base URL serving `/api/*` (contract v0.4.3), free and awake during judging

**Why:** XREQ-006 is stuck on Cloud Run. `--min-instances=1` and Cloud SQL need a paid billing account. The team's constraints are: free, no card, does not sleep, fast, simple. **Revised path:** Firebase Hosting (frontend, already live) + **Northflank Developer Sandbox** for everything else: one service built from the existing `backend/Dockerfile` (backend + AI), plus a Postgres addon with `pgvector` built in. One platform, always on, no card. Full runbook: [docs/DEPLOY-FREE.md](docs/DEPLOY-FREE.md).

**The first version of this card (Hugging Face Spaces + Neon) is withdrawn.** HF now requires a paid plan to create Docker Spaces. If you already started on HF, stop.

**Order (do not skip ahead):**
1. **Verify first (Phase A in the runbook, about 20 min).** Each owner ticks their checks in the reply block below.
   - Backend (Asif / Anim): A1 Sandbox is no-card and always on, note the allowed region; A2 the **full** DEPLOY.md §1 role SQL runs on the Postgres addon (via the CLI tunnel, there is no browser SQL console); A3 the service gets `nf-compute-50` (0.5 vCPU / 1 GB) with the addon on `nf-compute-20`, which keeps the total about $18–19 under the $20 Sandbox cap; A4 email choice.
   - AI (Galib): A5 rotate the three AI keys; A6 free quotas cover a judging day; A7 OCR + extraction + RAG work in the built image with `AI_MODE=live`.
   - If a check fails, the runbook names the fallback next to it (A2 fails: database on Neon; A1 fails: Cloud Run + Neon, needs a card). Write which one you used here.
2. **Then implement (Phase B, all in the Northflank UI):** project, Postgres addon and roles, secret group, `api` service (Dockerfile, context `/backend`, port 8080, 1 instance, health check `/api/health`), `migrate` job built from the repo (a job cannot reuse a combined service's build) with custom command `alembic upgrade head && python -m app.seed`, live checks.
3. **Then post the reply block.** Minhaz rebuilds the frontend against the URL and redeploys Firebase the same hour.

**Rules:**
- Secrets live only in the Northflank secret group. Never in git, never in `.env.example`.
- Rotate the AI keys before the first deploy (the old ones are in git history, `9018383`).
- One instance only (in-memory rate limits). Turn auto-deploy off before judging.

**Expected reply (fill in below):**
```text
Phase A  A1 [ ] A2 [ ] A3 [ ] A4 [ ] (backend)   A5 [ ] A6 [ ] A7 [ ] (AI)
Fallback used (if any):
API_URL=https://<...>.code.run          # no trailing slash, no /api suffix
CORS header for https://reliefops.web.app: yes/no
DB migrated + seeded (seed line matches): yes/no
/api/health db=ok ai=ok rag=ok: yes/no
smoke.sh: __/39
Live extraction + KB chat checked (Galib): yes/no
EMAIL_MODE: console | smtp
```

**Fulfillment & Proof (filled by recipient on completion):**
- **Branch / Commit**: no code change. Docs only: [docs/DEPLOY-FREE.md](docs/DEPLOY-FREE.md) § "Database: Supabase".
- **Status / Notes** (Anim, backend lead, 2026-11-15 23:45):
  - **The database is done, on Supabase instead of the Northflank addon.** A2, B1 and B4 are complete.
    - Project `reliefops`, Tokyo, Postgres 17.11, pgvector 0.8.2, free plan.
    - Roles `migrator` / `app_user` (`NOBYPASSRLS`), migrations 001→005, and the seed; the seed line matches.
    - Connect through the session pooler `aws-1-ap-northeast-1.pooler.supabase.com:5432` (IPv4).
    - The two connection URLs are in Anim's local `backend/.env.deploy`. **Ask Anim; they're sent privately, never in git or chat.**
  - **Still open for backend:** A1 and A3 (Northflank Sandbox plan and size), A4 (email choice), then B2, B3 and B5 using the Supabase URLs.
  - **For Galib (AI). What to do now, in this order:**
    1. **Stop the Hugging Face plan.** It can't work, for three separate reasons:
       - Docker Spaces need a paid PRO plan.
       - A *Private* Space returns 404 to everyone except collaborators, so the frontend and the judges couldn't reach it.
       - Spaces block outbound ports other than 80, 443 and 8080, so the API couldn't reach Postgres on 5432 at all.
       ([HF docs](https://huggingface.co/docs/hub/en/spaces-overview): "Space visibility", "Networking".)
    2. **A5: rotate** `GEMINI_API_KEY`, `GROQ_API_KEY` and `OPENROUTER_API_KEY` at the providers now. The old ones are in git history (`9018383`). Put the new ones **only** in the Northflank secret group (B2). Never put them in git, `.env.example` or chat.
    3. **A6:** write each provider's free quota (requests per minute and per day) here, with the `AI_MAX_CONCURRENT` / `AI_TIMEOUT_SECONDS` values you plan to use.
    4. **A7:** build the image (`docker build -t reliefops-backend backend`) and run it with `AI_MODE=live` against your **local** database, not Supabase, because extraction writes rows. `/api/health` must show `ai` and `rag` available, and one extraction on a seed document must succeed.
    5. **After the API is live (B5):** run one real extraction and one KB chat question through the live URL. Check that the answer cites passages, then tick "Live extraction + KB chat" below.
    6. You don't need to set anything up in the database. It's ready.
- **Reply so far:**
  ```text
  Phase A  A1 [ ] A2 [x] A3 [ ] A4 [ ] (backend)   A5 [x] A6 [x] A7 [~] (AI)
  Fallback used (if any): database on Supabase free (Tokyo) instead of the Northflank addon / Neon
  DB migrated + seeded (seed line matches): yes
  ```
- **AI reply (Galib, 2026-11-16):**
  - **A5 (keys): no rotation needed.** Searched the whole git history (`git log --all -p`) for Gemini (`AIza…`), Groq (`gsk_…`) and OpenRouter (`sk-or-v1-…`) key patterns: 0 matches. The lines removed in `9018383` were placeholders (`your-gemini-key`, …). The real keys only exist in Galib's local `backend/.env`; Galib sends them privately for the Northflank secret group.
  - **A6 (free quotas), for one judging day:**
    - Extraction: Gemini free tier is **20 requests/day per model** (measured from the 429 quota id). The chain has 4 Gemini models, so about **80 live extractions/day**, then OpenRouter Nemotron VL (**50/day**), then the recorded results for the 12 seed documents. One extraction = 1 request; median about 5 s.
    - Chat: Groq `openai/gpt-oss-120b` and `qwen/qwen3.8-27b` each **1,000 requests/day, 8,000 tokens/minute** (read from Groq's `x-ratelimit-*` headers today). One answer is about 2–3k tokens, so about 3 answers/minute per model, 6/minute with both; Gemini 3.1 Flash-Lite after that. Each question also makes 1 Gemini embedding call (free; the daily cap is shown per project on the AI Studio rate-limit page).
    - Rule for judging day: don't run `eval/` scripts that day (they spend the quota). `scripts/ai_check.py` uses none.
    - Settings: **`AI_TIMEOUT_SECONDS=20`** (extraction stops itself at 17 s, chat at 15 s, so the engine's timeout never cuts a good answer), **`AI_MAX_CONCURRENT=2`** (free tiers throttle bursts; 2 parallel extractions is enough for a demo). `AI_MODE=live`.
  - **A7 (in the built image): partly done.** Docker isn't installed on Galib's machine, so the image wasn't built here. Checked instead:
    - the Dockerfile installs `tesseract-ocr` + `tesseract-ocr-jpn` and copies `app/` (prompts), `seed_data/` (bluebooks, `ai_cache`) and the seed documents;
    - the code reads the keys from environment variables, which is how the secret group provides them, and needs no `TESSERACT_CMD` on Linux;
    - `scripts/ai_check.py`: READY;
    - live, outside Docker: extraction of `t02_netbank.pdf` → `gemini-2.5-flash`, 4.8 s, 5/5 fields match `labels.json`; chat "How do I apply for relief money?" (bank_a) → `grounded`, cites `bank_a-03`, `openai/gpt-oss-120b`, 1.6 s.
    - **Still open:** the same two checks in the image. Galib does them on the Northflank build right after B5 (step 5 below), then ticks A7 and "Live extraction + KB chat".
- **Verification Proof** (API run locally in prod mode against Supabase, 2026-11-15):
  - `/api/health` → `{"status":"healthy","db":"ok","ai":"disabled","rag":"disabled"}` (no AI keys locally).
  - Preflight from `https://reliefops.web.app` → `access-control-allow-origin: https://reliefops.web.app`; from another origin → `400`.
  - Supervisor 42 cases (5 banks), viewer A 8 (bank_a only), viewer B 11 (bank_b only), a victim on `/api/cases` → `403`, no token → `401`.
  - Supabase security advisor: 0 issues.
  - The live `smoke.sh` waits for B5.
- **Live deploy (Asif, 2026-11-16 23:50). Northflank was replaced by an Azure for Students VM.**
  - **Why:** Northflank's signup asked for a card (A1 failed). Azure for Students needs no card and the VM never sleeps.
  - **Where:** VM `reliefops-api`, Japan East (same region as Supabase), Arm64 `Standard_B2pts_v2`, Docker Compose with the API (backend + AI + Tesseract, one instance) behind Caddy (HTTPS, Let's Encrypt). Runbook: [docs/DEPLOY-FREE.md](docs/DEPLOY-FREE.md) § "Azure VM"; files: [deploy/azure-vm/](deploy/azure-vm/).
  - **Settings:** `EMAIL_MODE=console` (A4), `AI_MAX_CONCURRENT=2`, `AI_TIMEOUT_SECONDS=20` (Galib's A6 values). Secrets only in the gitignored `deploy/azure-vm/.env.prod` and on the VM (`chmod 600`).
  - **Keepalive:** [.github/workflows/keepalive.yml](.github/workflows/keepalive.yml) pings `/api/health` and `/api/banks` twice a day so Supabase doesn't pause. It runs once the repo variable `API_URL` is set.
  - **Reply:**
    ```text
    Phase A  A1 [x] (failed -> Azure) A2 [x] A3 [x] (Azure B2pts_v2: 2 vCPU, 1 GB + 2 GB swap) A4 [x] (backend)   A5 [x] A6 [x] A7 [x] (AI)
    Fallback used (if any): Azure for Students VM (Japan East) instead of Northflank; database on Supabase free (Tokyo)
    API_URL=https://reliefops-api.japaneast.cloudapp.azure.com
    CORS header for https://reliefops.web.app: yes (also reliefops.firebaseapp.com, and localhost/127.0.0.1 on 5173 dev, 4173 preview, 5199 Playwright; a foreign origin gets none)
    DB migrated + seeded (seed line matches): yes (/api/banks returns the 5 banks)
    /api/health db=ok ai=ok rag=ok: yes ({"db":"ok","ai":"available","rag":"available"})
    smoke.sh: 39/39
    Live extraction + KB chat checked (Galib): pending, Galib
    EMAIL_MODE: console
    ```
  - **A7 in the image:** done on the VM. The built Arm64 image has Tesseract 5.5 with `eng` + `jpn`, every Python dependency imports, and `/api/health` reports `ai` and `rag` available with the live keys.
  - **Next:**
    - **Minhaz:** build the frontend with `VITE_USE_MOCK=false VITE_API_URL=https://reliefops-api.japaneast.cloudapp.azure.com`, redeploy Firebase, then mark this card `[VERIFIED_AND_CLOSED]`.
    - **Galib:** run one live extraction and one KB chat question through the URL and tick the line above.
    - **Asif:** set the repo variable `API_URL` so the keepalive runs.
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

### 3.6 Quality Bar — Engineering Guidelines

[docs/ENGINEERING_GUIDELINES.md](docs/ENGINEERING_GUIDELINES.md) is the project-wide quality checklist (items `G-01`…`G-52`). It applies to frontend, backend and AI code, and to docs and process.

1. **Before a PR or marking an `XREQ` `[RESOLVED]`:** walk the checklist for the areas you touched. Any box you cannot tick gets a one-line reason in the PR body or the XREQ proof block.
2. **Corrections become checks.** When you correct an agent or a teammate, add a lint rule, type, test or architecture rule (G-01). Edit prose rules only when no check can express it.
3. **Reviews start with evidence** (tests, screenshots, curl proof), then code (G-21).
4. **Found a recurring mistake?** Propose a new `G-xx` item with the check that enforces it, in the same PR (G-52).
5. Audit reports cite items by ID, `file:line`, priority (P0–P3, see the guide's priority table) and a fix.

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
