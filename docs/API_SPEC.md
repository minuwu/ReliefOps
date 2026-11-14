# API Specification (Shared Contract)

**Version** 0.3.0 (draft) · **Updated** 2026-11-14 · **Owner** Asif (Backend)

This is the **single source of truth** for the API between Frontend, Backend and AI. Build against it now using mocks. From now on, any change goes through an `XREQ` in [AGENTS.md](../AGENTS.md). Never rename a field silently.

A machine-readable copy of this contract is in [openapi.yaml](openapi.yaml) (OpenAPI 3.1). Use it to run a mock API with no backend (§9) or to generate TypeScript types.

The reasons behind these choices (data model, security, AI safety, devops) are in [plans/backend-plan.md](plans/backend-plan.md). Decision numbers like **D1** refer to that file.

**Product in one paragraph:** a case system for one operations center that handles fraud-victim relief cases for five banks. A victim's web form, or an operator entering a phone or paper report, opens a case. Operators move the case through six stages. Supervisors watch deadlines and workload. A bank viewer sees only their own bank's cases. One AI feature reads an uploaded document and *suggests* field values, and nothing reaches the case until a person accepts it. A second AI feature, the **case assistant**, answers a victim's questions from their own bank's bluebook and passes anything it can't answer to staff.

## Contents
0. [Assumptions to know before building](#0-assumptions-to-know-before-building)
1. [Conventions](#1-conventions)
2. [Roles and permissions](#2-roles-and-permissions)
3. [Statuses, enums and business rules](#3-statuses-enums-and-business-rules)
4. [Data types](#4-data-types)
5. [Endpoint index](#5-endpoint-index)
6. [Endpoint details](#6-endpoint-details)
7. [AI module interface (Backend ↔ AI)](#7-ai-module-interface-backend--ai)
8. [Seeded demo accounts and data](#8-seeded-demo-accounts-and-data)
9. [Notes for mocking](#9-notes-for-mocking)
10. [How to update this file](#10-how-to-update-this-file)

---

## 0. Assumptions to know before building

1. **Each case belongs to one bank (D1):** the bank that holds the account the victim sent money to (`bank_id`). That bank checks and freezes the account, so it owns the case.
2. **Operators and supervisors are center staff (D2)** and work across all five banks. Bank viewers are bank employees: read-only and limited to their own bank. Every time someone opens a case, it is written to the audit log.
3. **The AI only suggests (D3).** No endpoint lets the AI change a status or make any money decision. AI output is stored separately and reaches the case only after a person accepts it.
4. **Money decisions need a supervisor (D4).** Closing a case as `paid_out` or `rejected` is supervisor-only.
5. **Victims can see and edit their own case (D13).** Victims have no accounts. Intake returns a reference and a one-time access code; together they open a session that covers only that case.
   - Contact details stay editable until the case closes.
   - Report details are editable only while the case is still `received`.
   - Staff can issue a new code, for phone or paper cases or a lost code.
6. **Victims can ask a case assistant (D14).** A chatbot answers from **the bluebook of the victim's own bank** and a minimal view of their case.
   - The bank comes from the case on the server, so no victim can reach another bank's bluebook.
   - It never changes anything, promises money or predicts an outcome.
   - Questions it can't answer go to staff, who reply in the same thread (§3.6).

If you disagree with one of these, file an `XREQ` before building on it.

---

## 1. Conventions

| Item | Rule |
| :--- | :--- |
| Base URL (local) | `http://localhost:8000` |
| Swagger | `http://localhost:8000/docs` · raw schema at `/openapi.json` (once the backend exists) |
| Contract file | [docs/openapi.yaml](openapi.yaml), OpenAPI 3.1, validated with `npx -y @redocly/cli@2.78.0 lint docs/openapi.yaml` |
| Mock API (no backend) | `http://localhost:4010`, served from `openapi.yaml` (see §9). Point the frontend's API base URL here until the backend is live. |
| Format | JSON, UTF-8, `snake_case` keys. File upload is the only `multipart/form-data` request. |
| Auth | `Authorization: Bearer <token>` on every endpoint not marked **public**. A token lasts 8 hours and there is no refresh in v0.1. On any `401`, send the user back to the login screen. |
| IDs | UUID strings. Banks use fixed short IDs: `bank_a` to `bank_e`. |
| Case reference | Each case also has a human-readable `reference`, e.g. `RFR-2026-00042`. Show the reference in the UI and use `id` in URLs. |
| Timestamps | ISO 8601 in UTC, e.g. `2026-11-14T04:30:00Z`. Calendar dates use `YYYY-MM-DD`. |
| Money | `amount` is a JSON number (≥ 0, at most 2 decimals) with a `currency` ISO 4217 code. Seed data uses `JPY`. |
| Nulls | A nullable field is always present and set to `null`. Keys are never left out. |
| Lists | Query `page` (starts at 1, default 1) and `page_size` (default 20, max 100). The response `data` is `{ "items": [...], "page": 1, "page_size": 20, "total": 57 }`. |
| Files | File downloads (`/file`, `?format=csv`) return the raw file, not the envelope. |

### 1.1 Response envelope

Every JSON response, success or error, uses this envelope.

```json
{ "success": true, "data": {}, "message": "ok" }
```

```json
{
  "success": false,
  "error": { "code": "RESOURCE_NOT_FOUND", "message": "Case not found", "details": {} }
}
```

FastAPI's validation errors (422) are converted to this format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request has invalid fields",
    "details": { "fields": [ { "field": "victim.email", "message": "Not a valid email address" } ] }
  }
}
```

### 1.2 Error codes

| HTTP | `code` | When |
| :--- | :--- | :--- |
| 400 | `BAD_REQUEST` | Malformed body or unsupported file type |
| 401 | `UNAUTHORIZED` | Missing, invalid or expired token |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password at login, or wrong case reference / access code for a victim session |
| 403 | `FORBIDDEN` | Your role can't do this (e.g. an operator closing a case as `paid_out`) |
| 404 | `RESOURCE_NOT_FOUND` | It doesn't exist **or it belongs to another bank**. Cross-bank access always returns 404, never 403, so a bank viewer can't confirm a case exists. |
| 409 | `INVALID_STATUS_TRANSITION` | That status change isn't allowed from the current status. `details`: `{ "from", "to", "allowed": [] }` |
| 409 | `ALREADY_REVIEWED` | The extraction was already accepted or rejected |
| 409 | `CASE_LOCKED` | A victim tried to change a field that is locked at the case's current status (§3.5). `details`: `{ "locked_fields": [] }` |
| 413 | `FILE_TOO_LARGE` | Upload is over 10 MB |
| 422 | `VALIDATION_ERROR` | A field failed validation. `details.fields[]` |
| 422 | `MISSING_REQUIRED_INFO` | The case lacks information needed for this status change. `details.missing_fields[]` |
| 429 | `RATE_LIMITED` | Too many public intake submissions, or too many failed logins, from one IP |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

**An AI failure is never returned as an HTTP error.** If the AI times out or is down, the extraction request still succeeds, and the returned extraction has `status: "failed"` or `source: "rules_fallback"` (see 6.5).

---

## 2. Roles and permissions

Staff roles: `operator`, `supervisor`, `bank_viewer`. Victims have no account. Anyone can use the intake form. A victim who has their case's reference and access code opens a **victim session** that covers only that one case (§6.7).

| Action | operator | supervisor | bank_viewer | victim |
| :--- | :---: | :---: | :---: | :---: |
| Submit victim intake form | – | – | – | ✓ (no login) |
| List / open cases | all banks | all banks | own bank | own case only (limited view) |
| Create case (phone / paper report) | ✓ | ✓ | – | – |
| Edit case fields | ✓ | ✓ | – | own case, limited (§3.5) |
| Add notes (internal) | ✓ | ✓ | – | – |
| Issue a victim access code | ✓ | ✓ | – | – |
| Ask the case assistant (chatbot) | – | – | – | own case |
| Read a case's chat thread | ✓ | ✓ | own bank | own case |
| Reply to a victim in the chat | ✓ | ✓ | – | – |
| List bluebooks | all banks | all banks | own bank | – |
| Upload, publish or archive a bluebook | – | ✓ | – | – |
| Change status (not money closures) | ✓ | ✓ | – | – |
| Close as `paid_out` or `rejected` | – | ✓ | – | – |
| Override a deadline | – | ✓ | – | – |
| Assign owner | self only | anyone | – | – |
| Upload document, run AI extraction | ✓ | ✓ | – | – |
| Review AI extraction, review queue | ✓ | ✓ | – | – |
| Case history (+ CSV export) | ✓ | ✓ | own bank | – |
| Dashboard stats | – | all banks | own bank | – |
| Global audit log | – | all banks | own bank | – |
| Shared-account alerts | – | ✓ | – | – |

**Who enforces this:** the server does, through API checks plus Postgres row-level security (D5). The frontend hides buttons only to make the UI tidier. For a `bank_viewer`, any `bank_id` filter is ignored and replaced with their own bank. A victim session works only on `/api/victim/*`; every other endpoint returns `403 FORBIDDEN` to it.

---

## 3. Statuses, enums and business rules

### 3.1 Case statuses and stage deadlines

| Value | Label | Default stage deadline |
| :--- | :--- | :--- |
| `received` | Received | 2 days |
| `verified` | Verified | 5 days |
| `account_check` | Account Check | 10 days |
| `notice_published` | Notice Published | 60 days |
| `payout_review` | Payout Review | 10 days |
| `closed` | Closed | none |

When a case enters a status, `deadline` = entry time + that status's day count. The day counts are placeholders and can be changed in server config. A supervisor can override a deadline (see 6.3, PATCH).

`deadline_state` is computed on every read:
- `on_track`
- `due_soon`: deadline within 2 days
- `overdue`: deadline has passed
- `none`: case is closed

### 3.2 Allowed status changes

- **Forward one step** from any open status.
- **Back one step**, with a `note` explaining why (e.g. verification found a problem).
- **Close** from any open status, with a `closure_reason`:
  - `withdrawn`: operator or supervisor.
  - `rejected`: supervisor only.
  - `paid_out`: supervisor only, and only from `payout_review`.
- `closed` is final.

**The frontend doesn't need to code these rules.** Every case comes with `allowed_transitions` and `allowed_closure_reasons` for the logged-in user. Build the action buttons from those lists.

### 3.3 Required information

A case can't leave `received` until it has all of these. Otherwise the status change returns `422 MISSING_REQUIRED_INFO`.

| Key | Means |
| :--- | :--- |
| `victim_contact` | Phone or email |
| `amount` | Amount sent |
| `transfer_date` | Date the money was sent |
| `account_number` | Account the money was sent to |
| `scam_type` | Type of scam |
| `document` | At least one uploaded document |

Every case carries `flags.missing_fields`, which lists what's still missing. The UI can show it before the user tries to move the case.

### 3.4 Enum values

```ts
type Role = 'operator' | 'supervisor' | 'bank_viewer';
type CaseStatus = 'received' | 'verified' | 'account_check' | 'notice_published' | 'payout_review' | 'closed';
type ClosureReason = 'paid_out' | 'rejected' | 'withdrawn';
type DeadlineState = 'on_track' | 'due_soon' | 'overdue' | 'none';
type ScamType = 'phishing' | 'impersonation' | 'investment' | 'romance' | 'lottery_prize' | 'job_offer' | 'other';
type IntakeChannel = 'web_form' | 'phone' | 'paper';
type Language = 'en' | 'ja' | 'bn';                       // more can be added
type DocumentType = 'intake_form' | 'transfer_receipt' | 'bank_statement' | 'police_report' | 'id_document' | 'other';
type MissingField = 'victim_contact' | 'amount' | 'transfer_date' | 'account_number' | 'scam_type' | 'document';
type ExtractionStatus = 'pending_review' | 'accepted' | 'rejected' | 'failed';
type ExtractionSource = 'llm' | 'rules_fallback';
type ReviewLane = 'standard' | 'low_confidence';
type ExtractableField =
  | 'victim_name' | 'victim_phone' | 'victim_email'       // map to victim.name / .phone / .email
  | 'amount' | 'currency' | 'transfer_date'
  | 'account_number' | 'account_holder_name' | 'scam_type';
type AuditAction =
  | 'auth.login' | 'auth.login_failed'
  | 'case.created' | 'case.viewed' | 'case.updated' | 'case.status_changed'
  | 'case.assigned' | 'case.deadline_changed' | 'note.added'
  | 'document.uploaded' | 'document.downloaded'
  | 'ai.extraction_completed' | 'ai.extraction_failed'
  | 'ai.review_accepted' | 'ai.review_rejected'
  | 'export.generated'
  | 'case.access_code_issued'
  | 'chat.escalated' | 'chat.staff_replied'
  | 'kb.document_uploaded' | 'kb.document_published' | 'kb.document_archived';
type ChatRole = 'victim' | 'assistant' | 'staff';
type AnswerType = 'grounded' | 'passages_only' | 'no_answer' | 'refused';
type KbDocumentStatus = 'processing' | 'ready' | 'published' | 'archived' | 'failed';
type VictimEditableField =
  | 'victim.name' | 'victim.phone' | 'victim.email' | 'victim.address' | 'victim.preferred_language'
  | 'amount' | 'currency' | 'transfer_date' | 'account_number' | 'account_holder_name'
  | 'scam_type' | 'description';
```

### 3.5 What a victim can change (D13)

| Fields | When |
| :--- | :--- |
| **Contact:** `victim.phone`, `victim.email`, `victim.address`, `victim.preferred_language` | Any time until the case is `closed`. A phone number or an email must remain. |
| **Report:** `victim.name`, `amount`, `currency`, `transfer_date`, `account_number`, `account_holder_name`, `scam_type`, `description` | Only while the case is `received`. Once staff have verified a case, its facts are locked; the victim calls the center to correct them. |
| `bank_id`, status, owner, deadline, documents, notes | Never. |

Every `VictimCase` carries `editable_fields`, the exact list for right now. Build the edit form from it. Changing any other field returns `409 CASE_LOCKED`.

### 3.6 The case assistant (D14)

**What it uses**
- Only **published** bluebook documents of **the case's bank**. The server takes the bank from the case, never from the question.
- A small, non-identifying case summary: status, time in the current stage, missing information, scam type, amount, transfer date and closure reason.
- The last 6 messages of the thread.

**What it never sees, so it can never reveal**
- the victim's name, phone, email, address and account numbers
- staff notes, the case owner, internal deadlines and AI extraction data
- other cases, including shared-account counts
- other banks' bluebooks

**What it never does:** change the case, promise a payout or an amount, or predict the outcome. It explains the process; staff decide.

| `answer_type` | Meaning | `needs_staff` |
| :--- | :--- | :--- |
| `grounded` | Written from bluebook passages; always has `citations` | `false` |
| `passages_only` | The AI model was unavailable; returns the most relevant passages as `citations` with a short notice, no written answer | `false` |
| `no_answer` | The bank's bluebook doesn't answer it confidently enough | `true` |
| `refused` | Out of scope: asks about other people, asks the assistant to act, or asks for a decision | `false` |

If the victim asks to talk to a person, the reply says staff will contact them, and `needs_staff` is `true`.

**Escalation.** When `needs_staff` is `true`:
- the case gets `flags.victim_question_pending = true`, so it stands out on the board;
- an audit entry `chat.escalated` is written;
- staff answer with `POST /api/cases/{id}/chat/reply`, which posts a `staff` message into the victim's thread and clears the flag.

**Limits**
- A question is at most 1,000 characters.
- 20 questions per case per hour (`429`).
- Answers come in the victim's `preferred_language`; citations quote the bluebook in its own language.

---

## 4. Data types

Written as TypeScript so the frontend can paste them in directly. Backend Pydantic models mirror these.

```ts
interface Bank { id: string; name: string }

interface UserRef { id: string; name: string }

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  bank_id: string | null;            // set only for bank_viewer
}

interface Victim {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  preferred_language: Language;
}

interface CaseFlags {
  missing_fields: MissingField[];    // see 3.3
  ai_review_pending: boolean;        // a document has an extraction waiting for review
  shared_account_case_count: number; // OTHER cases at the same bank with the same account_number (0 = none)
  victim_question_pending: boolean;  // the case assistant passed a victim's question to staff (§3.6)
}

interface CaseSummary {              // one row in the case list / board
  id: string;
  reference: string;
  bank_id: string;
  bank_name: string;
  victim_name: string;               // same as victim.name in the full case
  amount: number | null;
  currency: string;
  scam_type: ScamType | null;
  status: CaseStatus;
  deadline: string | null;           // null when closed
  deadline_state: DeadlineState;
  assigned_operator: UserRef | null;
  reported_date: string;             // YYYY-MM-DD
  updated_at: string;
  flags: CaseFlags;
}

interface Case extends CaseSummary {
  victim: Victim;
  transfer_date: string | null;      // YYYY-MM-DD
  account_number: string | null;     // the account the money was SENT TO (checked / frozen)
  account_holder_name: string | null;
  description: string | null;        // what happened, in the victim's words
  channel: IntakeChannel;
  closure_reason: ClosureReason | null;
  created_at: string;
  closed_at: string | null;
  allowed_transitions: CaseStatus[];         // for the current user — render buttons from this
  allowed_closure_reasons: ClosureReason[];  // empty unless 'closed' is in allowed_transitions
  documents: DocumentMeta[];
  notes: Note[];                     // newest first
}

interface Note { id: string; body: string; author: UserRef; created_at: string }

interface DocumentMeta {
  id: string;
  case_id: string;
  filename: string;
  doc_type: DocumentType;
  mime_type: string;
  size_bytes: number;
  uploaded_by: UserRef;
  uploaded_at: string;
  latest_extraction: {
    id: string;
    status: ExtractionStatus;
    overall_confidence: number | null;
    review_lane: ReviewLane | null;
  } | null;
}

interface ExtractedField {
  name: ExtractableField;
  value: string | number | null;     // what the AI read
  confidence: number;                // 0..1
  evidence: string | null;           // short quote from the document that supports the value
  current_case_value: string | number | null; // what the case holds now, so the reviewer sees the difference
  final_value: string | number | null;        // what the human approved; null until reviewed
}

interface Extraction {
  id: string;
  document_id: string;
  case_id: string;
  case_reference: string;
  bank_id: string;
  status: ExtractionStatus;
  source: ExtractionSource;          // 'rules_fallback' = AI was down, simple pattern matching was used
  model: string | null;              // null for rules_fallback
  prompt_version: string | null;
  overall_confidence: number | null; // lowest field confidence; null when failed
  review_lane: ReviewLane | null;    // null when failed
  fields: ExtractedField[];
  missing_fields: ExtractableField[];// fields not found in the document
  error: {
    reason: 'timeout' | 'ai_unavailable' | 'unreadable_document' | 'invalid_ai_output';
    message: string;
  } | null;
  created_at: string;
  reviewed_by: UserRef | null;
  reviewed_at: string | null;
  review_note: string | null;
}

interface ReviewQueueItem {
  extraction_id: string;
  case_id: string;
  case_reference: string;
  bank_id: string;
  bank_name: string;
  document_id: string;
  document_filename: string;
  source: ExtractionSource;
  overall_confidence: number | null;
  review_lane: ReviewLane;
  assigned_operator: UserRef | null;
  created_at: string;
}

interface AuditEntry {
  id: string;
  at: string;
  actor: {
    type: 'user' | 'public' | 'victim' | 'system' | 'ai';
    id: string | null;
    name: string;                    // e.g. "Operator One", "Web intake form", "AI extractor"
    role: Role | null;
  };
  action: AuditAction;
  case_id: string | null;
  case_reference: string | null;
  bank_id: string | null;
  summary: string;                   // human-readable, e.g. "Status Received → Verified"
  changes: Record<string, { from: unknown; to: unknown }> | null;
  metadata: Record<string, unknown> | null;  // e.g. { "extraction_id": "...", "overall_confidence": 0.62 }
}

interface DashboardStats {
  scope: { bank_id: string | null; label: string };  // bank_id null = all banks
  open_cases: number;
  overdue_cases: number;
  due_soon_cases: number;
  unassigned_cases: number;
  avg_handling_days: number | null;  // closed cases: closed_at − reported_date; null if none closed yet
  ai_review_pending: number;
  ai_low_confidence_pending: number;
  cases_by_status: Record<CaseStatus, number>;
  workload: { operator: UserRef; open_cases: number; overdue_cases: number }[];  // [] for bank_viewer
  generated_at: string;
}

interface SharedAccountAlert {
  bank_id: string;
  bank_name: string;
  account_number: string;
  case_count: number;
  total_amount: number;
  currency: string;
  cases: { id: string; reference: string; status: CaseStatus }[];
}

interface VictimCase {               // what a victim sees about their own case (§6.7)
  reference: string;
  bank_name: string;
  status: CaseStatus;
  closure_reason: ClosureReason | null;
  victim: Victim;
  amount: number | null;
  currency: string;
  transfer_date: string | null;      // YYYY-MM-DD
  account_number: string | null;
  account_holder_name: string | null;
  scam_type: ScamType | null;
  description: string | null;
  missing_fields: MissingField[];
  editable_fields: VictimEditableField[];  // what they may change right now (§3.5)
  submitted_at: string;
  updated_at: string;
  // Deliberately absent: internal id, owner, deadline, notes, documents, AI data, audit trail.
}

interface Citation {
  document_id: string;
  document_title: string;            // e.g. "Birch Regional Bank — Fraud Relief Bluebook"
  version: string;                   // e.g. "2026.1"
  section: string | null;            // e.g. "3.1 After verification"
  page: number | null;
  quote: string;                     // the passage, in the bluebook's own language
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  body: string;                      // the question, the assistant's answer, or a staff reply
  language: Language;
  created_at: string;
  author: UserRef | null;            // staff replies only
  // Assistant messages only; null, [] or false on other roles:
  answer_type: AnswerType | null;
  citations: Citation[];
  confidence: number | null;         // 0..1
  needs_staff: boolean;
  feedback: 'helpful' | 'not_helpful' | null;
}

interface ChatThread {               // one thread per case
  case_reference: string;
  messages: ChatMessage[];           // oldest first
  victim_question_pending: boolean;
  assistant_available: boolean;      // false when the AI model is down (answers are then passages_only)
}

interface KbDocument {               // one bluebook document; always belongs to exactly one bank
  id: string;
  bank_id: string;
  bank_name: string;
  title: string;
  version: string;
  language: Language;
  status: KbDocumentStatus;
  passage_count: number | null;      // passages indexed; null until ready
  error: string | null;              // set when status is 'failed'
  uploaded_by: UserRef;
  uploaded_at: string;
  published_at: string | null;
}
```

---

## 5. Endpoint index

Tiers follow the brief: **MVP** is required, **Should** is expected, **Nice** is a bonus. **Extra** is not in the brief: it's the team's own case assistant (RAG), built only once the MVP path works. Build the frontend in that order. Status: `PLANNED` = agreed, not built · `MOCKED` = backend returns fixed data · `LIVE` = real and checked in Swagger.

| # | Method | Path | Who | Tier | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 6.1 | POST | `/api/auth/login` | public | MVP | PLANNED |
| 6.1 | GET | `/api/auth/me` | logged in | MVP | PLANNED |
| 6.2 | GET | `/api/health` | public | MVP | PLANNED |
| 6.2 | GET | `/api/banks` | public | MVP | PLANNED |
| 6.2 | GET | `/api/users` | operator, supervisor | MVP | PLANNED |
| 6.3 | POST | `/api/intake` | public | MVP | PLANNED |
| 6.3 | GET | `/api/cases` | all roles | MVP | PLANNED |
| 6.3 | POST | `/api/cases` | operator, supervisor | MVP | PLANNED |
| 6.3 | GET | `/api/cases/{case_id}` | all roles | MVP | PLANNED |
| 6.3 | PATCH | `/api/cases/{case_id}` | operator, supervisor | MVP | PLANNED |
| 6.3 | POST | `/api/cases/{case_id}/transition` | operator, supervisor | MVP | PLANNED |
| 6.3 | POST | `/api/cases/{case_id}/assign` | operator, supervisor | MVP | PLANNED |
| 6.3 | POST | `/api/cases/{case_id}/notes` | operator, supervisor | Should | PLANNED |
| 6.3 | POST | `/api/cases/{case_id}/victim-access` | operator, supervisor | Should | PLANNED |
| 6.4 | GET | `/api/cases/{case_id}/history` | all roles | MVP | PLANNED |
| 6.5 | POST | `/api/cases/{case_id}/documents` | operator, supervisor | MVP | PLANNED |
| 6.5 | GET | `/api/documents/{document_id}/file` | all roles | Should | PLANNED |
| 6.5 | POST | `/api/documents/{document_id}/extract` | operator, supervisor | MVP | PLANNED |
| 6.5 | GET | `/api/extractions/{extraction_id}` | operator, supervisor | MVP | PLANNED |
| 6.5 | POST | `/api/extractions/{extraction_id}/review` | operator, supervisor | MVP | PLANNED |
| 6.5 | GET | `/api/review-queue` | operator, supervisor | Should | PLANNED |
| 6.6 | GET | `/api/dashboard/stats` | supervisor, bank_viewer | Should | PLANNED |
| 6.4 | GET | `/api/audit-logs` | supervisor, bank_viewer | MVP | PLANNED |
| 6.6 | GET | `/api/alerts/shared-accounts` | supervisor | Nice | PLANNED |
| 6.4 | GET | `/api/cases/{case_id}/history?format=csv` | all roles | Nice | PLANNED |
| 6.7 | POST | `/api/victim/session` | public | Should | PLANNED |
| 6.7 | GET | `/api/victim/case` | victim session | Should | PLANNED |
| 6.7 | PATCH | `/api/victim/case` | victim session | Should | PLANNED |
| 6.7 | GET | `/api/victim/chat` | victim session | Extra | PLANNED |
| 6.7 | POST | `/api/victim/chat/messages` | victim session | Extra | PLANNED |
| 6.7 | POST | `/api/victim/chat/messages/{message_id}/feedback` | victim session | Extra | PLANNED |
| 6.8 | GET | `/api/cases/{case_id}/chat` | operator, supervisor, bank_viewer | Extra | PLANNED |
| 6.8 | POST | `/api/cases/{case_id}/chat/reply` | operator, supervisor | Extra | PLANNED |
| 6.8 | GET | `/api/kb/documents` | operator, supervisor, bank_viewer | Extra | PLANNED |
| 6.8 | POST | `/api/kb/documents` | supervisor | Extra | PLANNED |
| 6.8 | POST | `/api/kb/documents/{kb_document_id}/publish` | supervisor | Extra | PLANNED |
| 6.8 | POST | `/api/kb/documents/{kb_document_id}/archive` | supervisor | Extra | PLANNED |

**Not in this version:** file upload by victims, password reset, token refresh, moving a case between banks.

---

## 6. Endpoint details

### 6.1 Auth

#### `POST /api/auth/login` · public

Request:
```json
{ "email": "operator1@opscenter.test", "password": "Demo@1234" }
```

Response `200`:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_at": "2026-11-14T12:30:00Z",
    "user": {
      "id": "11111111-1111-4111-8111-111111111111",
      "name": "Operator One",
      "email": "operator1@opscenter.test",
      "role": "operator",
      "bank_id": null
    }
  },
  "message": "Login successful"
}
```

Errors: `401 INVALID_CREDENTIALS`, `422 VALIDATION_ERROR`, `429 RATE_LIMITED` (too many failed attempts from one IP or for one email). Successful and failed logins are both audited.

#### `GET /api/auth/me` · logged in

Response `200`: `data` is a `User`. Errors: `401 UNAUTHORIZED`.

---

### 6.2 Reference data and health

#### `GET /api/health` · public

```json
{
  "success": true,
  "data": { "status": "healthy", "db": "ok", "ai": "available", "rag": "available", "timestamp": "2026-11-14T04:30:00Z" },
  "message": "ok"
}
```

`ai` is `"available"`, `"unavailable"` (provider not reachable) or `"disabled"` (no API key set). When it isn't `available`, the frontend should show a banner like "AI offline — enter fields manually".

`rag` reports the case assistant: `"available"`, `"degraded"` (the AI model is down, so answers are `passages_only`), `"unavailable"`, or `"disabled"` (no published bluebooks or no key).

#### `GET /api/banks` · public

Response `200`: `data` is `Bank[]` (all five banks, for the intake form's dropdown).

#### `GET /api/users?role=operator` · operator, supervisor

Response `200`: `data` is `User[]`, not paginated. Used for the "assign owner" dropdown.

---

### 6.3 Cases

#### `POST /api/intake` · public · rate-limited by IP

The victim's web form. It creates a case in `received` with `channel: "web_form"`.

Request:
```json
{
  "bank_id": "bank_b",
  "victim": {
    "name": "Rina Example",
    "phone": "+81-90-0000-0042",
    "email": "rina.example@mail.test",
    "address": null,
    "preferred_language": "ja"
  },
  "amount": 250000,
  "currency": "JPY",
  "transfer_date": "2026-10-28",
  "account_number": "0012345",
  "account_holder_name": "Sample Trading LLC",
  "scam_type": "impersonation",
  "description": "Caller said they were from the tax office and asked me to pay a refund fee.",
  "consent": true
}
```

- **Required:** `bank_id`, `victim.name`, `victim.phone` or `victim.email`, `amount`, `transfer_date`, `scam_type`, and `consent: true`.
- **Optional:** `account_number`, since the victim may not know it yet. A missing account number shows up in `flags.missing_fields`.

Response `201`. This deliberately returns no internal IDs or case data:
```json
{
  "success": true,
  "data": {
    "reference": "RFR-2026-00042",
    "access_code": "K7QM-4XHP-2RTV",
    "status": "received",
    "submitted_at": "2026-11-14T04:30:00Z"
  },
  "message": "Report received. Keep your reference number and access code."
}
```

The `access_code` appears only in this response, and the server stores only a hash of it. With the reference, it lets the victim view and edit their case (§6.7). Show both on the confirmation screen and tell the victim to keep them.

Errors: `422 VALIDATION_ERROR`, `429 RATE_LIMITED`.

#### `GET /api/cases` · all roles

| Query | Values |
| :--- | :--- |
| `status` | comma-separated `CaseStatus`, e.g. `received,verified` |
| `bank_id` | one bank ID. **Ignored for `bank_viewer`**, whose results are always their own bank. |
| `assigned_to` | user ID, `me`, or `unassigned` |
| `deadline_state` | `on_track`, `due_soon`, `overdue` |
| `scam_type` | one `ScamType` |
| `q` | search reference, victim name or account number |
| `sort` | `deadline` (default), `reported_date`, `amount`, `updated_at` |
| `order` | `asc` (default) or `desc` |
| `page`, `page_size` | see §1 |

Response `200`: `data` is a page of `CaseSummary`. For a board view, call it with `page_size=100` and group the rows by `status`. For "my overdue cases" reminders, use `assigned_to=me&deadline_state=overdue`.

#### `POST /api/cases` · operator, supervisor

An operator creates a case from a phone call or paper report. Only `bank_id`, `channel` and `victim.name` are required. Any other field can be filled in later, by hand or through an AI extraction. This is the main demo flow: create the case, upload the scanned paper form, let the AI fill the fields, then have a person review them.

Request: the same body as `/api/intake`, without `consent`, plus:
```json
{
  "channel": "paper",
  "reported_date": "2026-11-10",
  "assigned_operator_id": "11111111-1111-4111-8111-111111111111"
}
```

`reported_date` defaults to today. `assigned_operator_id` is optional.

Response `201`: `data` is a `Case`. Errors: `422 VALIDATION_ERROR`.

#### `GET /api/cases/{case_id}` · all roles

Response `200`: `data` is a `Case`. **Side effect:** it writes a `case.viewed` audit entry.

```json
{
  "success": true,
  "data": {
    "id": "7f3c2a9e-5b1d-4c8e-9a10-2d6f8b4e1c33",
    "reference": "RFR-2026-00042",
    "bank_id": "bank_b",
    "bank_name": "Birch Regional Bank",
    "victim_name": "Rina Example",
    "victim": {
      "name": "Rina Example",
      "phone": "+81-90-0000-0042",
      "email": "rina.example@mail.test",
      "address": null,
      "preferred_language": "ja"
    },
    "amount": 250000,
    "currency": "JPY",
    "transfer_date": "2026-10-28",
    "account_number": "0012345",
    "account_holder_name": "Sample Trading LLC",
    "scam_type": "impersonation",
    "description": "Caller said they were from the tax office and asked me to pay a refund fee.",
    "channel": "web_form",
    "status": "verified",
    "deadline": "2026-11-19T04:30:00Z",
    "deadline_state": "on_track",
    "assigned_operator": { "id": "11111111-1111-4111-8111-111111111111", "name": "Operator One" },
    "reported_date": "2026-11-02",
    "closure_reason": null,
    "created_at": "2026-11-02T03:12:00Z",
    "updated_at": "2026-11-14T04:30:00Z",
    "closed_at": null,
    "flags": { "missing_fields": [], "ai_review_pending": false, "shared_account_case_count": 2, "victim_question_pending": false },
    "allowed_transitions": ["account_check", "received", "closed"],
    "allowed_closure_reasons": ["withdrawn"],
    "documents": [
      {
        "id": "d0c0d0c0-0000-4000-8000-000000000001",
        "case_id": "7f3c2a9e-5b1d-4c8e-9a10-2d6f8b4e1c33",
        "filename": "transfer_receipt_00042.pdf",
        "doc_type": "transfer_receipt",
        "mime_type": "application/pdf",
        "size_bytes": 48211,
        "uploaded_by": { "id": "11111111-1111-4111-8111-111111111111", "name": "Operator One" },
        "uploaded_at": "2026-11-03T01:05:00Z",
        "latest_extraction": {
          "id": "e0e0e0e0-0000-4000-8000-000000000001",
          "status": "accepted",
          "overall_confidence": 0.62,
          "review_lane": "low_confidence"
        }
      }
    ],
    "notes": [
      {
        "id": "a0a0a0a0-0000-4000-8000-000000000001",
        "body": "Victim confirmed the transfer by phone.",
        "author": { "id": "11111111-1111-4111-8111-111111111111", "name": "Operator One" },
        "created_at": "2026-11-04T02:00:00Z"
      }
    ]
  },
  "message": "ok"
}
```

Errors: `404 RESOURCE_NOT_FOUND`. This is also what a bank viewer from another bank gets.

#### `PATCH /api/cases/{case_id}` · operator, supervisor

Partial update. Send only the fields that changed.

- **Editable:** `victim` (any sub-field), `amount`, `currency`, `transfer_date`, `account_number`, `account_holder_name`, `scam_type`, `description`.
- **Supervisor only:** `deadline`, which must come with `deadline_reason`.
- **Not editable here:** `status` (use `/transition`), `bank_id`, `assigned_operator` (use `/assign`).

```json
{ "amount": 260000, "victim": { "phone": "+81-90-0000-0043" } }
```

Response `200`: `data` is the updated `Case`. Each changed field is audited with its old and new value.

Errors: `403 FORBIDDEN` (deadline change by a non-supervisor), `404`, `422 VALIDATION_ERROR`.

#### `POST /api/cases/{case_id}/transition` · operator, supervisor

```json
{ "to_status": "closed", "closure_reason": "withdrawn", "note": "Victim withdrew the claim by phone." }
```

- `note` is required when moving back a step or closing.
- `closure_reason` is required when `to_status` is `closed`.
- On success, the case gets a new `deadline` (3.1) and an audit entry is written.

Response `200`: `data` is the updated `Case`.

Errors:
- `409 INVALID_STATUS_TRANSITION`, with `details: { "from", "to", "allowed": [] }`
- `422 MISSING_REQUIRED_INFO`, with `details: { "missing_fields": ["account_number", "document"] }`
- `403 FORBIDDEN`, when a money closure is attempted by a non-supervisor
- `404`

#### `POST /api/cases/{case_id}/assign` · operator (self only), supervisor

```json
{ "operator_id": "11111111-1111-4111-8111-111111111111" }
```

Send `null` to unassign. Response `200`: `data` is the updated `Case`. Errors: `403 FORBIDDEN` (an operator assigning someone else), `404`, `422`.

#### `POST /api/cases/{case_id}/notes` · operator, supervisor

```json
{ "body": "Called the bank; the account is frozen as of today." }
```

Response `201`: `data` is a `Note`. Notes keep case knowledge in the system when staff change.

#### `POST /api/cases/{case_id}/victim-access` · operator, supervisor

Issues a new access code for the case's victim. Use it when:
- the case came in by phone or paper, so the victim has no code yet;
- the victim lost their code.

The previous code and any open victim session stop working.

No body. Response `201`:
```json
{
  "success": true,
  "data": { "reference": "RFR-2026-00042", "access_code": "R9TB-6NZE-3WFJ" },
  "message": "Give this code to the victim. It is shown only once."
}
```

It's audited as `case.access_code_issued`, and the code itself is never logged. Errors: `403 FORBIDDEN` (bank viewer), `404`.

---

### 6.4 Audit and history

#### `GET /api/cases/{case_id}/history` · all roles (bank_viewer: own bank)

Returns the case's audit entries, newest first, as a paginated list of `AuditEntry`. It covers status changes, edits, views, uploads and AI review decisions.

Example item:
```json
{
  "id": "b1b1b1b1-0000-4000-8000-000000000007",
  "at": "2026-11-05T06:12:00Z",
  "actor": { "type": "user", "id": "11111111-1111-4111-8111-111111111111", "name": "Operator One", "role": "operator" },
  "action": "case.status_changed",
  "case_id": "7f3c2a9e-5b1d-4c8e-9a10-2d6f8b4e1c33",
  "case_reference": "RFR-2026-00042",
  "bank_id": "bank_b",
  "summary": "Status Received → Verified",
  "changes": { "status": { "from": "received", "to": "verified" } },
  "metadata": null
}
```

With `?format=csv` (**Nice** tier), it returns a `text/csv` download with columns `at, actor_name, actor_role, action, summary`. The export itself is audited as `export.generated`.

#### `GET /api/audit-logs` · supervisor (all banks), bank_viewer (own bank)

Query: `case_id`, `actor_id`, `action`, `from`, `to` (ISO timestamps), `page`, `page_size`. Response `200`: a page of `AuditEntry`, newest first.

The audit log is append-only. No endpoint edits or deletes it, and the database blocks it too (D8).

---

### 6.5 Documents and AI extraction (the human-review flow)

The flow is **upload → extract → a person reviews → only then does the case change**.

#### `POST /api/cases/{case_id}/documents` · operator, supervisor

`multipart/form-data` with two parts:
- `file`: PDF, PNG, JPG or TXT, at most 10 MB.
- `doc_type`: a `DocumentType`.

Response `201`: `data` is a `DocumentMeta`. Errors: `400 BAD_REQUEST` (file type), `413 FILE_TOO_LARGE`, `404`.

#### `GET /api/documents/{document_id}/file` · all roles (bank_viewer: own bank)

Returns the raw file with its `Content-Type` and is audited as `document.downloaded`. It needs the bearer header, so the frontend must fetch it, turn it into a blob and use an object URL. A plain `<a href>` won't send the token.

#### `POST /api/documents/{document_id}/extract` · operator, supervisor

No body. It runs synchronously: the server waits **up to 20 seconds** for the AI, so the frontend should show a spinner and use a 30-second fetch timeout. It always returns `201` with an `Extraction`, even when the AI fails.

| What happened | `status` | `source` | `review_lane` |
| :--- | :--- | :--- | :--- |
| AI answered, every field ≥ threshold (default 0.75) | `pending_review` | `llm` | `standard` |
| AI answered, some field below threshold | `pending_review` | `llm` | `low_confidence` |
| AI down or timed out, rule-based fallback found fields | `pending_review` | `rules_fallback` | `low_confidence` |
| AI down and fallback found nothing, or unreadable file | `failed` | `rules_fallback` | `null` |

**Every result waits for a person.** The lane only sets priority and how prominently the UI warns. Re-running extraction on the same document is allowed, and the older pending extraction is rejected automatically with the note "superseded".

Example response (low confidence: the scan has `00I2345`, with a capital I where a digit 1 should be):
```json
{
  "success": true,
  "data": {
    "id": "e0e0e0e0-0000-4000-8000-000000000001",
    "document_id": "d0c0d0c0-0000-4000-8000-000000000001",
    "case_id": "7f3c2a9e-5b1d-4c8e-9a10-2d6f8b4e1c33",
    "case_reference": "RFR-2026-00042",
    "bank_id": "bank_b",
    "status": "pending_review",
    "source": "llm",
    "model": "example-model",
    "prompt_version": "extract-v1",
    "overall_confidence": 0.62,
    "review_lane": "low_confidence",
    "fields": [
      { "name": "amount", "value": 250000, "confidence": 0.95, "evidence": "Transfer amount: ¥250,000", "current_case_value": null, "final_value": null },
      { "name": "transfer_date", "value": "2026-10-28", "confidence": 0.91, "evidence": "Date: 2026/10/28", "current_case_value": null, "final_value": null },
      { "name": "account_number", "value": "0012345", "confidence": 0.62, "evidence": "A/C No. 00I2345", "current_case_value": null, "final_value": null }
    ],
    "missing_fields": ["victim_phone", "victim_email"],
    "error": null,
    "created_at": "2026-11-03T01:06:00Z",
    "reviewed_by": null,
    "reviewed_at": null,
    "review_note": null
  },
  "message": "Extraction ready for review"
}
```

Example of a `failed` extraction (only the fields that differ):
```json
{
  "status": "failed",
  "source": "rules_fallback",
  "model": null,
  "overall_confidence": null,
  "review_lane": null,
  "fields": [],
  "error": { "reason": "ai_unavailable", "message": "AI service did not respond and no fields could be read. Enter the fields manually." }
}
```

Errors: `404`.

#### `GET /api/extractions/{extraction_id}` · operator, supervisor

Response `200`: `data` is an `Extraction`.

#### `POST /api/extractions/{extraction_id}/review` · operator, supervisor

To accept, send the values the person approves (edited or not). **Only the fields listed in `fields` are written to the case**, so a partial accept is fine.

```json
{
  "decision": "accept",
  "fields": { "amount": 250000, "transfer_date": "2026-10-28", "account_number": "0012345" },
  "note": "Checked the account number against the scan."
}
```

To reject, send a note. The case is unchanged.

```json
{ "decision": "reject", "note": "Wrong document — this is another victim's receipt." }
```

Response `200`:
```json
{ "success": true, "data": { "extraction": { "...": "Extraction" }, "case": { "...": "Case" } }, "message": "Review saved" }
```

The audit entry `ai.review_accepted` stores each field's AI value next to its final value. This is how we measure AI accuracy on real reviews.

Errors: `409 ALREADY_REVIEWED`, `422 VALIDATION_ERROR` (`note` missing on reject, bad value types), `404`.

#### `GET /api/review-queue` · operator, supervisor

Query: `lane` (`standard` | `low_confidence`), `bank_id`, `page`, `page_size`. Response `200`: a page of `ReviewQueueItem`, only `pending_review` items, `low_confidence` first and then oldest first.

---

### 6.6 Supervisor views

#### `GET /api/dashboard/stats` · supervisor, bank_viewer

Query: `bank_id`. Supervisors may pass it to narrow the stats; for a bank viewer it's ignored and their own bank is used.

```json
{
  "success": true,
  "data": {
    "scope": { "bank_id": null, "label": "All banks" },
    "open_cases": 27,
    "overdue_cases": 6,
    "due_soon_cases": 4,
    "unassigned_cases": 3,
    "avg_handling_days": 182.4,
    "ai_review_pending": 5,
    "ai_low_confidence_pending": 2,
    "cases_by_status": { "received": 5, "verified": 6, "account_check": 7, "notice_published": 5, "payout_review": 4, "closed": 3 },
    "workload": [
      { "operator": { "id": "11111111-1111-4111-8111-111111111111", "name": "Operator One" }, "open_cases": 14, "overdue_cases": 4 }
    ],
    "generated_at": "2026-11-14T04:30:00Z"
  },
  "message": "ok"
}
```

The brief asks for 3 to 5 numbers. Suggested headline tiles: `open_cases`, `overdue_cases`, `avg_handling_days`, `ai_low_confidence_pending`. Everything else is there if you want it.

#### `GET /api/alerts/shared-accounts` · supervisor · Nice

Query: `min_cases` (default 2). Response `200`: `data` is `SharedAccountAlert[]`, most cases first.

Matching uses `(bank_id, account_number)`, so it never compares data across banks.

---

### 6.7 Victim self-service

Victims have no account. The intake form gives them a reference and an access code (§6.3). Together they open a **victim session**: a token that lasts 1 hour and works only for that one case, on `/api/victim/*`. Send it like any other token: `Authorization: Bearer <token>`.

#### `POST /api/victim/session` · public · rate-limited

```json
{ "reference": "RFR-2026-00042", "access_code": "K7QM-4XHP-2RTV" }
```

The code is not case-sensitive, and the dashes are optional.

Response `200`:
```json
{
  "success": true,
  "data": { "token": "eyJhbGciOiJIUzI1NiIs...", "expires_at": "2026-11-14T05:30:00Z", "case": { "...": "VictimCase" } },
  "message": "ok"
}
```

Errors:
- `401 INVALID_CREDENTIALS`: the same answer for a wrong reference and a wrong code, so nobody can test which references exist.
- `422 VALIDATION_ERROR`
- `429 RATE_LIMITED`: after 5 failed attempts for one reference or one IP within 15 minutes.

#### `GET /api/victim/case` · victim session

Response `200`: `data` is a `VictimCase`. It's audited as `case.viewed` with actor type `victim`.

```json
{
  "success": true,
  "data": {
    "reference": "RFR-2026-00042",
    "bank_name": "Birch Regional Bank",
    "status": "verified",
    "closure_reason": null,
    "victim": {
      "name": "Rina Example",
      "phone": "+81-90-0000-0042",
      "email": "rina.example@mail.test",
      "address": null,
      "preferred_language": "ja"
    },
    "amount": 250000,
    "currency": "JPY",
    "transfer_date": "2026-10-28",
    "account_number": "0012345",
    "account_holder_name": "Sample Trading LLC",
    "scam_type": "impersonation",
    "description": "Caller said they were from the tax office and asked me to pay a refund fee.",
    "missing_fields": [],
    "editable_fields": ["victim.phone", "victim.email", "victim.address", "victim.preferred_language"],
    "submitted_at": "2026-11-02T03:12:00Z",
    "updated_at": "2026-11-14T04:30:00Z"
  },
  "message": "ok"
}
```

#### `PATCH /api/victim/case` · victim session

Partial update: send only the fields that changed. What's allowed depends on the status (§3.5), and the case's `editable_fields` lists it exactly.

```json
{ "victim": { "phone": "+81-90-0000-0099", "preferred_language": "en" } }
```

Response `200`: the updated `VictimCase`. Each changed field is audited as `case.updated` with actor type `victim` and its old and new value, so staff see the change in the case history (§6.4).

Errors:
- `409 CASE_LOCKED`, with `details: { "locked_fields": ["amount"] }`. Example: changing the amount after the case was verified.
- `422 VALIDATION_ERROR`. Example: removing both phone and email.
- `401 UNAUTHORIZED`: the session expired, or staff issued a new access code.

#### `GET /api/victim/chat` · victim session · Extra

Response `200`: `data` is the case's `ChatThread`. It starts empty.

#### `POST /api/victim/chat/messages` · victim session · rate-limited · Extra

```json
{ "question": "What happens next with my case?" }
```

An optional `language` overrides the victim's `preferred_language` for this answer. The call is synchronous: the server waits up to 20 s, so use a 30 s fetch timeout. It always returns `201`, even when the AI is down, so check `answer_type`.

Response `201`:
```json
{
  "success": true,
  "data": {
    "question": {
      "id": "c4a70000-0000-4000-8000-000000000001", "role": "victim", "body": "What happens next with my case?",
      "language": "ja", "created_at": "2026-11-14T04:40:00Z", "author": null,
      "answer_type": null, "citations": [], "confidence": null, "needs_staff": false, "feedback": null
    },
    "answer": {
      "id": "c4a70000-0000-4000-8000-000000000002", "role": "assistant",
      "body": "Your case has been verified. Under Birch Regional Bank's bluebook, the next step is the account check: the bank confirms the account you sent money to and freezes what is left in it. You don't need to do anything now; the center contacts you only if more documents are needed. This is general information, not a decision about a payout.",
      "language": "ja", "created_at": "2026-11-14T04:40:03Z", "author": null,
      "answer_type": "grounded",
      "citations": [
        {
          "document_id": "b0b0b0b0-0000-4000-8000-00000000000b",
          "document_title": "Birch Regional Bank — Fraud Relief Bluebook",
          "version": "2026.1",
          "section": "3.1 After verification",
          "page": 6,
          "quote": "After verification, the Bank checks the recipient account and freezes any remaining balance. The applicant is contacted only if further documents are required."
        }
      ],
      "confidence": 0.86, "needs_staff": false, "feedback": null
    }
  },
  "message": "ok"
}
```

Errors:
- `422 VALIDATION_ERROR`: empty, or over 1,000 characters
- `429 RATE_LIMITED`: over 20 questions per case per hour
- `401`

#### `POST /api/victim/chat/messages/{message_id}/feedback` · victim session · Extra

```json
{ "feedback": "not_helpful" }
```

Only works on assistant messages. Response `200`: the updated `ChatMessage`. Answers marked `not_helpful` feed the quality review (backend-plan §6). Errors: `404`, `422`.

---

### 6.8 Case assistant: staff side and bluebooks (Extra)

#### `GET /api/cases/{case_id}/chat` · operator, supervisor, bank_viewer (own bank)

Response `200`: the same `ChatThread` the victim sees, so staff know exactly what the assistant told them.

#### `POST /api/cases/{case_id}/chat/reply` · operator, supervisor

```json
{ "body": "Hello, this is the operations center. We received your police report number, thank you." }
```

Posts a `staff` message into the victim's thread and clears `victim_question_pending`. Response `201`: `data` is the new `ChatMessage`. It's audited as `chat.staff_replied`. Errors: `403`, `404`, `422`.

#### `GET /api/kb/documents` · operator, supervisor (all banks), bank_viewer (own bank)

Query: `bank_id`, `status`. Response `200`: `data` is `KbDocument[]`, not paginated.

#### `POST /api/kb/documents` · supervisor

`multipart/form-data`:
- `file`: PDF or TXT, at most 20 MB
- `bank_id`, `title`, `version`, `language`

Response `201`: `data` is a `KbDocument` with status `processing`. Splitting and indexing run in the background; poll the list until the status is `ready` or `failed`. It's audited as `kb.document_uploaded`.

**Bluebooks must be synthetic.** The brief forbids real bank documents.

Errors: `400` (file type), `413` (over 20 MB), `422`.

#### `POST /api/kb/documents/{kb_document_id}/publish` · supervisor

Only a `ready` document can be published, and the assistant uses only published documents. Publishing a new version with the same title archives the older one. Response `200`: `data` is the `KbDocument`. It's audited as `kb.document_published`.

Errors: `409 INVALID_STATUS_TRANSITION` (not `ready`), `403`, `404`.

#### `POST /api/kb/documents/{kb_document_id}/archive` · supervisor

The assistant stops using it. Response `200`: `data` is the `KbDocument`. It's audited as `kb.document_archived`. Errors: `403`, `404`.

---

## 7. AI module interface (Backend ↔ AI)

### 7.1 Document extraction

Galib (AI / LLM) implements one function. Backend calls it and handles everything around it.

```python
# backend/app/services/ai_extraction.py
def extract_fields(file_bytes: bytes, mime_type: str, doc_type: str) -> dict:
    """
    Return:
      {
        "fields": [
          {"name": "amount", "value": 250000, "confidence": 0.95, "evidence": "Transfer amount: ¥250,000"}
        ],
        "model": "example-model",
        "prompt_version": "extract-v1"
      }
    `name` must be an ExtractableField (§3.4). Leave out fields you can't find.
    Raise AIUnavailableError if the provider can't be reached. Backend handles timeouts.
    """
```

| AI (Galib) owns | Backend (Asif, Anim) owns |
| :--- | :--- |
| Prompt files in `backend/app/prompts/` (versioned) | 20 s timeout, rule-based fallback, retries |
| Per-field `confidence` and `evidence` | `overall_confidence`, `review_lane`, threshold setting |
| Evaluation on the labelled test documents (field-level accuracy, with real failure examples) | Saving results, review flow, audit trail, applying accepted values |

### 7.2 Case assistant (RAG)

Galib implements three functions. **Retrieval itself runs in the backend**, inside the bank-scoped database session, so filtering by bank is enforced by our database rules and not by AI code.

```python
# backend/app/services/rag.py
def split_bluebook(file_bytes: bytes, mime_type: str) -> list[dict]:
    """[{"text": "...", "section": "3.1 After verification", "page": 6}, ...] in reading order."""

def embed(texts: list[str]) -> list[list[float]]:
    """One vector per text. Fixed dimension per model; backend stores the model name with each vector."""

def answer(question: str, passages: list[dict], case_context: dict, history: list[dict], language: str) -> dict:
    """
    passages: [{"passage_id", "text", "section", "page", "score"}] — already limited to the case's bank.
    case_context: the allow-listed, non-identifying case summary from §3.6.
    Return {"answer_type": "grounded" | "no_answer" | "refused", "body": str,
            "used_passage_ids": [...], "confidence": float, "needs_staff": bool,
            "model": str, "prompt_version": str}
    Every grounded answer must cite at least one passage. Raise AIUnavailableError if the model can't be reached.
    """
```

| AI (Galib) owns | Backend (Asif, Anim) owns |
| :--- | :--- |
| How bluebooks are split, the embedding model, prompts, answer rules (cite, refuse, escalate) | Storing passages in pgvector; **bank-scoped retrieval** (keyword + vector); building the allow-listed case context |
| The golden question set and its scores (backend-plan §6) | Timeouts, the `passages_only` fallback, rate limits, saving threads, escalation flag, audit |

---

## 8. Seeded demo accounts and data

Everything is synthetic. The password for every account is `Demo@1234`.

| Email | Role | Bank |
| :--- | :--- | :--- |
| `operator1@opscenter.test` | operator | all |
| `operator2@opscenter.test` | operator | all |
| `supervisor@opscenter.test` | supervisor | all |
| `viewer@bank-a.test` | bank_viewer | `bank_a` |
| `viewer@bank-b.test` | bank_viewer | `bank_b` |

| Bank ID | Name |
| :--- | :--- |
| `bank_a` | Aster Regional Bank |
| `bank_b` | Birch Regional Bank |
| `bank_c` | Cobalt Regional Bank |
| `bank_d` | Dune Regional Bank |
| `bank_e` | Ember Regional Bank |

The seed will include:
- at least 30 cases, spread across all five banks and all six statuses
- about 6 overdue cases
- at least 10 documents, some clean and some messy, to test low confidence
- 2–3 accounts shared by several cases

Emails use the `.test` domain and phone numbers use `0000` blocks.

Two seeded cases have fixed victim access codes (synthetic), for demos:

| Reference | Access code | Status | Victim can edit |
| :--- | :--- | :--- | :--- |
| `RFR-2026-00042` | `K7QM-4XHP-2RTV` | `verified` (bank_b) | contact details only |
| `RFR-2026-00051` | `M3PX-8KWN-5QDA` | `received` (bank_c) | everything in §3.5 |

**Bluebooks (synthetic):** one per bank, 4–6 pages each. They differ on purpose: required documents, contact hours, and how the notice period is worded. In the demo, ask the same question as victims of two different banks and get two different, correctly cited answers.

---

## 9. Notes for mocking

- Mock from the examples in this file. **Include `allowed_transitions`, `allowed_closure_reasons`, `flags` and `deadline_state` in your mocks.** The UI should render from them rather than recompute them.
- Build screens for the AI's unhappy paths too: one extraction in the `low_confidence` lane, and one `failed` extraction with `source: "rules_fallback"`. The judges will ask what happens when the AI is wrong or down, and the demo needs a screen that answers it.
- Show a banner when `GET /api/health` returns `ai` other than `"available"`.
- Show a `404` on a case page as "Case not found". It's also what a viewer from another bank sees, which is the correct behaviour.

### 9.1 Mock API from the contract (no backend needed)

Run this from the repo root (Node 18+):

```bash
npx -y @stoplight/prism-cli@5.14.2 mock docs/openapi.yaml
```

It serves every endpoint at **`http://localhost:4010`**, with the envelope, examples and error shapes from this contract. Set `VITE_API_URL` / `NEXT_PUBLIC_API_URL` to that address and `USE_MOCK=false`. When the backend is live, change only the URL to `http://localhost:8000`.

To get a specific response, send a `Prefer` header:

| Header | You get |
| :--- | :--- |
| `Prefer: code=404` | The 404 envelope. Works with any status listed for that endpoint. |
| `Prefer: example=failed` | The AI-down extraction, on `POST /api/documents/{id}/extract` |
| `Prefer: example=fallback` | The rule-based fallback extraction (low confidence) |
| `Prefer: example=ai_down` | `ai: "unavailable"` from `GET /api/health`, for the banner |
| `Prefer: code=422, example=missing_info` | `422 MISSING_REQUIRED_INFO` from `/transition` |
| `Prefer: example=received` | On `GET` / `PATCH /api/victim/case`: a case still `received`, with every §3.5 field editable |
| `Prefer: code=409` | On `PATCH /api/victim/case`: `409 CASE_LOCKED` |
| `Prefer: example=no_answer` | On `POST /api/victim/chat/messages`: the assistant can't answer and passes the question to staff |
| `Prefer: example=passages_only` | On `POST /api/victim/chat/messages`: the AI model is down, so only bluebook passages come back |
| `Prefer: example=refused` | On `POST /api/victim/chat/messages`: the victim asked about other people, and nothing is revealed |

**What the mock does not do:**
- It doesn't remember anything. A `POST` or `PATCH` returns the example, not your data.
- It accepts any bearer token, but a request with no token gets `401`.
- It doesn't filter by role or bank. Separation is the real backend's job (backend-plan §5).
- An invalid body returns `422` with the contract's example error, not the field that actually failed.

---

## 10. How to update this file

1. Need a new endpoint or field? **File an `XREQ`** in [AGENTS.md](../AGENTS.md) with the exact JSON.
2. Backend implements it, updates the endpoint's status in §5, and marks the `XREQ` `[RESOLVED]`.
3. Once Frontend has checked the integration, set the status to `LIVE`.
4. **Change [openapi.yaml](openapi.yaml) in the same PR** and run `npx -y @redocly/cli@2.78.0 lint docs/openapi.yaml`. It must say the description is valid.
5. Agents: load `.claude/skills/openapi-spec-generation` before editing this file. Once the backend exists, keep both files in sync with its `/openapi.json`.

### Changelog

| Version | Date | Change |
| :--- | :--- | :--- |
| 0.3.0 | 2026-11-14 | Case assistant (RAG, D14): victim chat (§6.7), staff chat view and reply, and per-bank bluebook management (§6.8); rules in §3.6; AI interface in §7.2. New: `flags.victim_question_pending`, `rag` in health, chat and bluebook audit actions. Additive only. |
| 0.2.0 | 2026-11-14 | Victim self-service (§3.5, §6.7): `POST /api/victim/session`, `GET`/`PATCH /api/victim/case`, and staff `POST /api/cases/{id}/victim-access`. Intake now also returns `access_code`. New: error `CASE_LOCKED`, actor type `victim`, audit action `case.access_code_issued`. Additive only; nothing existing was renamed or removed. |
| 0.1.1 | 2026-11-14 | Added the machine-readable [openapi.yaml](openapi.yaml) and the no-backend mock (§9.1). Login can now return `429 RATE_LIMITED`. Named Galib as the AI owner (§7). |
| 0.1.0 | 2026-11-14 | First full contract for the fraud-relief case system. Login `role` changed from `admin` to `operator` / `supervisor` / `bank_viewer`, and `bank_id` added to the user. |
