# Backend, Database & DevOps Plan — Fraud Relief Case System

**Owner** Asif (Backend / Database / DevOps) · **Status** draft v0.4 · **Updated** 2026-11-14
**Team** Backend: Asif, Anim · AI: Galib · Frontend: Minhaz
**Contract** [docs/API_SPEC.md](../API_SPEC.md) · **Progress log** [contributors/asif/WORK_LOG.md](../../contributors/asif/WORK_LOG.md)

This file explains *why* the backend is built the way it is. The API contract shows *what* it exposes. When the two disagree, fix one of them in the same PR.

> **v0.4:** where this plan and [backend-development-guide.md](backend-development-guide.md) disagree, **the guide wins**.

---

## 1. The brief, in short

**Problem.** Five regional banks share one operations center for fraud-victim relief cases. Each case runs 6–12 months:

Received → Verified → Account Check → Notice Published → Payout Review → Closed

Today's pain points:
- intake is on paper and by phone
- deadlines get missed
- case volume spikes after scam waves
- knowledge is lost when staff leave
- **each bank's data must stay separate**

The process appears modelled on Japan's "furikome" fraud relief law:
1. The bank holding the fraudster's account freezes it.
2. A public notice runs.
3. The remaining balance is shared among that account's victims.

That's why **D1** ties a case to the receiving bank, and why "same account in many cases" matters: several victims of one account share one payout.

**Users.** Operator, Supervisor, Bank viewer (own bank only), Victim (public web form).

**Rules that shape the backend:**
- Synthetic data only: at least 30 cases and 10 documents.
- The AI never makes the final decision about a victim's money.
- We must explain what happens when the AI is wrong or down.
- The app runs from one command or is deployed online.

**Where backend work earns points:**

| Area | Points | How this plan targets it |
| :--- | :--- | :--- |
| Working demo | 25 | one-command run, deployment, seeded data, backup |
| AI quality & safety | 20 | §6 |
| Security & data separation | 15 | §5 |

**Penalties to avoid:**
- crashed demo with no backup: −10
- accuracy numbers we didn't measure: −10
- any real personal data: disqualification

---

## 2. Decisions

Status: **Agreed** = follows directly from the brief · **Proposed** = needs a yes at kickoff.

| ID | Decision | Why | Status |
| :--- | :--- | :--- | :--- |
| D1 | A case belongs to the bank holding the account the money was sent to (`cases.bank_id`). | That bank checks and freezes the account. It also keeps shared-account matching inside one bank, so the matching never crosses banks. | Proposed |
| D2 | Operators and supervisors are center staff who see all banks. Bank viewers see only their own bank, read-only. | The center serves all five banks; the brief only fences bank viewers. Every case view is audited. | Proposed |
| D3 | The AI only suggests. Output goes to `ai_extractions`, and only a person's "accept" copies values onto the case. | Brief: "a human decides". | Agreed |
| D4 | Closing a case as `paid_out` or `rejected` is supervisor-only. | A second person on every money decision. | Proposed |
| D5 | Bank separation is enforced in three layers: token-scoped API queries, Postgres row-level security (RLS), and 404 (not 403) for cross-bank access. IDs are UUIDs. | Even a missing filter in code can't leak another bank's data. It's the answer to judge question 1. | Agreed |
| D6 | Stack: FastAPI, Postgres 16, SQLModel (built on SQLAlchemy 2, as the repo's `fastapi` skill recommends), Alembic, our own login with opaque session tokens (D15), and Docker Compose. | Fits the committed skills. One command runs everything. We control RLS directly. Supabase would add a heavy local stack. | Proposed |
| D7 | The AI call is synchronous with a 20 s timeout. On failure: rule-based fallback, then `failed`. An AI failure is never an HTTP error. | The demo can't hang, and there is always a manual path. | Agreed |
| D8 | The audit log is append-only. The app's DB role can only `INSERT` and `SELECT` it, and a trigger blocks `UPDATE` and `DELETE`. | "Who did what and when" has to be trustworthy. | Agreed |
| D9 | One history trail: `audit_log`. `cases` also stores `status_changed_at` and `closed_at` so metrics are fast. | No second history table to keep in sync. | Agreed |
| D10 | Uploaded files are stored in Postgres in a separate `document_contents` table (1:1 with `documents`), loaded only by the download endpoint. | Free tiers may have no persistent disk; the database also gives RLS and backups. | Agreed |
| D11 | A `closed` case is read-only. Edits, uploads, extractions, extraction reviews and transitions are refused with `409 CASE_CLOSED`. Notes are still allowed. | Closed cases are the record of a money decision, and the spec has no rule for them yet. This needs a new error code in API_SPEC (see §11). | Proposed |
| D12 | Every write to a case sends `expected_version`; SQLAlchemy optimistic locking (`version_id_col`) makes the check atomic → `409 STALE_CASE`. | Stops silent overwrites. Integers survive JSON round-trips; timestamps lose precision in JavaScript. | Agreed |
| D13 | ~~Victim access codes~~, **replaced by D15**. | — | Replaced |
| D14 | Victims get a **case assistant** (RAG chatbot) inside their account (D15). Each bank has its own bluebook, and the assistant answers only from **the published bluebook of the case's bank** plus an allow-listed, non-identifying case summary. It has no tools, is read-only and makes no money promises. Questions it can't answer set `needs_staff`, and staff reply in the same thread. Retrieval runs in the backend's bank-scoped database session (pgvector + keyword search), not in AI code. | Victims wait 6–12 months and call for status updates; most process questions are answered in the bluebook. Taking the bank from the case keeps each bank's bluebook private. The minimal context keeps personal data away from the AI model, and escalation keeps a human in the loop. | Agreed (team, 2026-11-14) |
| D15 | Everyone has an account. Victims sign up and verify their email; staff and bank viewers are invited by a supervisor, who sets role and bank. Opaque session tokens in a `sessions` table give logout and instant revocation. Forgot/reset password by emailed one-time link. | Replaces access codes with one login for all; sign-up can never pick a privileged role. | Agreed (team, 2026-11-14) |
| D16 | Email costs nothing: `EMAIL_MODE=console` prints emails in development and tests; a free SMTP tier sends them in the live demo. | $0 budget. | Agreed (provider: open) |

---

## 3. Requirement → contract map

| Brief requirement | Tier | Covered by ([API_SPEC.md](../API_SPEC.md)) |
| :--- | :--- | :--- |
| Web intake form creates a case | MVP | `POST /api/intake`, `POST /api/cases` |
| Victim (optional user) checks and corrects their own report | Optional | `POST /api/victim/session`, `GET`/`PATCH /api/victim/case`, D13 |
| Team extra: victims ask a case assistant that answers from their bank's bluebook | Extra | `/api/victim/chat*`, `/api/cases/{id}/chat*`, `/api/kb/documents*`, D14 |
| Case list / board with status, deadline, owner | MVP | `GET /api/cases` → `CaseSummary` |
| Login with 3 roles | MVP | `POST /api/auth/login`, roles §2 |
| Bank A never sees Bank B | MVP | D5, §5 below |
| Audit log of who did what, when | MVP | `GET /api/audit-logs`, `GET /api/cases/{id}/history`, D8 |
| One AI feature with human review | MVP | `POST /api/documents/{id}/extract` → `POST /api/extractions/{id}/review` |
| Deadline reminders / overdue flags | Should | `deadline_state`, `GET /api/cases?assigned_to=me&deadline_state=overdue` |
| Supervisor dashboard (3–5 numbers) | Should | `GET /api/dashboard/stats` |
| AI confidence + low-confidence review queue | Should | `review_lane`, `GET /api/review-queue` |
| Multi-language intake | Nice | `victim.preferred_language` (translating the UI is frontend work) |
| Suspicious pattern (same account, many cases) | Nice | `flags.shared_account_case_count`, `GET /api/alerts/shared-accounts` |
| Export case history | Nice | `GET /api/cases/{id}/history?format=csv` |
| At least 30 cases and 10 documents, all synthetic | Rule | seed script (§7) |
| AI never decides money; plan for AI wrong or down | Rule | D3, D4, D7, §6 |
| Runs from one command | Rule | `docker compose up --build` (§7) |

---

## 4. Data model (Postgres)

Every bank-owned table carries its own `bank_id`, even when it could be found through `case_id`. That keeps the RLS policies join-free, simple and fast.

| Table | Key columns | Notes |
| :--- | :--- | :--- |
| `banks` | `id text pk` (`bank_a`…`bank_e`), `name` | Seeded, never changes |
| `users` | `id uuid`, `email unique` (lower-case), `name`, `password_hash` (argon2id), `role` (`operator`/`supervisor`/`bank_viewer`/`victim`), `bank_id → banks null`, `email_verified_at`, `is_active` | Check: `bank_id` is set exactly when `role = 'bank_viewer'`. Auth tables `sessions`, `auth_tokens`, `invitations` store token hashes only (guide §5). |
| `cases` | `id uuid`, `reference unique`, `bank_id`, `status`, `status_changed_at`, `deadline`, `assigned_operator_id`, `victim_name/phone/email/address`, `preferred_language`, `amount numeric(14,2)`, `currency char(3)`, `transfer_date`, `account_number`, `account_holder_name`, `scam_type`, `description`, `channel`, `reported_date`, `consent_at timestamptz null`, `victim_user_id → users null`, `version int`, `payout_amount`, `document_count`, `pending_extraction_count`, `closure_reason`, `created_at`, `updated_at`, `closed_at` | Check: `closed_at`/`closure_reason` are set exactly when `status = 'closed'`. `consent_at` is set for every `web_form` case, from the intake form's `consent: true`. `victim_user_id` links the case to the account of the victim (D15); `version` is the optimistic-lock counter (D12). |
| `documents` | `id`, `case_id`, `bank_id`, `filename`, `doc_type`, `mime_type`, `size_bytes`, `sha256`, `uploaded_by`, `uploaded_at` | File bytes live in `document_contents` (D10). The file type is checked from its first bytes. |
| `ai_extractions` | `id`, `document_id`, `case_id`, `bank_id`, `status`, `source`, `model`, `prompt_version`, `overall_confidence`, `review_lane`, `fields jsonb`, `missing_fields text[]`, `error jsonb`, `created_at`, `reviewed_by`, `reviewed_at`, `review_note` | `fields[].final_value` is filled in on review |
| `notes` | `id`, `case_id`, `bank_id`, `author_id`, `body`, `created_at` | Kept so knowledge survives staff turnover |
| `audit_log` | `id`, `at`, `actor_type`, `actor_id`, `actor_name`, `actor_role`, `action`, `case_id`, `bank_id`, `summary`, `changes jsonb`, `metadata jsonb` | Append-only (D8) |
| `kb_documents` | `id`, `bank_id` **not null**, `title`, `version`, `language`, `status`, `content bytea`, `sha256`, `passage_count`, `error`, `uploaded_by`, `uploaded_at`, `published_at` | One bank per document (D14). Files in Postgres, like D10. |
| `kb_passages` | `id`, `document_id`, `bank_id`, `section`, `page`, `text`, `embedding vector(N)`, `embedding_model`, `tsv tsvector` | `N` is fixed by Galib's embedding model. If the model changes, re-embed. |
| `chat_messages` | `id`, `case_id`, `bank_id`, `role`, `body`, `language`, `answer_type`, `citations jsonb`, `confidence`, `needs_staff`, `used_passage_ids uuid[]`, `model`, `prompt_version`, `latency_ms`, `feedback`, `author_id`, `created_at` | One thread per case. `cases.victim_question_pending boolean` is set by an escalation and cleared by a staff reply. |

Enums are `text` columns with `CHECK` constraints (same values as API_SPEC §3.4); no Postgres enum types.

**Case references** come from a Postgres sequence through a `SECURITY DEFINER` function `next_case_reference()` that returns e.g. `RFR-2026-00042`. The function runs before the insert, so the intake endpoint never needs `INSERT ... RETURNING` (see §5.3).

**Indexes:**

| Table | Index |
| :--- | :--- |
| `cases` | `(bank_id, status)` |
| `cases` | `(bank_id, account_number)` |
| `cases` | `(deadline) WHERE status <> 'closed'` |
| `cases` | `(assigned_operator_id) WHERE status <> 'closed'` |
| `audit_log` | `(case_id, at DESC)` |
| `audit_log` | `(bank_id, at DESC)` |
| `ai_extractions` | `(status, review_lane, created_at)` |
| `kb_passages` | `(bank_id)`; GIN on `tsv`; exact vector search, no HNSW below ~1,000 passages |
| `chat_messages` | `(case_id, created_at)` |

---

## 5. Bank separation (judge question 1)

1. **Scope on every transaction.** Each request looks up its opaque session token (hashed in `sessions`) and loads the user. A SQLAlchemy `after_begin` hook runs `set_config('app.role' / 'app.user_id' / 'app.bank_id', ..., true)` at the start of every transaction, including after a commit (guide §4.2). Values are bound parameters.
2. **Row-level security on every bank-owned table:** `cases`, `documents`, `ai_extractions`, `notes`, `audit_log`, `kb_documents`, `kb_passages`, `chat_messages`.
   - Read policy: `current_setting('app.role', true) IN ('operator','supervisor') OR (current_setting('app.role', true) = 'bank_viewer' AND bank_id = current_setting('app.bank_id', true))`. The role check on the second branch matters: victim requests also set `app.bank_id`, for bluebook retrieval (item 9). Without the check, a victim session would match every case of its bank. The `true` argument makes a missing setting return null instead of raising an error, so a request with no scope sees no rows.
   - Write policies: `INSERT` and `UPDATE` on `cases`, `documents`, `ai_extractions` and `notes` are allowed only for `app.role IN ('operator','supervisor')` (plus the public intake insert below). A `bank_viewer` therefore cannot write even if an API check is missing.
   - `audit_log` is the exception: its `INSERT` policy allows every role, because merely viewing a case writes `case.viewed`, including for a `bank_viewer`. It still has no `UPDATE` or `DELETE` (D8).
   - The app connects as `app_user`, which is not the table owner and has no `BYPASSRLS`, and the tables use `FORCE ROW LEVEL SECURITY`. So the policies apply even if the code forgets a filter.
3. **Public intake can insert but never read.** It runs with `app.role = 'public'`. An insert policy allows creating a case, and no read policy matches. Postgres also applies read policies to `INSERT ... RETURNING`, so intake must not use `RETURNING`. The case reference comes from `next_case_reference()` before the insert (§4).
4. **API layer.** Repositories also filter by scope. "Doesn't exist" and "not yours" both return the same `404`.
5. **Files, totals and exports run under the same scoped session.** That covers the dashboard counts, CSV exports and alerts, so a count can't leak another bank's data either.
6. **Abuse limits.**
   - Rate-limit `POST /api/intake` per IP (`429 RATE_LIMITED`) and `POST /api/auth/login` per IP and per email (a short lockout after repeated failures). Failed logins are audited.
   - Behind Render, Railway or Vercel the client IP arrives in `X-Forwarded-For`. Read it only from the trusted proxy, or every visitor shares one limit.
   - The same applies to uploads: reject by the file's first bytes, not the filename, and keep the 10 MB cap.
   - Session tokens are opaque random strings stored as SHA-256 hashes; every request checks that the session is not revoked and the user is active. CORS origins come from `CORS_ORIGINS` and are never credentialed (bearer tokens only, no cookies). These follow ECC's `python/fastapi.md` security rules.
7. **Demo accounts.** The seeded logins share a known password (`Demo@1234`, API_SPEC §8). A public deployment may hold synthetic data only. Never load real victim data into it, and change or remove the seeded accounts before any real use.
8. **Victim accounts (D15).** A victim logs in like staff. Their scope is `app.role = 'victim'` and `app.user_id`; the only matching case policy is `victim_user_id = current_setting('app.user_id', true)`. Field locks (API_SPEC §3.5, `409 CASE_LOCKED`) are enforced in the service; closed cases are read-only (D11).
9. **Case assistant (D14).**
   - **Which bluebook:** a victim request sets `app.bank_id` from `cases.bank_id`, never from the request. The `kb_passages` policy for victims is `app.role = 'victim' AND bank_id = app.bank_id`, and the document must be `published`.
   - **Filter before ranking:** the retrieval SQL puts the bank and `published` filters in the `WHERE` clause and ranks only what's left. A closer match from another bank can therefore never be returned.
   - **Chat threads:** `chat_messages` policy is `case_id = app.case_id` for victims; staff follow the item 2 rules.
   - **What reaches the AI model:**
     - the question and up to 6 earlier messages
     - the retrieved passages
     - the allow-listed case summary (API_SPEC §3.6)

     Never names, contact details, account numbers, notes or other cases.
   - **No tools:** the model only returns text and passage IDs. It can't call endpoints or query the database.

**Proof we'll show** (pytest, run in CI and live in the demo if asked):
- `viewer@bank-a` → `GET` a `bank_b` case → `404`.
- `viewer@bank-a` → `GET /api/cases` → every row is `bank_a`.
- `viewer@bank-a` → dashboard totals equal the `bank_a`-only counts.
- **The database alone holds:** raw SQL as `app_user` with `app.bank_id = 'bank_a'` returns 0 `bank_b` rows. This proves layer 2 works even if layer 4 were removed.
- victim1 (owner of `RFR-2026-00042`) → `GET /api/cases` → `403`. Changing `amount` on that verified case → `409 CASE_LOCKED`.
- **Database alone, victim:** raw SQL as `app_user` with `app.role = 'victim'`, `app.bank_id = 'bank_b'` and `app.case_id` set returns exactly one `cases` row, and `kb_passages` rows from `bank_b` only.
- **Chatbot cross-bank test:** as a victim of a `bank_a` case, ask questions that only bank_b's bluebook answers. Each must return `no_answer`, and every retrieved passage must be from bank_a (§6).

---

## 6. AI safety and failure plan (judge questions 2 and 3)

- **The AI suggests and a person decides (D3, D4).** The AI can't change a status, and no endpoint lets it touch money.
- **Every suggestion needs a person.** Confidence below `AI_CONFIDENCE_THRESHOLD` (default 0.75) puts it in the `low_confidence` lane, which the UI highlights. Each field carries an `evidence` quote from the document so the reviewer can check it quickly.

| Failure | What happens |
| :--- | :--- |
| AI provider down, or no API key | `/api/health` reports `ai: unavailable/disabled`. Extraction falls back to rule-based patterns for amounts, dates and account numbers, always in the `low_confidence` lane. The fallback reads only text (TXT and PDFs with a text layer). **It cannot read scans or photos**, since there is no OCR. A PNG, JPG or scanned PDF ends in `failed` with `unreadable_document`, and the operator types the fields. For the demo, keep one text-layer PDF to show the fallback working. Intake, cases and status changes keep working. |
| Response slower than 20 s | Same as down. |
| Invalid JSON or unknown fields | Checked with Pydantic. Unknown fields are dropped; output that can't be parsed → `failed` with `invalid_ai_output`. |
| AI is confidently wrong | The reviewer sees the evidence and the current value, and edits. The edit is stored as AI value vs final value. |
| Instructions hidden inside a document | The AI's output is data only, checked against a schema. It can't call endpoints or change status; the worst case is a wrong suggestion that a person rejects. |

**Measuring accuracy (judge question 2):**
- Each of the ≥ 10 synthetic documents gets a hand-written correct-answer JSON.
- Split the documents into a **tuning set** (used to write and adjust prompts) and a **held-out set** (never used for tuning), with at least 4 held-out documents. Quote the held-out score as the headline number. A score measured on the documents the prompt was tuned on is inflated.
- `backend/eval/` runs the extractor over them and reports field-level accuracy (correct / total, per field) plus real failure examples. Always report the counts (e.g. 27 of 30 fields), not only a percentage, because 10 documents is a small sample.
- **We only quote numbers this script produced.** Unmeasured accuracy claims cost −10.
- **Prompt-injection test (required by the brief).** A pytest runs the injection document through extraction and asserts that no status, assignment or money field on the case changed, and that the result is still `pending_review`. Report it in the "What can go wrong" slide.
- **Time saved per case (judge question 4).** Don't claim a number we didn't measure. Time one case entered by hand against one entered with AI extraction, and quote only those timings, with the number of cases timed.
- The brief's example AI output also includes a short case `summary`. API_SPEC §7 has no summary field yet. Add one only if the AI owner wants it, through an `XREQ`.
- Document text and images go to an external AI provider. That is acceptable only because all data is synthetic. If real data is ever used, the provider and its data terms must be reviewed first.
- After the demo, the same measure comes from real reviews: the share of AI fields accepted unchanged, taken from `ai.review_accepted` audit entries.

### Case assistant (D14)

| Failure | What happens |
| :--- | :--- |
| AI model down or slower than 20 s | `answer_type: passages_only`: the top passages from the bank's bluebook, without a written answer. `/api/health` shows `rag: degraded`. |
| Embedding service down | Keyword search only (Postgres full-text on `kb_passages.tsv`). Answers still cite. |
| Nothing matches well enough (below `RAG_MIN_SCORE`) | `no_answer` + `needs_staff`: the question goes to staff instead of a guess. |
| The victim asks about other people, asks it to act, or asks for a decision ("approve my payout") | `refused`. It has no tools and no other cases in its context, so nothing can leak even if the prompt is subverted. |
| The answer is wrong | Every answer shows its citations, victims can mark it `not_helpful`, and staff see the whole thread. |
| Instructions hidden in a bluebook | Only supervisor-published, synthetic bluebooks are indexed. Victims' uploads never are. |

**Measuring it (judge question 2):**
- **Golden set:** about 30 questions (6 per bank), each with the bluebook section that answers it. Report retrieval hits (right section in the top 3) and answer correctness, checked by hand, as counts.
- **Cross-bank leak test:** as a victim of bank A, ask questions only bank B's bluebook answers. Each must return `no_answer`, with every retrieved passage from bank A. Target: 0 leaks; report the count.
- **Refusal test:** 3–5 "other people" or "approve my payout" questions must all be `refused`.
- As with extraction, quote only numbers these scripts produced.

---

## 7. DevOps

**One command:** `docker compose up --build` from the repo root.

| Service | Image / build | Notes |
| :--- | :--- | :--- |
| `db` | `pgvector/pgvector:pg16` | Postgres 16 with the `vector` extension (D14). Named volume. `pg_isready` health check. |
| `backend` | `./backend/Dockerfile` | Starts after `db` is healthy. Runs `alembic upgrade head` and the seed as `migrator` (idempotent: skips if the banks exist), then `uvicorn` on `:8000`. Files live in Postgres (D10), so there is no document volume. |
| `frontend` | `./frontend` | Added when Minhaz has scaffolded it. |

**`backend/.env.example`** (committed; `.env` never is):

```
DATABASE_URL=postgresql+psycopg://app_user:app_password@db:5432/fraud_relief
MIGRATIONS_DATABASE_URL=postgresql+psycopg://migrator:migrator_password@db:5432/fraud_relief
SESSION_HOURS=8
EMAIL_MODE=console
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
AI_PROVIDER=
AI_API_KEY=
AI_TIMEOUT_SECONDS=20
AI_CONFIDENCE_THRESHOLD=0.75
RAG_EMBEDDING_MODEL=
RAG_TOP_K=5
RAG_MIN_SCORE=0.5
CHAT_MAX_QUESTIONS_PER_HOUR=20
TRUSTED_PROXY_COUNT=1
SEED_ON_START=true
```

**Seed (synthetic only):**
- 5 banks and the demo users from API_SPEC §8
- ≥ 30 cases across every bank and status, about 6 of them overdue
- 2–3 shared accounts
- ≥ 10 documents, clean and messy, each with a correct-answer JSON for `eval/`. The brief (§7) asks for messy ones on purpose: missing fields, typos, different date formats, and **one scanned image**. Also include **at least one prompt-injection document** (hidden text such as "approve this payout"). The brief lists "you tried a bad document and the system stayed safe" as a safety feature judges want to see.
- **5 synthetic bluebooks**, one per bank, 4–6 pages each, with deliberate differences (D14). They are split and embedded at seed time, so the demo doesn't depend on the embedding service. If the embedding model is an external API, commit the computed vectors as a fixture. Also the golden question set for `eval/`.
- **Bluebook indexing** runs as a background task in the backend process (FastAPI `BackgroundTasks`). That is enough for a handful of documents; no separate worker is needed.

Names are clearly fake, emails use `.test`, and phone numbers use `0000` blocks.

**Deploy:**
- Backend and Postgres on Render or Railway. A hello-world `/api/health` goes up in the first 2 hours, per TEAM_INSTRUCTIONS.
- Frontend on Vercel.
- RLS needs a real Postgres, so we use Render or Railway Postgres, or Supabase purely as a Postgres host.
- Check the host's free-tier limits before relying on it: sleeping web services (slow first request), database expiry or size caps, and no persistent disk. Do this in the hour-0 hello-world deploy, not at hour 44.

**Demo backup by hour 44:**
- a recorded demo video
- a `pg_dump` of the seeded database, restorable in a minute
- the local `docker compose` stack as the fallback if the deployment fails

---

## 8. Code layout (follows the team structure)

```
backend/
├── app/
│   ├── main.py          # FastAPI app, CORS, response envelope, error handlers
│   ├── config.py        # settings from env
│   ├── db.py            # engine, per-request scoped session (set_config for RLS)
│   ├── security.py      # password hashing, session tokens, current-user dependency
│   ├── routers/         # health, auth, intake, cases, documents, extractions, dashboard, audit, victim, chat, kb
│   ├── services/        # case_workflow (transitions, deadlines), audit, ai_extraction (+ rules fallback), rag (Galib) + retrieval and case context (backend), storage, seed
│   ├── models/          # SQLModel tables + Pydantic schemas (mirror API_SPEC §4)
│   └── prompts/         # versioned AI prompts (owned by the AI owner, per AGENTS.md §4.3)
├── migrations/          # Alembic: tables, enums, RLS policies, audit trigger, app_user grants
├── tests/               # pytest: bank separation, transitions, review flow, AI-down path
├── eval/                # labelled synthetic documents + accuracy script; chatbot golden questions + leak test
├── Dockerfile
└── .env.example
docker-compose.yml       # repo root
```

---

## 9. Milestones vs brief checkpoints

| Hour | Brief checkpoint | Backend deliverable |
| :--- | :--- | :--- |
| 0–2 | Scope, wireframes, data model | API contract v0.2.0 ✅, OpenAPI file + no-backend mock ✅, this plan ✅, skeleton, `docker compose` with Postgres, `/api/health` deployed |
| 2–10 | Intake + DB working; AI tried on a few documents | Migrations with RLS and the audit trigger **from the first migration**. Seed. Login. Intake and cases endpoints live. AI interface stub + rule-based fallback. |
| 10–14 | One end-to-end happy path | Upload → extract → review → case updated |
| 14–30 | Roles, separation, audit | Status changes and deadlines, review queue, dashboard, audit endpoints, separation tests passing |
| 36 | Feature freeze | Bug fixes only |
| 44 | Deployed, backup video, slides | Deployment verified, `pg_dump` snapshot, eval numbers final |

The brief schedules separation at hour 30. We build it at hours 2–10 because adding RLS to code that already works means rewriting queries.

**Case assistant timing (D14).** It's an extra, not an MVP item.
- Galib can build `split_bluebook`, `embed` and `answer` against the seeded bluebooks at any time.
- Backend wires the endpoints only after the hour-14 happy path works.
- If it isn't stable by the hour-36 freeze, cut it. Nothing in the MVP depends on it.

---

## 10. Open questions (decide at kickoff)

Still open:

1. **D1, D2, D4, D6, D10, D11, D12, D13** are all **Proposed** and need a team yes. D2 matters most: do operators see all banks, or only banks assigned to them? It bears directly on the brief's data-separation requirement.
2. **D6:** FastAPI + Postgres, or Supabase?
3. Which AI provider, and who puts the key in `.env`? The provider must handle images, because scanned paper forms are the main demo flow.
4. How should an account be identified? Banks usually use branch + account number. With only `account_number`, the shared-account alert can match unrelated accounts at the same bank. Consider adding `account_branch` (see §11).
5. How do Asif and Anim split backend work? Suggested split: Asif takes database, RLS, migrations, seed and devops; Anim takes the routers in API_SPEC §6.
6. **Case assistant models:** a local embedding model (no external calls, so the demo works offline) or an API? Which AI model writes the answers, and whose key?
7. **Bluebook language:** what language are the bluebooks in, and do we translate answers into the victim's language (en/ja/bn)? Translation adds risk; citations always quote the original.
8. **Reporting needs a verified account (D15)?** v0.4.0 says yes. Alternative: anonymous reports plus a later claim.
9. **Free SMTP provider** for the live demo (D16).

Resolved:

- **AI owner:** Galib owns the AI module, `backend/app/prompts/` and the labelled test set (TEAM_INSTRUCTIONS §4).
- **Frontend framework:** Next.js App Router, so the layout is `src/app/`, not `src/pages/` (TEAM_INSTRUCTIONS §4 skills list).
- **Case assistant:** victim-facing, one bluebook per bank, case-aware answers (team decision, 2026-11-14) → D14.

---

## 11. Changes this plan needs in API_SPEC

The plan can't fix these alone. The contract owner should apply them to [API_SPEC.md](../API_SPEC.md), through an `XREQ` once the contract is past v0.1.0.

**Wrong or inconsistent today**

| # | Spec location | Problem | Fix |
| :--- | :--- | :--- | :--- |
| S1 | §3.1 `due_soon` | A `received` case has a 2-day deadline and `due_soon` means "within 2 days", so every new case is `due_soon` from the start. | Use a 1-day window, or 20% of the stage length. |
| S2 | §6.3 case example | The case is `verified` with `deadline` 2026-11-19, but §6.4 shows it entered `verified` on 2026-11-05. A 5-day deadline gives 2026-11-10, and the state would be `overdue`. | Make the two examples agree. |
| S3 | §3.1 day counts | The stages add up to 87 days, but the brief says cases run 6–12 months, and the dashboard example shows 182.4 average days. Nearly every case would be overdue. | Set realistic day counts (the 60-day notice stage first) before writing the seed. |
| S4 | §2 matrix | No row for document download, although §5 and §6.5 allow all roles, including `bank_viewer` for their own bank. | Add the row. Decide whether `id_document` files are visible to bank viewers. |

**Missing in the contract**

| # | Add | Why |
| :--- | :--- | :--- |
| S5 | Error code `409 CASE_CLOSED` and the closed-case rule (D11) | The spec doesn't say what a closed case allows. |
| S6 | `updated_at` on write requests and error `409 STALE_CASE` (D12) | Stops silent overwrites. |
| S7 | `consent` is stored (`consent_at`, §4) | The intake form requires consent, but nothing stored it. |
| S8 | ~~Rate limit and lockout on `POST /api/auth/login` (§5.6)~~ | **Done** in API_SPEC v0.1.1 (`429 RATE_LIMITED` on login). |
| S9 | Say `GET /api/cases/{id}` writes an audit entry, so the frontend must not poll it | Polling would flood the audit log. |
| S10 | State whether an operator may unassign a case owned by someone else | `operator_id: null` is ambiguous. |
| S11 | Optional `account_branch` (open question 4) | Reduces false shared-account matches. |
