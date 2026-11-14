# Backend Development Guide

**Team** Asif (lead), Anim · **Status** v1.1 (revised after review) · **Updated** 2026-11-14
**Contract** [API_SPEC.md](../API_SPEC.md) + [openapi.yaml](../openapi.yaml) · **Why** [backend-plan.md](backend-plan.md) · **AI side** [Galib's suggestions](../../contributors/galib/suggested_by_backend_team.md)

How we build and test the backend. The contract says **what** the API does, the plan says **why**, and this guide says **how**. Devops (deployment, the full Docker setup) comes after the backend; only the dev database and one early hello-world deploy are covered here.

**Before writing code, both developers and their coding agents:**
- read §1–§5;
- load the skills `fastapi`, `python-testing-patterns`, `supabase-postgres-best-practices` and `openapi-spec-generation` (AGENTS.md §3.3);
- follow ECC's `python/*` rules where this guide doesn't say otherwise.

---

## 1. Who does what

### 1.1 Areas

| | **Asif** | **Anim** |
| :--- | :--- | :--- |
| **Owns** | Database (migrations, RLS, triggers), request scoping (`db.py`), audit, documents and AI, victim side, contract changes | App framework (`create_app`, errors, response envelope, middleware), security and login (`security.py` + auth endpoints), seed data, cases domain, dashboard, staff chat, bluebook management, smoke script |
| **Endpoints** (API_SPEC §5) | 6.4 history and audit log · 6.5 documents, extraction, review, review queue · 6.3 victim access code · 6.7 victim session, victim case, victim chat | 6.1 login · 6.2 health, banks, users · 6.3 intake, cases list/create/get/patch, transition, assign, notes · 6.6 dashboard, alerts · 6.8 staff chat, bluebooks |
| **Count** | 15 endpoints + database foundation | 21 endpoints + app framework |

### 1.2 Files (who may edit what)

| Path | Owner | Rule for the other person |
| :--- | :--- | :--- |
| `backend/migrations/**`, `app/db.py` | Asif | **Only Asif writes migrations.** Need a column? Message Asif or open an `XREQ`. Two people writing migrations at once creates two Alembic "heads". |
| `app/services/audit.py`, `app/services/victim_access.py`, `app/services/extraction.py`, `app/services/retrieval.py` | Asif | Call them; don't change them. |
| `app/main.py`, `app/errors.py`, `app/responses.py`, `app/middleware/**`, `app/config.py` | Anim | Asif adds router lines to `main.py` through small PRs. |
| `app/security.py`, `app/seed.py` | Anim | Asif reviews: `Principal` feeds the database scope, and the seed must respect the database rules. |
| `app/services/case_workflow.py` (status changes, deadlines, missing fields) | Anim | Asif calls it from review and victim edits. |
| `app/routers/<area>.py`, `app/services/<area>.py`, `app/repositories/<area>.py`, `app/models/<area>.py` | Owner of the area (§1.1) | One file per area, so you rarely touch the same file. |
| `app/services/ai_extraction.py`, `app/services/rag.py`, `app/prompts/**` | Galib | Backend only calls them (API_SPEC §7). |
| `tests/**` | Whoever writes the code under test | Shared fixtures in `tests/conftest.py`: Anim. Database-rule fixtures: Asif. |
| `docs/API_SPEC.md`, `docs/openapi.yaml` | Asif | Anim proposes changes, Asif applies them. Update both files together, **through a PR with one approval** (§9). |

---

## 2. Phases and timeline

Hours count from the hackathon start. The 🚦 lines are gates: don't start the next phase until the gate passes.

### Phase 0: Agree (hours 0–2, together)

| ID | Task | Owner | Done when |
| :--- | :--- | :--- | :--- |
| P0.1 | Apply the "before coding" contract changes in §10 (C1–C4, C7, C12) | Asif | API_SPEC + openapi v0.4.0 merged through a PR; the lint check is clean |
| P0.2 | Agree the shared interfaces in §4.3 (signatures only) | Both | Both say yes; stub files committed |
| P0.3 | Dev database running on each machine (§3.2) | Each | `psql` connects as `migrator` and as `app_user` |
| P0.4 | `backend/pyproject.toml`, dependencies, `fastapi dev` runs a hello-world `/api/health` | Anim | `curl localhost:8000/api/health` returns the envelope |
| P0.5 | **Recommended (30 min):** deploy that hello-world to Render or Railway to find hosting limits early (sleeping service, database size and expiry). Full devops comes later. | Asif | A public URL returns `/api/health` |

### Phase 1: Foundation (hours 2–6, in parallel)

Only what the MVP needs. Chat, vector search and the victim-only database rules are built in Phase 4.

| ID | Task | Owner | Depends on |
| :--- | :--- | :--- | :--- |
| A1 | Alembic with the `migrator` connection. **Migration 001 (core)**: `pgcrypto`; `banks`, `users`, `cases` (incl. `version`, counters, `victim_access_hash`/`victim_access_version`), `documents`, `document_contents`, `ai_extractions`, `notes`, `audit_log`, `idempotency_keys`, `rate_limits`; `CHECK` constraints instead of enum types; indexes | Asif | P0.3 |
| A2 | **Migration 002**: RLS policies + `FORCE` + grants for those tables, append-only audit trigger, `next_case_reference()` (with `SET search_path`), counter triggers, `system` scope policies | Asif | A1 |
| A3 | `app/db.py`: engine and pool; `SessionDep` that **commits before the response is sent** (§4.3); `short_tx(who)` and `system_session()` that re-apply the scope; `update_if_version()` | Asif | A1 |
| A4 | `app/services/audit.py` (`record()`) and `app/services/victim_access.py` (`new_code()`, `hash_code()`) | Asif | A3 |
| A5 | Database-rule test suite (§7.4) | Asif | A2, N6 |
| N1 | `create_app()`, settings (`pydantic-settings`), CORS from env, router registry | Anim | P0.4 |
| N2 | `errors.py` (`ApiError` + handlers, 422 converted to the envelope, 404/405, 500 with a request ID) and `responses.py` (`ok()`, `Page`, pagination parameters, `Money` type) | Anim | N1 |
| N3 | `app/security.py`: argon2id hashing, JWT (alg/exp/iss/aud checked), `Principal`, role dependencies; refuses to start with a weak `JWT_SECRET` | Anim | P0.2 |
| N4 | Middleware: request ID, structured logs with redaction, duplicate protection (§4.4 rule 8), rate limiter backed by Postgres | Anim | N2, A1 |
| N5 | `GET /api/health` (database ping, `ai`, `rag`) | Anim | N1, A3 |
| N6 | Seed (`app/seed.py`): banks, demo users, 30+ cases across all banks and statuses, 10+ documents with contents, demo victim codes, sample extractions. Idempotent. | Anim | A2 |
| N7 | Test harness: `conftest.py` with **explicit test settings** (§7.2), `client`, `login_as(role)`, factories, reset of rate-limit and duplicate-protection tables before each test | Anim | N6 |

### Phase 2: MVP endpoints (hours 6–14)

| ID | Task | Owner |
| :--- | :--- | :--- |
| N8 | `POST /api/auth/login` (rate limit, audit), `GET /api/auth/me` | Anim |
| N9 | `GET /api/banks`, `GET /api/users` | Anim |
| N10 | `app/services/case_workflow.py`: allowed transitions, deadlines, `deadline_state`, missing fields, edit rules | Anim |
| N11 | `GET /api/cases` (filters, sorting, pagination, flags from counters), `GET /api/cases/{id}` (+ deduplicated `case.viewed` audit) | Anim |
| N12 | `POST /api/intake` (calls `victim_access.new_code()`), `POST /api/cases`, `PATCH /api/cases/{id}` (edit rules C1, atomic version check C3, field-by-field audit) | Anim |
| N13 | `POST /api/cases/{id}/transition`, `POST /api/cases/{id}/assign` (both use the version check) | Anim |
| A6 | `GET /api/cases/{id}/history` (JSON), `GET /api/audit-logs` | Asif |
| A7 | `POST /api/cases/{id}/documents` (file type checked from its first bytes, 10 MB cap), `GET /api/documents/{id}/file` (download only, `nosniff`) | Asif |
| A8 | AI extraction: Galib's `extract_fields()` stub, rule-based fallback, runner (timeout, concurrency cap, **AI call outside any DB transaction**), `POST …/extract`, `GET /api/extractions/{id}` | Asif |
| A9 | `POST /api/extractions/{id}/review` (atomic: version check + fields through `case_workflow` + `final_value` + audit in one transaction) | Asif |

🚦 **Hour-14 gate (the brief's "happy path")** — the §7.8 happy path must pass with real HTTP calls:
1. Log in.
2. Submit intake.
3. Create a case.
4. Upload a document.
5. Run extraction.
6. Accept the review.
7. Move the case to Verified.
8. Check that the audit history shows every step.

If it isn't green, both of you fix it before anything else.

### Phase 3: Should-tier and tests (hours 14–24)

| ID | Task | Owner |
| :--- | :--- | :--- |
| N14 | `POST /api/cases/{id}/notes` | Anim |
| N15 | `GET /api/dashboard/stats`, `GET /api/alerts/shared-accounts` | Anim |
| N16 | Permission-table tests (§7.5) | Anim |
| N17 | `backend/scripts/smoke.sh` (§7.9) | Anim |
| A10 | `GET /api/review-queue`, CSV export of history | Asif |
| A11 | Contract check through the Prism proxy (§7.7); fix every mismatch | Asif |
| A12 | AI-down, timeout and prompt-injection tests (§7.6), concurrency tests (§7.3); hook up Galib's eval script | Asif |

🚦 **Hour-24 security and contract gate.** This also covers the brief's hour-30 checkpoint.
- Database-rule, permission, concurrency and AI-failure tests are green.
- The contract check through the Prism proxy shows no errors.
- The smoke script passes.

**Extras start only after this gate.**

### Phase 4: Extras (hours 24–34, only after the hour-24 gate)

| ID | Task | Owner |
| :--- | :--- | :--- |
| A13 | **Migration 003 (victim):** victim RLS policies and the victim column-lock trigger. Endpoints: `POST /api/cases/{id}/victim-access`, `POST /api/victim/session`, `GET`/`PATCH /api/victim/case` | Asif |
| A14 | **Migration 004 (assistant):** `vector` extension, `kb_documents`, `kb_passages`, `chat_messages` + their database rules. Victim chat: `GET /api/victim/chat`, `POST /api/victim/chat/messages` (bank-scoped retrieval, Galib's `answer()`, fallbacks, escalation), feedback | Asif |
| N18 | Staff chat: `GET /api/cases/{id}/chat`, `POST …/chat/reply` (clears the escalation flag) | Anim |
| N19 | Bluebooks: list, upload (background indexing with `system_session()`), publish, archive; startup cleanup for documents stuck in `processing` | Anim |

### Phase 5: Harden (hours 34–36), then freeze

- Both: bug hunt, the full smoke script, the full contract check.
- **Hour 36 is the feature freeze: bug fixes only after that.** Devops starts.

---

## 3. Setup

### 3.1 Tools

| Tool | Version | Why |
| :--- | :--- | :--- |
| Python | 3.12 | runtime |
| uv | latest | packages and venv (`fastapi` skill) |
| Git (Git Bash on Windows) | any | curl and the scripts below run in Git Bash |
| Postgres 16 + pgvector | via Docker (recommended) | dev and test database |
| Node | **22.12+** | `npx` for Prism (contract check) and Redocly CLI v2 (lint), which needs Node 22.12+ |

### 3.2 Dev database

**Option A (recommended): Docker Desktop.** Not installed on Asif's machine yet. A minimal `docker-compose.yml` with only the `db` service (image `pgvector/pgvector:pg16`) is part of P0.3. It runs an init SQL file that creates:
- `migrator`: owns the tables, used only by Alembic and the seed;
- `app_user`: what the app connects as. Not an owner, no `BYPASSRLS`;
- the databases `fraud_relief` and `fraud_relief_test`.

```bash
docker compose up -d db
```

**Option B: a local Postgres 16 install.** You must install pgvector for Postgres yourself, which is harder on Windows. Then run the same init SQL by hand.

**Option C: a free hosted Postgres that has pgvector**, one per developer. Fine for development; slower tests.

### 3.3 First run

```bash
cd backend
uv sync                                   # installs deps from uv.lock
cp .env.example .env                      # fill in the values; .env is never committed
uv run alembic upgrade head               # runs as MIGRATIONS_DATABASE_URL (migrator)
uv run python -m app.seed                 # idempotent
uv run fastapi dev                        # http://localhost:8000/docs
```

### 3.4 Dependencies

- **Runtime:** `fastapi[standard]` (a version that supports `Depends(..., scope="function")`; pin it in `uv.lock`), `sqlmodel`, `psycopg[binary]`, `alembic`, `pydantic-settings`, `pyjwt`, `pwdlib[argon2]`, `pgvector` (Phase 4)
- **Dev:** `pytest`, `pytest-cov`, `freezegun`, `ruff`

### 3.5 Environment variables (`backend/.env.example`)

```
APP_ENV=dev                               # dev | test | prod. Only changes: weak-secret check (not dev), test-DB guard (test)
DATABASE_URL=postgresql+psycopg://app_user:app_password@localhost:5432/fraud_relief
MIGRATIONS_DATABASE_URL=postgresql+psycopg://migrator:migrator_password@localhost:5432/fraud_relief
TEST_DATABASE_URL=postgresql+psycopg://app_user:app_password@localhost:5432/fraud_relief_test
TEST_MIGRATIONS_DATABASE_URL=postgresql+psycopg://migrator:migrator_password@localhost:5432/fraud_relief_test
JWT_SECRET=                               # 32+ random characters; the app refuses to start outside dev if weak
JWT_ISSUER=fraud-relief-api
JWT_AUDIENCE=fraud-relief-web
JWT_EXPIRE_HOURS=8
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
AI_PROVIDER=
AI_API_KEY=
AI_MODE=live                              # live | off (off = test the AI-down path)
AI_TIMEOUT_SECONDS=20
AI_MAX_CONCURRENT=4
AI_CONFIDENCE_THRESHOLD=0.75
RAG_EMBEDDING_MODEL=
RAG_TOP_K=5
RAG_MIN_SCORE=0.5
CHAT_MAX_QUESTIONS_PER_HOUR=20
IDEMPOTENCY_TTL_HOURS=24
TRUSTED_PROXY_COUNT=0
```

---

## 4. Architecture and code rules

### 4.1 Layout

Follows the team structure (`routers/`, `services/`, `models/`) and adds `repositories/` for database access.

```
backend/
├── app/
│   ├── main.py            # create_app(): middleware, error handlers, routers
│   ├── config.py          # Settings (pydantic-settings)
│   ├── db.py              # engine, SessionDep, short_tx(), system_session(), update_if_version()
│   ├── security.py        # hashing, JWT, Principal, role dependencies
│   ├── errors.py          # ApiError, ErrorCode, exception handlers
│   ├── responses.py       # ok(), Page, pagination/sort params, Money type
│   ├── middleware/        # request_id.py, logging.py, idempotency.py, rate_limit.py
│   ├── routers/           # HTTP only: auth, reference, intake, cases, documents, extractions, audit, dashboard, victim, chat, kb
│   ├── services/          # business rules, transactions, audit calls (one file per area)
│   ├── repositories/      # SQL only, one file per table group
│   ├── models/            # tables.py (SQLModel tables) + one schemas file per area (requests/responses)
│   ├── prompts/           # Galib
│   └── seed.py
├── migrations/            # Alembic (written by hand for RLS, triggers, grants, extensions)
├── tests/                 # unit/, api/, rls/, permissions/, contract/, ai/, concurrency/
├── scripts/smoke.sh
├── eval/                  # Galib's labelled docs and golden questions
├── pyproject.toml
└── .env.example
```

### 4.2 Layers: what may call what

```
router  →  service  →  repository  →  database
              ↘ audit.record()   ↘ case_workflow   ↘ AI functions (never inside a DB transaction)
```

| Layer | Does | Never does |
| :--- | :--- | :--- |
| **Router** | Parses input (Pydantic), picks the dependencies, calls **one** service function, wraps the result in `ok()` | Business rules, SQL, try/except for flow control |
| **Service** | Rules, permission checks beyond the role, audit, transaction boundaries, mapping database rows to response schemas | HTTP objects (`Request`, `Response`) |
| **Repository** | SQL through SQLModel. **Always** runs in a scoped session. Explicit column lists for big tables. | Business decisions, commits |
| **Models** | Tables, plus request schemas (`extra="forbid"`) and response schemas that mirror API_SPEC §4 exactly | Logic |

### 4.3 Shared interfaces (agree in P0.2, then don't break them)

```python
# app/security.py (Anim)
class Principal(BaseModel):
    kind: Literal["user", "victim", "public", "system"]
    user_id: UUID | None; role: Role | None; bank_id: str | None; case_id: UUID | None; name: str
    def actor(self) -> Actor: ...                       # for audit entries

CurrentUser = Annotated[Principal, Depends(get_current_principal)]   # any logged-in staff user
StaffUser = Annotated[Principal, Depends(require_roles(Role.operator, Role.supervisor))]
SupervisorUser = Annotated[Principal, Depends(require_roles(Role.supervisor))]
VictimUser = Annotated[Principal, Depends(get_victim_principal)]

# app/db.py (Asif)
def get_scoped_session(who: AnyPrincipal) -> Iterator[Session]:
    """Opens a transaction, runs set_config('app.role'/'app.bank_id'/'app.case_id', ..., true) from `who`,
    yields, then COMMITS. On any exception: rollback and re-raise."""
SessionDep = Annotated[Session, Depends(get_scoped_session, scope="function")]
#   scope="function": the commit runs after the route returns but BEFORE the response is sent,
#   so a failed commit becomes an error response, never a 201 for data that wasn't saved.

def short_tx(who: Principal) -> ContextManager[Session]: ...   # NEW connection + transaction, re-applies who's scope, commits on exit
def system_session() -> ContextManager[Session]: ...           # app.role='system'; background jobs only
def update_if_version(s: Session, table, row_id: UUID, expected_version: int, values: dict) -> Row | None:
    """UPDATE ... SET ..., version = version + 1 WHERE id = :id AND version = :expected RETURNING *.
    None means: not visible (→ 404) or stale (→ 409 STALE_CASE). The caller tells them apart with one SELECT."""

# app/services/audit.py (Asif)
def record(s: Session, *, action: AuditAction, actor: Actor, summary: str, case: CaseRow | None = None,
           changes: dict[str, dict] | None = None, metadata: dict | None = None) -> None: ...

# app/errors.py (Anim)
class ApiError(Exception):
    def __init__(self, status: int, code: ErrorCode, message: str, details: dict | None = None): ...
def not_found(what: str) -> ApiError: ...          # 404 RESOURCE_NOT_FOUND, also for "another bank's"
def validation_error(field: str, message: str) -> ApiError: ...

# app/responses.py (Anim)
def ok(data, message: str = "ok") -> dict: ...
PageParams = Annotated[PageQuery, Depends()]        # page, page_size (max 100)
Money = Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2),
                  PlainSerializer(float, return_type=float, when_used="json")]   # JSON number, not a string

# app/services/case_workflow.py (Anim)
def allowed_transitions(case: CaseRow, who: Principal) -> list[CaseStatus]: ...
def check_transition(case: CaseRow, who: Principal, req: TransitionRequest) -> None: ...  # raises ApiError
def apply_fields(s: Session, case: CaseRow, changes: dict, who: Principal, expected_version: int) -> dict: ...
#   shared by PATCH, review and victim edit; uses update_if_version(); returns {field: {from, to}} for the audit
def missing_fields(case: CaseRow) -> list[MissingField]: ...
def deadline_state(case: CaseRow, now: datetime) -> DeadlineState: ...
```

### 4.4 Rules for every endpoint

1. **Contract first.** Field names, types, status codes and errors exactly as in API_SPEC and `openapi.yaml`. A different shape means a contract change (Asif, via a PR), never a quiet change.
2. **Envelope everywhere.** Success is `ok(...)`; errors are `raise ApiError(...)`. Never return an error dict by hand.
3. **Validation lives in schemas.** Use `Annotated[..., Field(...)]` / `StringConstraints`, `extra="forbid"` on requests, and no `...` (Ellipsis) defaults (`fastapi` skill).
4. **Scope is never optional.** Every query goes through `SessionDep`, `short_tx(who)` or `system_session()`; never a bare session. The repository also filters by scope. Another bank's record returns **404**, the same as a missing one.
5. **Commit before responding.** Writes go through `SessionDep` (scope `"function"`) or an explicit `short_tx(who)` that has committed before the route returns. A success status is only ever sent for committed data.
6. **Every write is audited in the same transaction** as the change, recording changed fields as `{from, to}`. If the audit insert fails, the change rolls back.
7. **Edit (PATCH) rules (C1):** a missing field stays unchanged, `null` clears it, and nested objects (`victim`) merge field by field.
8. **Edit conflicts are atomic (C3).** Every case has an integer `version`. PATCH, transition, review and victim PATCH send `expected_version`.
   - The update is one statement: `UPDATE … WHERE id = :id AND version = :expected` through `update_if_version()`. No row back → `409 STALE_CASE` (or 404 if not visible).
   - Never compare versions in Python and update afterwards: two requests can both pass that check.
   - The update and its audit entry share one transaction.
   - Why not `updated_at`? JavaScript dates drop microseconds, so frontends would get false conflicts.
9. **Duplicate protection (`Idempotency-Key`, C2)** on `POST /api/cases`, document upload, extract and chat messages. **Not** on the anonymous intake; see the last point.
   - **The key** is a client-generated UUID v4 (anything else → 422).
   - **Scope:** stored per `(principal kind + id, method + route, key)`, unique in the database. One user's key can never return another user's response.
   - **Same request:** the server stores a SHA-256 hash of the request body. The same key with a different body → `422 IDEMPOTENCY_KEY_REUSED`.
   - **Atomic:** the first request inserts the key as `in_progress` (`INSERT … ON CONFLICT DO NOTHING`) in its own short transaction. A second request while the first runs → `409 REQUEST_IN_PROGRESS`.
   - **What's stored:** the final status and body. A replay returns them with the header `Idempotent-Replayed: true`. If the first request failed with a 5xx, the key is deleted so a retry can run.
   - **Expiry:** `IDEMPOTENCY_TTL_HOURS`, cleaned up on startup.
   - **Anonymous intake:** no stored replay. Replaying would mean storing the plaintext access code. Instead, the frontend disables the submit button, intake is rate-limited per IP, and double submissions are flagged by `possible_duplicate` (C6).
10. **No network calls inside a transaction.** For AI work: read in `short_tx(who)`, call the AI with no transaction open, then write in a new `short_tx(who)` using the version check. Cap concurrent AI calls at `AI_MAX_CONCURRENT`; when the cap is reached, return the fallback immediately instead of waiting.
11. **Time, money, IDs:**
    - time: `datetime.now(UTC)`, stored as `timestamptz`
    - money: the `Money` type: `Decimal` in Python, `numeric(14,2)` in the database, and an **explicit float serializer** so the JSON has a number (Pydantic would otherwise write a string). A test checks this (§7.3).
    - IDs: UUID v4
12. **Logs:**
    - one structured line per request: request ID, route, status, duration, user ID
    - **never** passwords, tokens, access codes, `Authorization` headers, or the bodies of `/intake` and `/victim/*`
13. **Sync by default.** Use plain `def` routes with the sync SQLModel session (`fastapi` skill). Only use `async def` when every call inside is async.
14. **Every route** declares `response_model=Envelope[...]`, `summary`, `tags`, and its `responses` for error codes, so it appears correctly in Swagger.

---

## 5. Recipe: building one CRUD resource

Example: notes (`POST /api/cases/{case_id}/notes`). Every resource follows the same 8 steps.

1. **Read the contract:** the API_SPEC §6 section and the `openapi.yaml` path. Write down status codes and errors.
2. **Table** (Asif): a new table or column means a migration, the RLS policy, an index, and a grant to `app_user`.
3. **Schemas:** a request model (`extra="forbid"`) and a response model mirroring §4.
4. **Repository:** functions that take a `Session` and return rows. No commits.
5. **Service:** load the parent in scope (or 404), check the rules, write, audit, map to the response.
6. **Router:** a thin function with dependencies and `ok(...)`. `SessionDep` commits before the response.
7. **Tests:** the cases in §7.3.
8. **curl check** (§7.8), then the Definition of Done (§8).

```python
# app/models/notes.py
class NoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]

class NoteOut(BaseModel):
    id: UUID
    body: str
    author: UserRef
    created_at: datetime

# app/repositories/notes.py
def insert(s: Session, *, case_id: UUID, bank_id: str, author_id: UUID, body: str) -> NoteRow:
    row = NoteRow(case_id=case_id, bank_id=bank_id, author_id=author_id, body=body)
    s.add(row)
    s.flush()                      # assigns id/created_at; SessionDep commits before the response
    return row

# app/services/notes.py
def add_note(s: Session, who: Principal, case_id: UUID, data: NoteCreate) -> NoteOut:
    case = cases_repo.get_visible(s, case_id)
    if case is None:
        raise not_found("Case")
    row = notes_repo.insert(s, case_id=case.id, bank_id=case.bank_id, author_id=who.user_id, body=data.body)
    audit.record(s, action=AuditAction.note_added, actor=who.actor(), summary="Note added", case=case)
    return NoteOut(id=row.id, body=row.body, author=UserRef(id=who.user_id, name=who.name), created_at=row.created_at)

# app/routers/cases.py
router = APIRouter(prefix="/api/cases", tags=["cases"])

@router.post("/{case_id}/notes", status_code=201, response_model=Envelope[NoteOut], summary="Add a note")
def create_note(case_id: UUID, data: NoteCreate, who: StaffUser, s: SessionDep) -> dict:
    return ok(notes_service.add_note(s, who, case_id, data), "Note added")
```

**The same pattern for every operation:**

| Operation | Router | Service must |
| :--- | :--- | :--- |
| **List** | `PageParams` + filter/sort `Query` params | Filter in SQL, not Python. One query with counters, no per-row queries. Return `Page`. |
| **Get** | path ID | `get_visible()` or 404. Audit the view if the contract says so (deduplicated). |
| **Create** | body + optional `Idempotency-Key` (rule 9) | Validate references (bank, owner), insert, audit. **201.** |
| **Update** (PATCH) | body with `expected_version` | Edit rules (C1) and `case_workflow` rules, then `update_if_version()` + audit of each changed field, in one transaction |
| **Delete** | — | **We don't delete** cases, documents, notes or audit entries. Use status changes (close, archive) and keep the history. |

---

## 6. Database rules (Asif)

1. **Two database users.** `migrator` owns everything and runs Alembic and the seed. `app_user` runs the app: not an owner, no `BYPASSRLS`, all tables `FORCE ROW LEVEL SECURITY`.
2. **Migrations are hand-written** for RLS policies, triggers, grants, functions and `CREATE EXTENSION`; autogenerate doesn't understand them. One migration per change. **Never edit a migration that's already pushed**; add a new one.
3. **Migrations follow the phases.** 001–002 are the core for the MVP. 003 (victim) and 004 (assistant: `vector`, bluebook and chat tables) are written in Phase 4, not before.
4. **No database enum types.** Use `text` + `CHECK (col IN (...))`; they're easy to change in a migration.
5. **`cases.version`** is an integer, starts at 1, and is incremented only by `update_if_version()`.
6. **Counters on `cases`** (`document_count`, `pending_extraction_count`), kept up to date by triggers, so lists make no per-row queries and victim sessions can see the "document missing" state.
7. **File contents live in `document_contents`** (1:1 with `documents`), loaded only by the download endpoint.
8. **`SECURITY DEFINER` functions** always `SET search_path = pg_catalog, public`, with `REVOKE ALL ... FROM PUBLIC` and `EXECUTE` granted only to `app_user`.
9. **The audit log** accepts `INSERT` only. A trigger blocks `UPDATE` and `DELETE`, even for the owner, outside migrations.
10. **`idempotency_keys`** has a unique index on `(scope, key)`. **`rate_limits`** is a small counter table. Both are excluded from the audit log.
11. **Vector search (Phase 4):** while there are fewer than ~1,000 passages, search exactly with no HNSW index, filtering by bank and `published` in `WHERE`.
12. **The seed** is idempotent (skips if the banks exist), synthetic only, and pins the demo references and access codes from API_SPEC §8.

---

## 7. Testing

### 7.1 Test types and folders

| Folder | What | Runs as | Example |
| :--- | :--- | :--- | :--- |
| `tests/unit/` | Pure logic, no database | — | transition rules, `deadline_state`, edit rules, the rule-based fallback |
| `tests/api/` | Endpoints through `TestClient` with the real test DB | the app (`app_user`) | create case → 201 + audit entry |
| `tests/rls/` | Raw SQL with only database rules in force | **`app_user`** | bank_a viewer sees 0 bank_b rows |
| `tests/permissions/` | Every role × endpoint from API_SPEC §2 | the app | bank_viewer `POST /api/cases` → 403 |
| `tests/concurrency/` | Two requests at the same time | the app, threads | two PATCHes with one version → one 200, one 409 |
| `tests/ai/` | AI down, timeout, invalid output, injection | the app, AI mocked | `AI_MODE=off` → `rules_fallback` |
| `tests/contract/` | Responses match `openapi.yaml` | Prism proxy | no schema errors on the smoke run |

**Never run tests as a database superuser.** Superusers skip RLS, so the separation tests would pass falsely.

### 7.2 Test setup

- **The app under test gets explicit settings.** It never reads `DATABASE_URL` from `.env` in tests.
- **Guard against the dev database:** the session fixture fails at once unless the database name ends in `_test`.
- **Migrate and seed once per test session** through `TEST_MIGRATIONS_DATABASE_URL`.
- **Reset before each test:** an autouse fixture truncates `idempotency_keys` and `rate_limits`, so test order can't change results.
- **Tests that write** create their **own** cases and never assume global counts. The dashboard test computes its expected numbers with SQL.

```python
# tests/conftest.py (Anim)
from sqlalchemy.engine import make_url

TEST_DB = os.environ["TEST_DATABASE_URL"]
TEST_MIGRATOR_DB = os.environ["TEST_MIGRATIONS_DATABASE_URL"]

@pytest.fixture(scope="session")
def settings() -> Settings:
    for url in (TEST_DB, TEST_MIGRATOR_DB):
        assert make_url(url).database.endswith("_test"), f"refusing to test against {make_url(url).database}"
    return Settings(app_env="test", database_url=TEST_DB, migrations_database_url=TEST_MIGRATOR_DB,
                    jwt_secret="test-secret-" + "x" * 32, ai_mode="live", ai_timeout_seconds=1)

@pytest.fixture(scope="session")
def client(settings) -> Iterator[TestClient]:
    migrate_and_seed(settings.migrations_database_url)
    with TestClient(create_app(settings)) as c:
        yield c

@pytest.fixture(autouse=True)
def reset_request_state():
    with psycopg.connect(TEST_MIGRATOR_DB.replace("+psycopg", "")) as conn:
        conn.execute("truncate idempotency_keys, rate_limits")

@pytest.fixture
def login_as(client):
    emails = {"operator": "operator1@opscenter.test", "supervisor": "supervisor@opscenter.test",
              "viewer_a": "viewer@bank-a.test", "viewer_b": "viewer@bank-b.test"}
    def _headers(who: str) -> dict:
        r = client.post("/api/auth/login", json={"email": emails[who], "password": "Demo@1234"})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['data']['token']}"}
    return _headers
```

### 7.3 What every endpoint's tests must cover

| Case | Expect |
| :--- | :--- |
| Happy path | Status code, envelope, exact fields, **audit entry written** |
| No token / bad token | `401 UNAUTHORIZED` |
| Wrong role | `403 FORBIDDEN` |
| Another bank's record, with a role that may do this action | **exactly** `404 RESOURCE_NOT_FOUND` |
| Bad body / unknown field | `422 VALIDATION_ERROR` with `details.fields` |
| Domain errors | e.g. `409 INVALID_STATUS_TRANSITION`, `422 MISSING_REQUIRED_INFO`, `409 STALE_CASE`, `409 CASE_CLOSED`, `409 CASE_LOCKED` |
| Concurrency (writes with a version) | Two requests with the same `expected_version` at once → one 2xx, one `409 STALE_CASE`, one audit entry |
| Double review | The same extraction reviewed twice at once → one 200, one 409 |
| Duplicate protection (create endpoints) | Same key + same body → same response, one row. Same key + different body → 422. Another user with the same key → their own new request. |
| Commit failure | Force the commit to fail (monkeypatch) → a 500 envelope, **never** 201, and nothing saved |
| Money | Amounts in the JSON are numbers (`isinstance(v, (int, float))`), not strings |

```python
def test_add_note_happy_path(client, login_as, new_case):
    r = client.post(f"/api/cases/{new_case}/notes", json={"body": "Called the bank."}, headers=login_as("operator"))
    assert r.status_code == 201
    body = r.json()
    assert body["success"] is True and body["data"]["body"] == "Called the bank."
    history = client.get(f"/api/cases/{new_case}/history", headers=login_as("operator")).json()["data"]["items"]
    assert history[0]["action"] == "note.added"

def test_bank_viewer_cannot_see_other_bank_case(client, login_as, case_in_bank_b):
    # GET is allowed for bank viewers, so this tests bank separation, not role rejection
    r = client.get(f"/api/cases/{case_in_bank_b}", headers=login_as("viewer_a"))
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "RESOURCE_NOT_FOUND"

def test_parallel_patch_one_wins(client, login_as, new_case):
    h = login_as("operator")
    version = client.get(f"/api/cases/{new_case}", headers=h).json()["data"]["version"]
    def patch(amount):
        return client.patch(f"/api/cases/{new_case}", headers=h, json={"amount": amount, "expected_version": version})
    with ThreadPoolExecutor(2) as pool:
        codes = sorted(f.result().status_code for f in [pool.submit(patch, 1000), pool.submit(patch, 2000)])
    assert codes == [200, 409]
```

### 7.4 Database-rule tests (Asif)

```python
# tests/rls/test_bank_scope.py — connects as app_user with psycopg, no app code involved
def scoped(conn, **settings):
    for k, v in settings.items():
        conn.execute("select set_config(%s, %s, true)", (f"app.{k}", v))

def test_bank_viewer_sees_only_own_bank(app_user_conn):
    with app_user_conn.transaction():
        scoped(app_user_conn, role="bank_viewer", bank_id="bank_a")
        banks = {r[0] for r in app_user_conn.execute("select distinct bank_id from cases")}
    assert banks == {"bank_a"}

def test_no_scope_sees_nothing(app_user_conn):
    with app_user_conn.transaction():
        assert app_user_conn.execute("select count(*) from cases").fetchone()[0] == 0

def test_bank_viewer_cannot_write(app_user_conn, case_in_bank_a):
    with pytest.raises(psycopg.Error):
        with app_user_conn.transaction():
            scoped(app_user_conn, role="bank_viewer", bank_id="bank_a")
            app_user_conn.execute("update cases set amount = 1 where id = %s", (case_in_bank_a,))

def test_audit_log_cannot_be_changed(app_user_conn):
    with pytest.raises(psycopg.Error):
        with app_user_conn.transaction():
            scoped(app_user_conn, role="supervisor")
            app_user_conn.execute("delete from audit_log")

# Phase 4 (migration 003): a victim scope sees exactly one case and no notes
```

### 7.5 Permission-table tests (Anim)

One parametrized test generated from API_SPEC §2. When the table changes, change this list first and watch it fail.

```python
MATRIX = [  # (method, path, who, expected status)
    ("POST", "/api/cases", "viewer_a", 403),
    ("POST", "/api/cases", "operator", 201),
    ("GET", "/api/audit-logs", "operator", 403),
    ("GET", "/api/audit-logs", "supervisor", 200),
    ("GET", "/api/audit-logs", "viewer_a", 200),
    ("GET", "/api/dashboard/stats", "operator", 403),
    ("GET", "/api/alerts/shared-accounts", "viewer_a", 403),
    # ... one row per role × endpoint in API_SPEC §2
]

@pytest.mark.parametrize(("method", "path", "who", "expected"), MATRIX)
def test_permission_matrix(client, login_as, method, path, who, expected, valid_body_for):
    r = client.request(method, path, headers=login_as(who), json=valid_body_for(method, path))
    assert r.status_code == expected, r.text
```

### 7.6 AI failure tests (Asif)

| Test | How | Expect |
| :--- | :--- | :--- |
| AI down | monkeypatch `extract_fields` to raise `AIUnavailableError` | `source: rules_fallback`, `review_lane: low_confidence` (text file) or `failed` (image) |
| Timeout | monkeypatch to sleep longer than `ai_timeout_seconds=1` (test settings) | Same as down, `error.reason: timeout`, request finishes in about 1 s |
| Bad output | return `{"fields": "oops"}` | `failed`, `invalid_ai_output` |
| Busy | fill `AI_MAX_CONCURRENT` with blocked calls | the next call returns the fallback at once |
| No transaction held | during a slow mocked AI call, check `pg_stat_activity` | no `idle in transaction` connection from the app |
| Injection | seed injection document | extraction is `pending_review`; status, owner and amount unchanged |
| Chat down (Phase 4) | `answer()` raises | `answer_type: passages_only`, citations from the case's bank only |
| Cross-bank chat (Phase 4) | victim of bank_a asks a bank_b-only question | `no_answer`; every used passage has `bank_id = bank_a` |

### 7.7 Contract checks

**Prism proxy (main check).** Prism sits in front of the real backend and checks every request and response against `openapi.yaml`:

```bash
npx -y @stoplight/prism-cli@5.14.2 proxy docs/openapi.yaml http://localhost:8000 -p 4011 --errors
# now send the smoke script or your curls to http://localhost:4011 instead of :8000
```

A response that doesn't match the contract becomes an error with the mismatch described. Fix the code, or propose a contract change through a PR; never change either side silently.

**Lint the contract** whenever it changes (Node 22.12+):
```bash
npx -y @redocly/cli@2.78.0 lint docs/openapi.yaml
```

**Optional fuzzing:** Schemathesis can generate thousands of requests from `openapi.yaml`. Pin its version in the dev dependencies, and check `schemathesis run --help` for the flags of that version.

### 7.8 Manual testing with curl (Git Bash)

These commands use the v0.4.0 contract (`version` / `expected_version`, C3).

**Setup, once per terminal:**

```bash
BASE=http://localhost:8000
jget() { python -c "import sys,json
d=json.load(sys.stdin)
for k in sys.argv[1].split('.'): d=d[int(k)] if k.isdigit() else d[k]
print(d)" "$1"; }
login() { curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"Demo@1234\"}" | jget data.token; }
OP=$(login operator1@opscenter.test); SUP=$(login supervisor@opscenter.test); VA=$(login viewer@bank-a.test)
code() { curl -s -o /dev/null -w '%{http_code}\n' "$@"; }      # prints only the status code
uuid() { python -c 'import uuid;print(uuid.uuid4())'; }
ver() { curl -s "$BASE/api/cases/$1" -H "Authorization: Bearer $OP" | jget data.version; }
```

**Happy path (the hour-14 gate).** Every step has to satisfy API_SPEC §3.3 before the case can leave Received:

```bash
curl -s "$BASE/api/health"

# 1. Public intake (no Idempotency-Key here, see §4.4 rule 9)
curl -s -X POST "$BASE/api/intake" -H 'Content-Type: application/json' -d '{
  "bank_id":"bank_b","victim":{"name":"Test Victim","phone":"+81-90-0000-0101"},
  "amount":120000,"currency":"JPY","transfer_date":"2026-11-01","scam_type":"phishing","consent":true}'

# 2. Operator creates a paper case with only the minimum (name); the rest comes from the document
CASE=$(curl -s -X POST "$BASE/api/cases" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuid)" -d '{"bank_id":"bank_b","channel":"paper","victim":{"name":"Paper Victim"}}' | jget data.id)
curl -s "$BASE/api/cases/$CASE" -H "Authorization: Bearer $OP" | jget data.flags.missing_fields
#    → ['victim_contact', 'amount', 'transfer_date', 'account_number', 'scam_type', 'document']

# 3. Upload a document and run extraction
DOC=$(curl -s -X POST "$BASE/api/cases/$CASE/documents" -H "Authorization: Bearer $OP" -H "Idempotency-Key: $(uuid)" \
  -F "file=@eval/docs/paper_form_01.txt" -F "doc_type=intake_form" | jget data.id)
EXT=$(curl -s -X POST "$BASE/api/documents/$DOC/extract" -H "Authorization: Bearer $OP" -H "Idempotency-Key: $(uuid)" | jget data.id)

# 4. Accept the review with EVERY field the Received → Verified rule needs
curl -s -X POST "$BASE/api/extractions/$EXT/review" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' -d "{
  \"decision\":\"accept\",\"expected_version\":$(ver $CASE),
  \"fields\":{\"victim_phone\":\"+81-90-0000-0102\",\"amount\":250000,\"transfer_date\":\"2026-10-28\",
            \"account_number\":\"0012345\",\"scam_type\":\"impersonation\"}}"
curl -s "$BASE/api/cases/$CASE" -H "Authorization: Bearer $OP" | jget data.flags.missing_fields   # → []

# 5. Move to Verified (expect 200), then read the history
code -X POST "$BASE/api/cases/$CASE/transition" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' \
  -d "{\"to_status\":\"verified\",\"expected_version\":$(ver $CASE)}"
curl -s "$BASE/api/cases/$CASE/history" -H "Authorization: Bearer $OP"
```

**Error paths (each must print the expected code):**

```bash
code "$BASE/api/cases"                                                        # 401  no token
code "$BASE/api/cases/$CASE" -H "Authorization: Bearer $VA"                   # 404  bank_a viewer reads a bank_b case
code -X POST "$BASE/api/cases" -H "Authorization: Bearer $VA" -H 'Content-Type: application/json' -d '{}'   # 403
code -X POST "$BASE/api/cases/$CASE/transition" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' \
  -d "{\"to_status\":\"payout_review\",\"expected_version\":$(ver $CASE)}"     # 409  not allowed from here
code -X POST "$BASE/api/cases/$CASE/transition" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' \
  -d "{\"to_status\":\"closed\",\"closure_reason\":\"paid_out\",\"note\":\"x\",\"expected_version\":$(ver $CASE)}"   # 403 supervisor only
code -X POST "$BASE/api/intake" -H 'Content-Type: application/json' -d '{"bank_id":"bank_z"}'   # 422
code -X PATCH "$BASE/api/cases/$CASE" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' \
  -d '{"amount":1,"expected_version":0}'                                      # 409  STALE_CASE
K=$(uuid); for body in '{"bank_id":"bank_b","channel":"paper","victim":{"name":"A"}}' '{"bank_id":"bank_b","channel":"paper","victim":{"name":"B"}}'; do
  code -X POST "$BASE/api/cases" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' -H "Idempotency-Key: $K" -d "$body"
done                                                                          # 201, then 422 (same key, different body)
for i in $(seq 1 12); do code -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"operator1@opscenter.test","password":"wrong"}'; done          # 401 … then 429
```

**AI-down path:** restart the server with `AI_MODE=off`, then run extraction again. Expect `"source":"rules_fallback"`, and `/api/health` reports `"ai":"unavailable"`.

**Victim side (Phase 4):**

```bash
VT=$(curl -s -X POST "$BASE/api/victim/session" -H 'Content-Type: application/json' \
  -d '{"reference":"RFR-2026-00051","access_code":"M3PX-8KWN-5QDA"}' | jget data.token)
curl -s "$BASE/api/victim/case" -H "Authorization: Bearer $VT"
code "$BASE/api/cases" -H "Authorization: Bearer $VT"                         # 403  victim token on staff API
curl -s -X POST "$BASE/api/victim/chat/messages" -H "Authorization: Bearer $VT" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuid)" -d '{"question":"What happens next with my case?"}'
```

**PowerShell** (`curl` there is an alias, so use `curl.exe` or `Invoke-RestMethod`):

```powershell
$BASE = "http://localhost:8000"
$OP = (Invoke-RestMethod -Method Post "$BASE/api/auth/login" -ContentType 'application/json' `
  -Body '{"email":"operator1@opscenter.test","password":"Demo@1234"}').data.token
Invoke-RestMethod "$BASE/api/cases?page_size=5" -Headers @{ Authorization = "Bearer $OP" } | ConvertTo-Json -Depth 6
```

**Swagger UI** at `http://localhost:8000/docs`: click **Authorize** and paste a token. Good for quick checks; it doesn't replace tests.

### 7.9 Smoke script (Anim, N17)

`backend/scripts/smoke.sh` runs the happy path and the error paths above, checks each status code **and** the `missing_fields` checkpoints, prints `PASS` or `FAIL` per line, and exits non-zero on any failure. It runs against `:8000` (the app) or `:4011` (the Prism proxy, adding the contract check). It's the last thing run before every merge to `main` and before the demo.

### 7.10 Commands

```bash
uv run pytest -q                          # everything
uv run pytest tests/unit -q               # fast, no database
uv run pytest tests/rls tests/permissions tests/concurrency -q
uv run pytest --cov=app --cov-report=term-missing   # target: 80%+ on app/services
uv run ruff check . && uv run ruff format --check .
bash scripts/smoke.sh                     # against a running server
```

---

## 8. Definition of Done

### Per endpoint
- [ ] Matches API_SPEC and `openapi.yaml` exactly; no errors through the Prism proxy
- [ ] Role check + bank scope (RLS + repository); another bank's record → exactly 404
- [ ] Validation in schemas; 422 in the envelope
- [ ] Commits before the response; audit entry in the same transaction as the change
- [ ] Writes with a version use `update_if_version()`; the concurrency test passes
- [ ] Tests from §7.3 pass
- [ ] Works with curl (added to the smoke script if it's on the demo path)
- [ ] Shows in Swagger with summary, tags and error responses
- [ ] No AI or network call inside a DB transaction; no per-row queries in lists
- [ ] No personal data or secrets in logs; money appears as JSON numbers

### Per PR
- [ ] `ruff` clean, all tests green, coverage not lower
- [ ] Small (under ~400 lines where possible), one area
- [ ] API_SPEC §5 status set to `LIVE` for finished endpoints (Asif)
- [ ] Work log updated (`contributors/<you>/WORK_LOG.md`)

---

## 9. Git workflow

The rule comes from AGENTS.md §3.5 and is not optional.

| Change | Path to `main` |
| :--- | :--- |
| **API contract** (`docs/API_SPEC.md`, `docs/openapi.yaml`) | Branch → PR → **one teammate's approval** → merge |
| **Shared config or framework** (`pyproject.toml`, `uv.lock`, `.env.example`, `app/main.py`, `app/config.py`, `app/db.py`, `app/security.py`, migrations, `tests/conftest.py`, CI) | Branch → PR → **one approval** → merge |
| **Another person's or team's area** | Branch → PR → **that owner's approval** → merge |
| Small, safe change in your **own** area (one router or service and its tests, your work log) | Allowed straight to `main` after `git pull origin main` |

- **Branches:** `asif/<topic>`, `anim/<topic>`, e.g. `anim/cases-crud`, `asif/rls-migrations`. One area per branch.
- **Before pushing:** `git pull origin main`. The pre-push hook refuses stale pushes.
- **Review:** each of you reviews the other's PR within 30 minutes, against §8 and the shared interfaces.
- **Commits:** Conventional Commits (`feat(cases): …`, `test(rls): …`, `fix(auth): …`). No AI attribution anywhere.
- **Conflict hot spots:**
  - `app/main.py`: one line per router, in alphabetical order.
  - `tests/conftest.py`: add fixtures in new files where you can.
  - Migrations: Asif only.

---

## 10. Contract changes for v0.4.0 (Asif, through a PR)

From the system review, the backend review and the guide review. **Before coding** means it's part of P0.1.

| ID | Change | When |
| :--- | :--- | :--- |
| C1 | Edit (PATCH) rules: a missing field stays unchanged, `null` clears it, nested objects merge | Before coding |
| C2 | Optional `Idempotency-Key` (UUID v4) on case create, document upload, extract and chat messages; not on intake. New errors `422 IDEMPOTENCY_KEY_REUSED` and `409 REQUEST_IN_PROGRESS`; replay header `Idempotent-Replayed: true` | Before coding |
| C3 | Integer `version` on `Case` (and `VictimCase`); `expected_version` on PATCH, transition, review and victim PATCH → `409 STALE_CASE` (D12) | Before coding |
| C4 | Closed cases are read-only → `409 CASE_CLOSED`; notes still allowed (D11) | Before coding |
| C7 | Realistic stage durations; `due_soon` = the last 20% of a stage (S1, S3) | Before coding |
| C12 | State that money fields are JSON numbers with at most 2 decimals, never strings | Before coding |
| C5 | Closing as `paid_out` requires `payout_amount` (+ `paid_at`), shown on the case | Phase 2 |
| C10 | Document download: always a download (`attachment`), `nosniff`; decide whether bank viewers may see `id_document` (S4) | Phase 2 |
| C11 | Case views audited at most once per user per case every 10 minutes (S9) | Phase 2 |
| C6 | `flags.possible_duplicate` (same contact + amount + transfer date + account); also catches double intake submissions | Phase 3 |
| C8 | Bluebook `audience: victim_facing \| staff_only`; the chatbot uses victim-facing documents only | Phase 4 |
| C9 | Access codes are delivered to the contact on file, not read out by an operator; a victim's contact change notifies the old contact and flags staff; optional one-time code | Phase 4 |
