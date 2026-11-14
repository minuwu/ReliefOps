# Backend Development Guide

**Team** Asif (lead), Anim · **Status** v1 · **Updated** 2026-11-14
**Contract** [API_SPEC.md](../API_SPEC.md) + [openapi.yaml](../openapi.yaml) · **Why** [backend-plan.md](backend-plan.md) · **AI side** [Galib's suggestions](../../contributors/galib/suggested_by_backend_team.md)

How we build and test the backend. The contract says **what** the API does, the plan says **why**, and this guide says **how**. Devops (deployment, the full Docker setup) comes after the backend and isn't covered here, except for the dev database.

**Before writing code, both developers and their coding agents:**
- read §1–§5;
- load the skills `fastapi`, `python-testing-patterns`, `supabase-postgres-best-practices` and `openapi-spec-generation` (AGENTS.md §3.3);
- follow ECC's `python/*` rules where this guide doesn't say otherwise.

---

## 1. Who does what

### 1.1 Areas

| | **Asif** | **Anim** |
| :--- | :--- | :--- |
| **Owns** | Database (migrations, RLS, triggers, seed), security (login tokens, roles, scoping), audit, documents and AI, victim side, contract changes | App framework (`create_app`, errors, response envelope, middleware), login endpoints, cases domain, dashboard, staff chat, bluebook management, smoke script |
| **Endpoints** (API_SPEC §5) | 6.4 history and audit log · 6.5 documents, extraction, review, review queue · 6.3 victim access code · 6.7 victim session, victim case, victim chat | 6.1 login · 6.2 health, banks, users · 6.3 intake, cases list/create/get/patch, transition, assign, notes · 6.6 dashboard, alerts · 6.8 staff chat, bluebooks |
| **Count** | 15 endpoints + foundation | 21 endpoints |

### 1.2 Files (who may edit what)

| Path | Owner | Rule for the other person |
| :--- | :--- | :--- |
| `backend/migrations/**`, `app/db.py`, `app/security.py` | Asif | **Only Asif writes migrations.** Need a column? Message Asif or open an `XREQ`. Two people writing migrations at once creates two Alembic "heads". |
| `app/services/audit.py`, `app/services/victim_access.py`, `app/services/extraction.py`, `app/services/retrieval.py` | Asif | Call them; don't change them. |
| `app/main.py`, `app/errors.py`, `app/responses.py`, `app/middleware/**`, `app/config.py` | Anim | Asif adds router lines to `main.py` through small PRs. |
| `app/services/case_workflow.py` (status changes, deadlines, missing fields) | Anim | Asif calls it from review and victim edits. |
| `app/routers/<area>.py`, `app/services/<area>.py`, `app/repositories/<area>.py`, `app/models/<area>.py` | Owner of the area (§1.1) | One file per area, so you rarely touch the same file. |
| `app/services/ai_extraction.py`, `app/services/rag.py`, `app/prompts/**` | Galib | Backend only calls them (API_SPEC §7). |
| `tests/**` | Whoever writes the code under test | Shared fixtures in `tests/conftest.py`: Anim. Database-rule fixtures: Asif. |
| `docs/API_SPEC.md`, `docs/openapi.yaml` | Asif | Anim proposes changes, Asif applies them. Update both files together. |

---

## 2. Phases and timeline

Hours count from the hackathon start. The 🚦 lines are gates: don't start the next phase until the gate passes.

### Phase 0: Agree (hours 0–2, together)

| ID | Task | Owner | Done when |
| :--- | :--- | :--- | :--- |
| P0.1 | Apply the "before coding" contract changes in §10 (C1–C4, C7) | Asif | API_SPEC + openapi v0.4.0 pushed and the lint check is clean |
| P0.2 | Agree the shared interfaces in §4.3 (signatures only) | Both | Both say yes; stub files committed |
| P0.3 | Dev database running on each machine (§3.2) | Each | `psql` connects as `migrator` and as `app_user` |
| P0.4 | `backend/pyproject.toml`, dependencies, `fastapi dev` runs a hello-world `/api/health` | Anim | `curl localhost:8000/api/health` returns the envelope |

### Phase 1: Foundation (hours 2–6, in parallel)

| ID | Task | Owner | Depends on |
| :--- | :--- | :--- | :--- |
| A1 | Alembic set up with the `migrator` connection; **migration 001**: extensions (`vector`, `pgcrypto`), all tables, `CHECK` constraints instead of enum types, indexes, counter columns, `document_contents` | Asif | P0.3 |
| A2 | **Migration 002**: RLS policies + `FORCE` + grants, append-only audit trigger, `next_case_reference()` (with `SET search_path`), counter triggers, `system` scope policies, victim column-lock trigger | Asif | A1 |
| A3 | `app/db.py`: engine and pool, request-scoped session that sets `app.role`/`app.bank_id`/`app.case_id`, `system_session()` for background jobs, `short_tx()` helper | Asif | A1 |
| A4 | `app/security.py`: argon2id hashing, JWT (alg/exp/iss/aud checked), `Principal`, `CurrentUser`/`StaffUser`/`SupervisorUser`/`VictimUser` dependencies; refuses to start with a weak `JWT_SECRET` | Asif | P0.2 |
| A5 | `app/services/audit.py` (`record()`) and `app/services/victim_access.py` (`new_code()`, `hash_code()`, `verify_code()`) | Asif | A3 |
| A6 | Seed script: banks, demo users, 30+ cases across all banks and statuses, 10+ documents, demo victim codes, sample extractions. Idempotent. | Asif | A2 |
| A7 | Database-rule test suite (§7.4) | Asif | A2, A6 |
| N1 | `create_app()`, settings (`pydantic-settings`), CORS from env, router registry | Anim | P0.4 |
| N2 | `errors.py` (`ApiError` + handlers, 422 converted to the envelope, 404/405, 500 with a request ID) and `responses.py` (`ok()`, `Page`, pagination parameters) | Anim | N1 |
| N3 | Middleware: request ID, structured logs with redaction, `Idempotency-Key` store, rate limiter backed by a Postgres table | Anim | N2, A1 |
| N4 | `GET /api/health` (database ping, `ai`, `rag`) | Anim | N1, A3 |
| N5 | Test harness: `conftest.py` (test DB, migrate + seed once), `client`, `login_as(role)`, factories | Anim | A6 |

### Phase 2: MVP endpoints (hours 6–14)

| ID | Task | Owner |
| :--- | :--- | :--- |
| N6 | `POST /api/auth/login` (rate limit, audit), `GET /api/auth/me` | Anim |
| N7 | `GET /api/banks`, `GET /api/users` | Anim |
| N8 | `app/services/case_workflow.py`: allowed transitions, deadlines, `deadline_state`, missing fields, edit rules | Anim |
| N9 | `GET /api/cases` (filters, sorting, pagination, flags from counters), `GET /api/cases/{id}` (+ `case.viewed` audit) | Anim |
| N10 | `POST /api/intake` (calls `victim_access.new_code()`), `POST /api/cases`, `PATCH /api/cases/{id}` (edit rules C1, conflict check C3, field-by-field audit) | Anim |
| N11 | `POST /api/cases/{id}/transition`, `POST /api/cases/{id}/assign` | Anim |
| A8 | `GET /api/cases/{id}/history` (JSON), `GET /api/audit-logs` | Asif |
| A9 | `POST /api/cases/{id}/documents` (file type checked from its first bytes, 10 MB cap), `GET /api/documents/{id}/file` (download only, `nosniff`) | Asif |
| A10 | AI extraction: Galib's `extract_fields()` stub, rule-based fallback, runner (timeout, concurrency cap, **AI call outside the DB transaction**), `POST …/extract`, `GET /api/extractions/{id}` | Asif |
| A11 | `POST /api/extractions/{id}/review` (applies fields through `case_workflow`, sets `final_value`, audit) | Asif |

🚦 **Hour-14 gate (the brief's "happy path")** — this must pass with real HTTP calls:
1. Log in.
2. Submit intake.
3. List cases.
4. Upload a document.
5. Run extraction.
6. Accept the review.
7. Move the case to Verified.
8. Check that the audit history shows every step.

If it isn't green, both of you fix it before anything else.

### Phase 3: Should-tier and tests (hours 14–26)

| ID | Task | Owner |
| :--- | :--- | :--- |
| N12 | `POST /api/cases/{id}/notes` | Anim |
| N13 | `GET /api/dashboard/stats`, `GET /api/alerts/shared-accounts` | Anim |
| N14 | Permission-table tests (§7.5) | Anim |
| N15 | `backend/scripts/smoke.sh` (§7.9) | Anim |
| A12 | `GET /api/review-queue`, CSV export of history | Asif |
| A13 | Contract check through the Prism proxy (§7.7); fix every mismatch | Asif |
| A14 | AI-down, timeout and prompt-injection tests (§7.6); hook up Galib's eval script | Asif |

🚦 **Hour-30 gate (the brief's "roles, separation, audit"):**
- Database-rule tests, permission tests and the contract check are all green.
- The smoke script passes.

### Phase 4: Extras (hours 26–34, only if the hour-14 gate is green)

| ID | Task | Owner |
| :--- | :--- | :--- |
| A15 | Victim: `POST /api/cases/{id}/victim-access`, `POST /api/victim/session`, `GET`/`PATCH /api/victim/case` (edit locks + database trigger) | Asif |
| A16 | Victim chat: `GET /api/victim/chat`, `POST /api/victim/chat/messages` (bank-scoped retrieval, Galib's `answer()`, fallbacks, escalation), feedback | Asif |
| N16 | Staff chat: `GET /api/cases/{id}/chat`, `POST …/chat/reply` (clears the escalation flag) | Anim |
| N17 | Bluebooks: list, upload (background indexing with `system_session()`), publish, archive; startup cleanup for documents stuck in `processing` | Anim |

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
| Node 18+ | for `npx` | Prism (contract check), Redocly (lint) |

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

- **Runtime:** `fastapi[standard]`, `sqlmodel`, `psycopg[binary]`, `alembic`, `pydantic-settings`, `pyjwt`, `pwdlib[argon2]`, `pgvector`
- **Dev:** `pytest`, `pytest-cov`, `freezegun`, `ruff`

### 3.5 Environment variables (`backend/.env.example`)

```
APP_ENV=dev                               # dev | test | prod
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
│   ├── db.py              # engine, scoped session, system_session(), short_tx()
│   ├── security.py        # hashing, JWT, Principal, role dependencies
│   ├── errors.py          # ApiError, ErrorCode, exception handlers
│   ├── responses.py       # ok(), Page, pagination/sort params
│   ├── middleware/        # request_id.py, logging.py, idempotency.py, rate_limit.py
│   ├── routers/           # HTTP only: auth, reference, intake, cases, documents, extractions, audit, dashboard, victim, chat, kb
│   ├── services/          # business rules, transactions, audit calls (one file per area)
│   ├── repositories/      # SQL only, one file per table group
│   ├── models/            # tables.py (SQLModel tables) + one schemas file per area (requests/responses)
│   ├── prompts/           # Galib
│   └── seed.py
├── migrations/            # Alembic (written by hand for RLS, triggers, grants, extensions)
├── tests/                 # unit/, api/, rls/, permissions/, contract/, ai/
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
| **Repository** | SQL through SQLModel. **Always** runs in the scoped session. Explicit column lists for big tables. | Business decisions, commits |
| **Models** | Tables, plus request schemas (`extra="forbid"`) and response schemas that mirror API_SPEC §4 exactly | Logic |

### 4.3 Shared interfaces (agree in P0.2, then don't break them)

```python
# app/security.py (Asif)
class Principal(BaseModel):
    kind: Literal["user", "victim", "public", "system"]
    user_id: UUID | None; role: Role | None; bank_id: str | None; case_id: UUID | None; name: str
    def actor(self) -> Actor: ...                       # for audit entries

CurrentUser = Annotated[Principal, Depends(get_current_principal)]   # any logged-in staff user
StaffUser = Annotated[Principal, Depends(require_roles(Role.operator, Role.supervisor))]
SupervisorUser = Annotated[Principal, Depends(require_roles(Role.supervisor))]
VictimUser = Annotated[Principal, Depends(get_victim_principal)]

# app/db.py (Asif)
SessionDep = Annotated[Session, Depends(get_scoped_session)]   # sets app.role/app.bank_id/app.case_id; commits on success
def system_session() -> ContextManager[Session]: ...          # background jobs and seed
def short_tx() -> ContextManager[Session]: ...                # a separate short transaction (before/after an AI call)

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

# app/services/case_workflow.py (Anim)
def allowed_transitions(case: CaseRow, who: Principal) -> list[CaseStatus]: ...
def check_transition(case: CaseRow, who: Principal, req: TransitionRequest) -> None: ...  # raises ApiError
def apply_fields(s: Session, case: CaseRow, changes: dict, who: Principal) -> dict: ...    # shared by PATCH, review, victim edit
def missing_fields(case: CaseRow) -> list[MissingField]: ...
def deadline_state(case: CaseRow, now: datetime) -> DeadlineState: ...
```

### 4.4 Rules for every endpoint

1. **Contract first.** Field names, types, status codes and errors exactly as in API_SPEC and `openapi.yaml`. A different shape means a contract change (Asif), never a quiet change.
2. **Envelope everywhere.** Success is `ok(...)`; errors are `raise ApiError(...)`. Never return an error dict by hand.
3. **Validation lives in schemas.** Use `Annotated[..., Field(...)]` / `StringConstraints`, `extra="forbid"` on requests, and no `...` (Ellipsis) defaults (`fastapi` skill).
4. **Scope is never optional.** Every query goes through `SessionDep` (RLS) **and** the repository filters by scope. Another bank's record returns **404**, the same as a missing one.
5. **Every write is audited**, in the same transaction as the change, recording changed fields as `{from, to}`.
6. **Edit (PATCH) rules (C1):** a missing field stays unchanged, `null` clears it, and nested objects (`victim`) merge field by field.
7. **Edit conflicts (C3):** PATCH, transition, review and victim PATCH send `expected_updated_at`. If it doesn't match → `409 STALE_CASE`.
8. **Duplicate protection:** the create endpoints (intake, cases, documents, extract, chat messages) accept an `Idempotency-Key` header. A repeat with the same key returns the first response.
9. **No network calls inside a transaction.** For AI work: read in `short_tx()`, call the AI, then write in a new `short_tx()`. Cap concurrent AI calls at `AI_MAX_CONCURRENT`; when the cap is reached, return the fallback immediately instead of waiting.
10. **Time, money, IDs:**
    - time: `datetime.now(UTC)`, stored as `timestamptz`
    - money: `Decimal` in Python, `numeric(14,2)` in the database, a JSON number in the API
    - IDs: UUID v4
11. **Logs:**
    - one structured line per request: request ID, route, status, duration, user ID
    - **never** passwords, tokens, access codes, `Authorization` headers, or the bodies of `/intake` and `/victim/*`
12. **Sync by default.** Use plain `def` routes with the sync SQLModel session (`fastapi` skill). Only use `async def` when every call inside is async.
13. **Every route** declares `response_model=Envelope[...]`, `summary`, `tags`, and its `responses` for error codes, so it appears correctly in Swagger.

---

## 5. Recipe: building one CRUD resource

Example: notes (`POST /api/cases/{case_id}/notes`). Every resource follows the same 8 steps.

1. **Read the contract:** the API_SPEC §6 section and the `openapi.yaml` path. Write down status codes and errors.
2. **Table** (Asif): a new table or column means a migration, the RLS policy, an index, and a grant to `app_user`.
3. **Schemas:** a request model (`extra="forbid"`) and a response model mirroring §4.
4. **Repository:** functions that take a `Session` and return rows. No commits.
5. **Service:** load the parent in scope (or 404), check the rules, write, audit, map to the response.
6. **Router:** a thin function with dependencies and `ok(...)`.
7. **Tests:** the happy path, 401, 403 or 404, 422, plus any domain errors (§7.3).
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
    s.flush()                      # assigns id/created_at; the request dependency commits
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
| **Create** | body + optional `Idempotency-Key` | Validate references (bank, owner), insert, audit. **201.** |
| **Update** (PATCH) | body | Edit rules (C1), `expected_updated_at` check (C3), edit rules from `case_workflow`, audit each changed field |
| **Delete** | — | **We don't delete** cases, documents, notes or audit entries. Use status changes (close, archive) and keep the history. |

---

## 6. Database rules (Asif)

1. **Two database users.** `migrator` owns everything and runs Alembic and the seed. `app_user` runs the app: not an owner, no `BYPASSRLS`, all tables `FORCE ROW LEVEL SECURITY`.
2. **Migrations are hand-written** for RLS policies, triggers, grants, functions and `CREATE EXTENSION`; autogenerate doesn't understand them. One migration per change. **Never edit a migration that's already pushed**; add a new one.
3. **No database enum types.** Use `text` + `CHECK (col IN (...))`; they're easy to change in a migration.
4. **Counters on `cases`** (`document_count`, `pending_extraction_count`), kept up to date by triggers, so lists make no per-row queries and victim sessions can see the "document missing" state.
5. **File contents live in `document_contents`** (1:1 with `documents`), loaded only by the download endpoint.
6. **`SECURITY DEFINER` functions** always `SET search_path = pg_catalog, public`, with `REVOKE ALL ... FROM PUBLIC` and `EXECUTE` granted only to `app_user`.
7. **The audit log** accepts `INSERT` only. A trigger blocks `UPDATE` and `DELETE`, even for the owner, outside migrations.
8. **Vector search:** while there are fewer than ~1,000 passages, search exactly with no HNSW index, filtering by bank and `published` in `WHERE`. Add an index only if it's measured to be slow.
9. **The seed** is idempotent (skips if the banks exist), synthetic only, and pins the demo references and access codes from API_SPEC §8.

---

## 7. Testing

### 7.1 Test types and folders

| Folder | What | Runs as | Example |
| :--- | :--- | :--- | :--- |
| `tests/unit/` | Pure logic, no database | — | transition rules, `deadline_state`, edit rules, the rule-based fallback |
| `tests/api/` | Endpoints through `TestClient` with the real test DB | the app (`app_user`) | create case → 201 + audit entry |
| `tests/rls/` | Raw SQL with only database rules in force | **`app_user`** | bank_a viewer sees 0 bank_b rows |
| `tests/permissions/` | Every role × endpoint from API_SPEC §2 | the app | bank_viewer `POST /api/cases` → 403 |
| `tests/ai/` | AI down, timeout, invalid output, injection | the app, AI mocked | `AI_MODE=off` → `rules_fallback` |
| `tests/contract/` | Responses match `openapi.yaml` | Prism proxy | no schema errors on the smoke run |

**Never run tests as a database superuser.** Superusers skip RLS, so the separation tests would pass falsely.

### 7.2 Test setup

- `TEST_MIGRATIONS_DATABASE_URL` runs `alembic upgrade head` and the seed **once per test session**. The app under test uses `TEST_DATABASE_URL` (`app_user`).
- Tests that write create their **own** cases, and never assume global counts. The dashboard test computes its expected numbers with SQL.
- `login_as(role)` returns headers with a real token for the seeded demo user.

```python
# tests/conftest.py (Anim)
@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    migrate_and_seed(os.environ["TEST_MIGRATIONS_DATABASE_URL"])
    with TestClient(create_app(Settings(_env_file=".env", APP_ENV="test"))) as c:
        yield c

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
| Another bank's record | `404 RESOURCE_NOT_FOUND` (never 403) |
| Bad body / unknown field | `422 VALIDATION_ERROR` with `details.fields` |
| Domain errors | e.g. `409 INVALID_STATUS_TRANSITION`, `422 MISSING_REQUIRED_INFO`, `409 STALE_CASE`, `409 CASE_LOCKED` |
| Duplicate protection (create endpoints) | Same `Idempotency-Key` twice → same response, one row |

```python
def test_add_note_happy_path(client, login_as, new_case):
    r = client.post(f"/api/cases/{new_case}/notes", json={"body": "Called the bank."}, headers=login_as("operator"))
    assert r.status_code == 201
    body = r.json()
    assert body["success"] is True and body["data"]["body"] == "Called the bank."
    history = client.get(f"/api/cases/{new_case}/history", headers=login_as("operator")).json()["data"]["items"]
    assert history[0]["action"] == "note.added"

def test_add_note_other_bank_is_404(client, login_as, case_in_bank_b):
    r = client.post(f"/api/cases/{case_in_bank_b}/notes", json={"body": "x"}, headers=login_as("viewer_a"))
    assert r.status_code in (403, 404)    # role check first (403); a staff user from no bank would get 404
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

def test_victim_sees_exactly_one_case(app_user_conn, demo_case_42_id):
    with app_user_conn.transaction():
        scoped(app_user_conn, role="victim", bank_id="bank_b", case_id=str(demo_case_42_id))
        assert app_user_conn.execute("select count(*) from cases").fetchone()[0] == 1
        assert app_user_conn.execute("select count(*) from notes").fetchone()[0] == 0

def test_no_scope_sees_nothing(app_user_conn):
    with app_user_conn.transaction():
        assert app_user_conn.execute("select count(*) from cases").fetchone()[0] == 0

def test_audit_log_cannot_be_changed(app_user_conn):
    with pytest.raises(psycopg.Error):
        with app_user_conn.transaction():
            scoped(app_user_conn, role="supervisor")
            app_user_conn.execute("delete from audit_log")
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
| Timeout | monkeypatch to sleep longer than `AI_TIMEOUT_SECONDS=1` (test setting) | Same as down, `error.reason: timeout`, request finishes in about 1 s |
| Bad output | return `{"fields": "oops"}` | `failed`, `invalid_ai_output` |
| Busy | fill `AI_MAX_CONCURRENT` with blocked calls | the next call returns the fallback at once |
| Injection | seed injection document | extraction is `pending_review`; status, owner and amount unchanged |
| Chat down (Phase 4) | `answer()` raises | `answer_type: passages_only`, citations from the case's bank only |
| Cross-bank chat (Phase 4) | victim of bank_a asks a bank_b-only question | `no_answer`; every used passage has `bank_id = bank_a` |

### 7.7 Contract checks

**Prism proxy (main check).** Prism sits in front of the real backend and checks every request and response against `openapi.yaml`:

```bash
npx -y @stoplight/prism-cli@5.14.2 proxy docs/openapi.yaml http://localhost:8000 -p 4011 --errors
# now send the smoke script or your curls to http://localhost:4011 instead of :8000
```

A response that doesn't match the contract becomes an error with the mismatch described. Fix the code, or propose a contract change; never the other way around silently.

**Lint the contract** whenever it changes:
```bash
npx -y @redocly/cli@2.78.0 lint docs/openapi.yaml
```

**Optional fuzzing:** Schemathesis can generate thousands of requests from `openapi.yaml`. Pin its version in the dev dependencies, and check `schemathesis run --help` for the flags of that version.

### 7.8 Manual testing with curl (Git Bash)

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
```

**Happy path (the hour-14 gate):**

```bash
curl -s "$BASE/api/health"

# 1. Public intake
curl -s -X POST "$BASE/api/intake" -H 'Content-Type: application/json' -d '{
  "bank_id":"bank_b","victim":{"name":"Test Victim","phone":"+81-90-0000-0101"},
  "amount":120000,"currency":"JPY","transfer_date":"2026-11-01","scam_type":"phishing","consent":true}'

# 2. Operator creates a paper case and keeps its id and updated_at
CASE=$(curl -s -X POST "$BASE/api/cases" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(python -c 'import uuid;print(uuid.uuid4())')" \
  -d '{"bank_id":"bank_b","channel":"paper","victim":{"name":"Paper Victim"}}' | jget data.id)
curl -s "$BASE/api/cases?status=received&page_size=5" -H "Authorization: Bearer $OP"

# 3. Upload a document, run extraction, accept it
DOC=$(curl -s -X POST "$BASE/api/cases/$CASE/documents" -H "Authorization: Bearer $OP" \
  -F "file=@eval/docs/transfer_receipt_01.txt" -F "doc_type=transfer_receipt" | jget data.id)
EXT=$(curl -s -X POST "$BASE/api/documents/$DOC/extract" -H "Authorization: Bearer $OP" | jget data.id)
UPD=$(curl -s "$BASE/api/cases/$CASE" -H "Authorization: Bearer $OP" | jget data.updated_at)
curl -s -X POST "$BASE/api/extractions/$EXT/review" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' \
  -d "{\"decision\":\"accept\",\"fields\":{\"amount\":250000,\"transfer_date\":\"2026-10-28\",\"account_number\":\"0012345\"},\"expected_updated_at\":\"$UPD\"}"

# 4. Move to Verified, then read the history
UPD=$(curl -s "$BASE/api/cases/$CASE" -H "Authorization: Bearer $OP" | jget data.updated_at)
curl -s -X POST "$BASE/api/cases/$CASE/transition" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' \
  -d "{\"to_status\":\"verified\",\"expected_updated_at\":\"$UPD\"}"
curl -s "$BASE/api/cases/$CASE/history" -H "Authorization: Bearer $OP"
```

**Error paths (each must print the expected code):**

```bash
code "$BASE/api/cases"                                                        # 401  no token
code "$BASE/api/cases/$CASE" -H "Authorization: Bearer $VA"                   # 404  bank_a viewer, bank_b case
code -X POST "$BASE/api/cases" -H "Authorization: Bearer $VA" -H 'Content-Type: application/json' -d '{}'   # 403
code -X POST "$BASE/api/cases/$CASE/transition" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' \
  -d '{"to_status":"payout_review"}'                                          # 409  not allowed from here
code -X POST "$BASE/api/cases/$CASE/transition" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' \
  -d '{"to_status":"closed","closure_reason":"paid_out","note":"x"}'          # 403  supervisor only
code -X POST "$BASE/api/intake" -H 'Content-Type: application/json' -d '{"bank_id":"bank_z"}'   # 422
code -X PATCH "$BASE/api/cases/$CASE" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' \
  -d '{"amount":1,"expected_updated_at":"2000-01-01T00:00:00Z"}'              # 409  STALE_CASE
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
  -d '{"question":"What happens next with my case?"}'
```

**PowerShell** (`curl` there is an alias, so use `curl.exe` or `Invoke-RestMethod`):

```powershell
$BASE = "http://localhost:8000"
$OP = (Invoke-RestMethod -Method Post "$BASE/api/auth/login" -ContentType 'application/json' `
  -Body '{"email":"operator1@opscenter.test","password":"Demo@1234"}').data.token
Invoke-RestMethod "$BASE/api/cases?page_size=5" -Headers @{ Authorization = "Bearer $OP" } | ConvertTo-Json -Depth 6
```

**Swagger UI** at `http://localhost:8000/docs`: click **Authorize** and paste a token. Good for quick checks; it doesn't replace tests.

### 7.9 Smoke script (Anim, N15)

`backend/scripts/smoke.sh` runs the happy path and the error paths above, checks each status code, prints `PASS` or `FAIL` per line, and exits non-zero on any failure. It runs against `:8000` (the app) or `:4011` (the Prism proxy, adding the contract check). It's the last thing run before every merge to `main` and before the demo.

### 7.10 Commands

```bash
uv run pytest -q                          # everything
uv run pytest tests/unit -q               # fast, no database
uv run pytest tests/rls tests/permissions -q
uv run pytest --cov=app --cov-report=term-missing   # target: 80%+ on app/services
uv run ruff check . && uv run ruff format --check .
bash scripts/smoke.sh                     # against a running server
```

---

## 8. Definition of Done

### Per endpoint
- [ ] Matches API_SPEC and `openapi.yaml` exactly; no errors through the Prism proxy
- [ ] Role check + bank scope (RLS + repository); another bank's record → 404
- [ ] Validation in schemas; 422 in the envelope
- [ ] Audit entry for every write (and for case views, deduplicated)
- [ ] Tests from §7.3 pass
- [ ] Works with curl (added to the smoke script if it's on the demo path)
- [ ] Shows in Swagger with summary, tags and error responses
- [ ] No AI or network call inside a DB transaction; no N+1 queries in lists
- [ ] No personal data or secrets in logs

### Per PR
- [ ] `ruff` clean, all tests green, coverage not lower
- [ ] Small (under ~400 lines where possible), one area
- [ ] API_SPEC §5 status set to `LIVE` for finished endpoints (Asif)
- [ ] Work log updated (`contributors/<you>/WORK_LOG.md`)

---

## 9. Git workflow

- **Branches:** `asif/<topic>`, `anim/<topic>`, e.g. `anim/cases-crud`, `asif/rls-migrations`. One area per branch.
- **Before pushing:** `git pull origin main`. The pre-push hook refuses stale pushes. Direct pushes to `main` are allowed after a pull; PRs are preferred for code.
- **Review:** each of you reviews the other's PR within 30 minutes. Check §8 and the shared interfaces.
- **Commits:** Conventional Commits (`feat(cases): …`, `test(rls): …`, `fix(auth): …`). No AI attribution anywhere.
- **Conflict hot spots:**
  - `app/main.py`: one line per router, in alphabetical order.
  - `tests/conftest.py`: add fixtures in new files where you can.
  - Migrations: Asif only.

---

## 10. Contract changes for v0.4.0 (Asif)

From the system and backend reviews. **Before coding** means it's part of P0.1.

| ID | Change | When |
| :--- | :--- | :--- |
| C1 | Edit (PATCH) rules: a missing field stays unchanged, `null` clears it, nested objects merge | Before coding |
| C2 | Optional `Idempotency-Key` header on intake, case create, document upload, extract and chat messages | Before coding |
| C3 | `expected_updated_at` on PATCH, transition, review and victim PATCH → `409 STALE_CASE` (D12) | Before coding |
| C4 | Closed cases are read-only → `409 CASE_CLOSED`; notes still allowed (D11) | Before coding |
| C7 | Realistic stage durations; `due_soon` = the last 20% of a stage (S1, S3) | Before coding |
| C5 | Closing as `paid_out` requires `payout_amount` (+ `paid_at`), shown on the case | Phase 2 |
| C6 | `flags.possible_duplicate` (same contact + amount + transfer date + account) | Phase 3 |
| C10 | Document download: always a download (`attachment`), `nosniff`; decide whether bank viewers may see `id_document` (S4) | Phase 2 |
| C11 | Case views audited at most once per user per case every 10 minutes (S9) | Phase 2 |
| C8 | Bluebook `audience: victim_facing \| staff_only`; the chatbot uses victim-facing documents only | Phase 4 |
| C9 | Access codes are delivered to the contact on file, not read out by an operator; a victim's contact change notifies the old contact and flags staff; optional one-time code | Phase 4 |
