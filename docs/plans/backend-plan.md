# Backend, Database & DevOps Plan — Fraud Relief Case System

**Owner** Asif (Backend / Database / DevOps) · **Status** draft v0.1.1 · **Updated** 2026-11-14
**Team** Backend: Asif, Anim · AI: Galib · Frontend: Minhaz
**Contract** [docs/API_SPEC.md](../API_SPEC.md) · **Progress log** [contributors/asif/WORK_LOG.md](../../contributors/asif/WORK_LOG.md)

This file explains *why* the backend is built the way it is. The API contract shows *what* it exposes. When the two disagree, fix one of them in the same PR.

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
| D6 | Stack: FastAPI, Postgres 16, SQLModel (built on SQLAlchemy 2, as the repo's `fastapi` skill recommends), Alembic, our own JWT login with seeded users, and Docker Compose. | Fits the committed skills. One command runs everything. We control RLS directly. Supabase would add a heavy local stack. | Proposed |
| D7 | The AI call is synchronous with a 20 s timeout. On failure: rule-based fallback, then `failed`. An AI failure is never an HTTP error. | The demo can't hang, and there is always a manual path. | Agreed |
| D8 | The audit log is append-only. The app's DB role can only `INSERT` and `SELECT` it, and a trigger blocks `UPDATE` and `DELETE`. | "Who did what and when" has to be trustworthy. | Agreed |
| D9 | One history trail: `audit_log`. `cases` also stores `status_changed_at` and `closed_at` so metrics are fast. | No second history table to keep in sync. | Agreed |
| D10 | Uploaded files go on a Docker volume at `<storage>/<bank_id>/<document_id>`. Paths are never exposed, and files are served only through the logged-in download endpoint. | Simple, and it respects bank separation. | Agreed |

---

## 3. Requirement → contract map

| Brief requirement | Tier | Covered by ([API_SPEC.md](../API_SPEC.md)) |
| :--- | :--- | :--- |
| Web intake form creates a case | MVP | `POST /api/intake`, `POST /api/cases` |
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
| `users` | `id uuid`, `email unique`, `name`, `password_hash`, `role`, `bank_id → banks null` | Check: `bank_id` is set exactly when `role = 'bank_viewer'` |
| `cases` | `id uuid`, `reference unique`, `bank_id`, `status`, `status_changed_at`, `deadline`, `assigned_operator_id`, `victim_name/phone/email/address`, `preferred_language`, `amount numeric(14,2)`, `currency char(3)`, `transfer_date`, `account_number`, `account_holder_name`, `scam_type`, `description`, `channel`, `reported_date`, `closure_reason`, `created_at`, `updated_at`, `closed_at` | Check: `closed_at`/`closure_reason` are set exactly when `status = 'closed'` |
| `documents` | `id`, `case_id`, `bank_id`, `filename`, `doc_type`, `mime_type`, `size_bytes`, `sha256`, `storage_path`, `uploaded_by`, `uploaded_at` | `storage_path` is never returned by the API |
| `ai_extractions` | `id`, `document_id`, `case_id`, `bank_id`, `status`, `source`, `model`, `prompt_version`, `overall_confidence`, `review_lane`, `fields jsonb`, `missing_fields text[]`, `error jsonb`, `created_at`, `reviewed_by`, `reviewed_at`, `review_note` | `fields[].final_value` is filled in on review |
| `notes` | `id`, `case_id`, `bank_id`, `author_id`, `body`, `created_at` | Kept so knowledge survives staff turnover |
| `audit_log` | `id`, `at`, `actor_type`, `actor_id`, `actor_name`, `actor_role`, `action`, `case_id`, `bank_id`, `summary`, `changes jsonb`, `metadata jsonb` | Append-only (D8) |

Enums are Postgres enum types with the same values as API_SPEC §3.4.

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

---

## 5. Bank separation (judge question 1)

1. **The token carries scope.** The JWT holds `user_id`, `role` and `bank_id`. Each request runs in one transaction that starts with `SELECT set_config('app.role', :role, true), set_config('app.bank_id', :bank_id, true)`. The values are bound as parameters, never built into SQL strings.
2. **Row-level security on every bank-owned table:** `cases`, `documents`, `ai_extractions`, `notes`, `audit_log`.
   - Read policy: `current_setting('app.role') IN ('operator','supervisor') OR bank_id = current_setting('app.bank_id')`.
   - The app connects as `app_user`, which is not the table owner and has no `BYPASSRLS`, and the tables use `FORCE ROW LEVEL SECURITY`. So the policies apply even if the code forgets a filter.
3. **Public intake can insert but never read.** It runs with `app.role = 'public'`. An insert policy allows creating a case, and no read policy matches.
4. **API layer.** Repositories also filter by scope. "Doesn't exist" and "not yours" both return the same `404`.
5. **Files, totals and exports run under the same scoped session.** That covers the dashboard counts, CSV exports and alerts, so a count can't leak another bank's data either.
6. **Login and tokens.** Rate-limit failed logins per IP and per email (`429 RATE_LIMITED`). Tokens are HS256 JWTs, and decoding checks the algorithm, expiry, issuer and audience. CORS origins come from `CORS_ORIGINS` and are never credentialed (bearer tokens only, no cookies). These follow ECC's `python/fastapi.md` security rules.

**Proof we'll show** (pytest, run in CI and live in the demo if asked):
- `viewer@bank-a` → `GET` a `bank_b` case → `404`.
- `viewer@bank-a` → `GET /api/cases` → every row is `bank_a`.
- `viewer@bank-a` → dashboard totals equal the `bank_a`-only counts.
- **The database alone holds:** raw SQL as `app_user` with `app.bank_id = 'bank_a'` returns 0 `bank_b` rows. This proves layer 2 works even if layer 4 were removed.

---

## 6. AI safety and failure plan (judge questions 2 and 3)

- **The AI suggests and a person decides (D3, D4).** The AI can't change a status, and no endpoint lets it touch money.
- **Every suggestion needs a person.** Confidence below `AI_CONFIDENCE_THRESHOLD` (default 0.75) puts it in the `low_confidence` lane, which the UI highlights. Each field carries an `evidence` quote from the document so the reviewer can check it quickly.

| Failure | What happens |
| :--- | :--- |
| AI provider down, or no API key | `/api/health` reports `ai: unavailable/disabled`. Extraction falls back to rule-based patterns for amounts, dates and account numbers, always in the `low_confidence` lane. If nothing matches → `failed`, and the operator types the fields. Intake, cases and status changes keep working. |
| Response slower than 20 s | Same as down. |
| Invalid JSON or unknown fields | Checked with Pydantic. Unknown fields are dropped; output that can't be parsed → `failed` with `invalid_ai_output`. |
| AI is confidently wrong | The reviewer sees the evidence and the current value, and edits. The edit is stored as AI value vs final value. |
| Instructions hidden inside a document | The AI's output is data only, checked against a schema. It can't call endpoints or change status; the worst case is a wrong suggestion that a person rejects. |

**Measuring accuracy (judge question 2):**
- Each of the ≥ 10 synthetic documents gets a hand-written correct-answer JSON.
- `backend/eval/` runs the extractor over them and reports field-level accuracy (correct / total, per field) plus real failure examples.
- **We only quote numbers this script produced.** Unmeasured accuracy claims cost −10.
- After the demo, the same measure comes from real reviews: the share of AI fields accepted unchanged, taken from `ai.review_accepted` audit entries.

---

## 7. DevOps

**One command:** `docker compose up --build` from the repo root.

| Service | Image / build | Notes |
| :--- | :--- | :--- |
| `db` | `postgres:16-alpine` | Named volume. `pg_isready` health check. |
| `backend` | `./backend/Dockerfile` | Starts after `db` is healthy. Runs `alembic upgrade head`, then the seed (idempotent: skips if the banks exist), then `uvicorn` on `:8000`. Document storage volume. |
| `frontend` | `./frontend` | Added when Minhaz has scaffolded it. |

**`backend/.env.example`** (committed; `.env` never is):

```
DATABASE_URL=postgresql+psycopg://app_user:app_password@db:5432/fraud_relief
JWT_SECRET=change-me
JWT_EXPIRE_HOURS=8
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
AI_PROVIDER=
AI_API_KEY=
AI_TIMEOUT_SECONDS=20
AI_CONFIDENCE_THRESHOLD=0.75
DOCUMENT_STORAGE_DIR=/data/documents
SEED_ON_START=true
```

**Seed (synthetic only):**
- 5 banks and the demo users from API_SPEC §8
- ≥ 30 cases across every bank and status, about 6 of them overdue
- 2–3 shared accounts
- ≥ 10 documents, clean and messy, each with a correct-answer JSON for `eval/`

Names are clearly fake, emails use `.test`, and phone numbers use `0000` blocks.

**Deploy:**
- Backend and Postgres on Render or Railway. A hello-world `/api/health` goes up in the first 2 hours, per TEAM_INSTRUCTIONS.
- Frontend on Vercel.
- RLS needs a real Postgres, so we use Render or Railway Postgres, or Supabase purely as a Postgres host.

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
│   ├── security.py      # password hashing, JWT, current-user dependency
│   ├── routers/         # health, auth, intake, cases, documents, extractions, dashboard, audit
│   ├── services/        # case_workflow (transitions, deadlines), audit, ai_extraction (+ rules fallback), storage, seed
│   ├── models/          # SQLModel tables + Pydantic schemas (mirror API_SPEC §4)
│   └── prompts/         # versioned AI prompts (owned by the AI owner, per AGENTS.md §4.3)
├── migrations/          # Alembic: tables, enums, RLS policies, audit trigger, app_user grants
├── tests/               # pytest: bank separation, transitions, review flow, AI-down path
├── eval/                # labelled synthetic documents + accuracy script
├── Dockerfile
└── .env.example
docker-compose.yml       # repo root
```

---

## 9. Milestones vs brief checkpoints

| Hour | Brief checkpoint | Backend deliverable |
| :--- | :--- | :--- |
| 0–2 | Scope, wireframes, data model | API contract v0.1.1 ✅, OpenAPI file + no-backend mock ✅, this plan ✅, skeleton, `docker compose` with Postgres, `/api/health` deployed |
| 2–10 | Intake + DB working; AI tried on a few documents | Migrations with RLS and the audit trigger **from the first migration**. Seed. Login. Intake and cases endpoints live. AI interface stub + rule-based fallback. |
| 10–14 | One end-to-end happy path | Upload → extract → review → case updated |
| 14–30 | Roles, separation, audit | Status changes and deadlines, review queue, dashboard, audit endpoints, separation tests passing |
| 36 | Feature freeze | Bug fixes only |
| 44 | Deployed, backup video, slides | Deployment verified, `pg_dump` snapshot, eval numbers final |

The brief schedules separation at hour 30. We build it at hours 2–10 because adding RLS to code that already works means rewriting queries.

---

## 10. Open questions (decide at kickoff)

1. **D2:** do operators see all banks, or only banks assigned to them?
2. **D6:** FastAPI + Postgres, or Supabase?
3. ~~Who owns the AI module?~~ **Galib** owns the AI module and the labelled test set (API_SPEC §7). Still open: which AI provider (its key goes in `.env`).
4. Which frontend framework? It decides the `frontend/` layout: Next.js App Router uses `src/app/`, not `src/pages/`.
5. How do Asif and Anim split backend work? Suggested split: Asif takes database, RLS, migrations, seed and devops; Anim takes the routers in API_SPEC §6.
