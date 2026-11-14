# Backend Development Guide

**Team** Asif (lead), Anim · **Version** v2 (simplified) · **Updated** 2026-11-14
**Contract** [API_SPEC.md](../API_SPEC.md) + [openapi.yaml](../openapi.yaml) (v0.4.0) · **Why** [backend-plan.md](backend-plan.md) · **Review** [backend-design-review.md](backend-design-review.md) · **AI side** [Galib's suggestions](../../contributors/galib/suggested_by_backend_team.md)

How we build and test the backend. The contract says **what** the API does, the plan says **why**, and this guide says **how**. **Where the plan and this guide disagree, this guide wins.**

**Status: no backend code exists yet.** Every endpoint in the contract is `PLANNED`. The mock at `localhost:4010` only replays contract examples (API_SPEC §9.1). An endpoint becomes `LIVE` when it passes §9 of this guide.

**Principles:**
- **One FastAPI service and one PostgreSQL database.** No queues, caches or extra services.
- **The smallest reliable solution.** Add a layer, tool or table only when a real problem needs it.
- **Security lives in the database too** (row-level security), not only in Python.
- **Contract first.** The code matches API_SPEC and `openapi.yaml`, never the other way round silently.
- **$0 budget.** Only free tools and free tiers (§3.2).

**Before writing code, both developers and their coding agents:**
- read §1–§6;
- load the skills `fastapi`, `python-testing-patterns` and `supabase-postgres-best-practices` (AGENTS.md §3.3).

---

## 1. Who does what

### 1.1 Areas

| | **Asif** | **Anim** |
| :--- | :--- | :--- |
| **Owns** | Database (migrations, RLS, constraints), `db.py` (scoped sessions), audit, documents and AI extraction, victim cases and victim chat, the contract and its Prism check | App framework (`create_app`, errors, envelope, logging, rate limits), **accounts and authentication** (sign-up, email verification, login/logout, password reset, invitations, deactivation, email sending), seed data, cases domain, dashboard, staff chat, bluebooks, smoke script |
| **Endpoints** (API_SPEC §5) | 6.4 history, audit log · 6.5 documents, extraction, review, review queue · 6.7 victim cases, claims, victim chat · 6.3 victim invite | 6.1 auth and invitations · 6.2 health, banks, users · 6.3 cases, transition, assign, notes · 6.6 dashboard, alerts · 6.8 staff chat, bluebooks |

### 1.2 Files

| Path | Owner | Rule for the other person |
| :--- | :--- | :--- |
| `backend/migrations/**`, `app/db.py` | Asif | **Only Asif writes migrations.** Need a column? Ask Asif. |
| `app/services/audit.py`, `app/services/extraction.py`, `app/services/victim_cases.py` | Asif | Call them; don't change them. |
| `app/main.py`, `app/config.py`, `app/errors.py`, `app/responses.py`, `app/security.py`, `app/email.py`, `app/seed.py` | Anim | Asif adds router lines to `main.py` through small PRs. |
| `app/services/case_workflow.py` | Anim | Asif calls it from review and victim edits. |
| `app/routers/<area>.py`, `app/services/<area>.py`, `app/models/<area>.py` | Owner of the area (§1.1) | One file per area, so you rarely edit the same file. |
| `app/services/ai_extraction.py`, `app/services/rag.py`, `app/prompts/**` | Galib | Backend only calls them (API_SPEC §7). |
| `docs/API_SPEC.md`, `docs/openapi.yaml` | Asif | Changes go through a PR with one approval (§10). Update both files together. |

---

## 2. Phases

Hours count from the hackathon start. The 🚦 lines are gates: don't start the next phase until the gate passes.

| Phase | Hours | Asif | Anim |
| :--- | :--- | :--- | :--- |
| **0. Agree** | 0–2 | Get contract v0.4.0 approved (PR, Minhaz) · dev database running · optional: deploy a hello-world to find hosting limits early | Agree the interfaces in §4.3 · `pyproject.toml`, `fastapi dev` serving `/api/health` |
| **1. Foundation** | 2–6 | **A1** migration 001 (core tables, §7) · **A2** migration 002 (RLS, grants, audit trigger, reference function) · **A3** `db.py` (§4.2) · **A4** `audit.py` · **A5** database-rule tests | **N1** `create_app`, settings, errors, envelope, logging · **N2** `security.py` (password hashing, session tokens, user dependencies) · **N3** login, logout, me, rate limits · **N4** `email.py` (console/SMTP) · **N5** seed · **N6** test harness (§8.2) |
| **2. MVP** | 6–14 | **A6** victim cases: create (the report form), list, get, edit · **A7** history, audit log · **A8** documents upload/download · **A9** extraction + circuit breaker (§4.5) · **A10** review | **N7** sign-up, verify email, resend, forgot/reset password · **N8** `case_workflow.py` · **N9** cases list/get · **N10** create/edit · **N11** transition, assign |
| 🚦 **Gate 14** | | The §8.8 happy path passes over real HTTP | |
| **3. Should + tests** | 14–24 | **A11** review queue, CSV export · **A12** Prism contract check, fix mismatches · **A13** AI-failure and concurrency tests | **N12** invitations, accept, deactivate · **N13** notes · **N14** dashboard, alerts · **N15** permission tests · **N16** smoke script |
| 🚦 **Gate 24** | | Database-rule, permission, concurrency and AI-failure tests green; contract check clean; smoke script passes | |
| **4. Extras** | 24–34 | **A14** victim invite + claim (phone/paper cases) · **A15** migration 003 (pgvector, bluebooks, chat) + victim chat | **N17** staff chat · **N18** bluebooks |
| **5. Freeze** | 34–36 | Bug fixes, full smoke and contract check. **Hour 36: feature freeze.** Devops starts. | |

---

## 3. Setup

### 3.1 Tools

| Tool | Version | Use |
| :--- | :--- | :--- |
| Python | 3.12 | runtime |
| uv | latest | packages and venv |
| Git Bash (Windows) | any | the curl commands in §8.8 |
| PostgreSQL | 16 | `pgvector` is only needed from Phase 4 |
| Node | **22.12+** | `npx` for Prism 5.14.2 (contract check) and Redocly CLI 2.78.0 (lint); Redocly v2 needs Node 22.12+ |

### 3.2 Free services ($0)

| Need | Development and tests | Live demo |
| :--- | :--- | :--- |
| Database | Docker image `pgvector/pgvector:pg16`, a local install, or a free hosted tier | A free hosted Postgres; add `?sslmode=require` to its URL |
| Email | `EMAIL_MODE=console`: the email (with its link) is printed in the server log; tests read an in-memory outbox | `EMAIL_MODE=smtp` with any free SMTP tier (team decision, §12) |
| Hosting | not needed | free tier, chosen in the devops phase |

### 3.3 Database users

- **`migrator`** owns the tables. It runs only Alembic and the seed.
- **`app_user`** is what the app connects as. It isn't an owner and has no `BYPASSRLS`, so RLS always applies.
- Two databases: `fraud_relief` and `fraud_relief_test`.

### 3.4 First run

```bash
cd backend
uv sync
cp .env.example .env              # never commit .env
uv run alembic upgrade head       # uses MIGRATIONS_DATABASE_URL (migrator)
uv run python -m app.seed         # idempotent
uv run fastapi dev                # http://localhost:8000/docs
```

### 3.5 Dependencies

- **Runtime:** `fastapi[standard]`, `sqlmodel`, `psycopg[binary]`, `alembic`, `pydantic-settings`, `pwdlib[argon2]`
- **Dev:** `pytest`, `pytest-cov`, `freezegun`, `ruff`
- **Phase 4:** `pgvector`

### 3.6 Environment (`backend/.env.example`)

```
APP_ENV=dev                         # dev | test | prod
DATABASE_URL=postgresql+psycopg://app_user:app_password@localhost:5432/fraud_relief
MIGRATIONS_DATABASE_URL=postgresql+psycopg://migrator:migrator_password@localhost:5432/fraud_relief
TEST_DATABASE_URL=postgresql+psycopg://app_user:app_password@localhost:5432/fraud_relief_test
TEST_MIGRATIONS_DATABASE_URL=postgresql+psycopg://migrator:migrator_password@localhost:5432/fraud_relief_test
SESSION_HOURS=8
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
FRONTEND_BASE_URL=http://localhost:3000   # links in emails point here
EMAIL_MODE=console                  # console | smtp
EMAIL_FROM=no-reply@example.test
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
AI_MODE=live                        # live | off (off = test the AI-down path)
AI_API_KEY=
AI_TIMEOUT_SECONDS=20
AI_MAX_CONCURRENT=4
```

---

## 4. Architecture

### 4.1 Layout (the team structure)

```
backend/
├── app/
│   ├── main.py        # create_app(): middleware, error handlers, routers
│   ├── config.py      # Settings (pydantic-settings)
│   ├── db.py          # engine, get_session, per-transaction scope, system_session
│   ├── security.py    # password hashing, session tokens, Principal, role dependencies
│   ├── email.py       # send(to, subject, body): console or SMTP
│   ├── errors.py      # ApiError, error codes, handlers (422 → envelope)
│   ├── responses.py   # ok(), Page, Money
│   ├── routers/       # HTTP only, one file per area
│   ├── services/      # rules + SQL (SQLModel) + audit + commit, one file per area
│   ├── models/        # SQLModel tables and request/response schemas
│   ├── prompts/       # Galib
│   └── seed.py
├── migrations/        # Alembic, hand-written for RLS, triggers, grants
├── tests/             # unit/, api/, rls/, permissions/, ai/
├── scripts/smoke.sh
└── .env.example
```

**Router → service → database.** Routers handle HTTP only. Services hold the rules, the SQL, the audit call and the commit. There is no separate repository layer; add one only if the same query is needed in three or more places.

### 4.2 The three database rules that make writes safe

**1. Every transaction carries the caller's scope.** The scope goes into `session.info` once, and a SQLAlchemy event applies it at the start of **every** transaction. That includes transactions opened after a commit and in background jobs.

```python
# app/db.py (Asif)
@event.listens_for(Session, "after_begin")
def _apply_scope(session, transaction, connection):
    scope = session.info.get("scope")                 # set by get_session / system_session
    if scope is None:
        return                                         # no scope → RLS shows nothing (fails closed)
    connection.exec_driver_sql(
        "select set_config('app.role', %s, true), set_config('app.user_id', %s, true), "
        "set_config('app.bank_id', %s, true)",
        (scope.role, scope.user_id or "", scope.bank_id or ""),
    )

def get_session(who: CurrentPrincipal) -> Iterator[Session]:
    with Session(engine, info={"scope": who.scope()}) as s:
        yield s                                        # cleanup only rolls back and closes
SessionDep = Annotated[Session, Depends(get_session)]
```

**2. Commit before success.** By default FastAPI runs dependency cleanup **after** the response is sent, so a commit placed there could fail after the client already got `201`. So:
- **every write service ends with `s.commit()`** before it returns;
- the dependency never commits;
- if the commit fails, the error handler returns a `500` envelope and nothing was saved.

**3. Concurrent edits can't overwrite each other.** `cases` has an integer `version` column, mapped with SQLAlchemy's built-in optimistic locking.

```python
class CaseRow(SQLModel, table=True):
    __mapper_args__ = {"version_id_col": ...}          # the `version` column; SQLAlchemy adds WHERE version = :loaded
# in the service:
case = get_visible_case(s, case_id)                    # 404 if not visible
if case.version != data.expected_version:
    raise ApiError(409, "STALE_CASE", "This case changed; reload it")
apply_changes(case, data); audit.record(...)
try:
    s.commit()                                         # UPDATE ... WHERE id = :id AND version = :loaded
except StaleDataError:                                 # someone else committed in between
    s.rollback(); raise ApiError(409, "STALE_CASE", "This case changed; reload it")
```

The check in Python gives a clear error. The database `WHERE version` makes it atomic, so two simultaneous requests can never both win.

### 4.3 Shared interfaces (agree in Phase 0)

```python
# app/security.py (Anim)
class Principal(BaseModel):            # who is calling
    user_id: UUID; name: str; role: Role; bank_id: str | None
    def scope(self) -> Scope: ...
    def actor(self) -> Actor: ...       # for audit entries
CurrentPrincipal  # any logged-in account
StaffUser         # operator or supervisor
SupervisorUser
VictimUser        # role victim with a verified email

# app/db.py (Asif)
SessionDep                                      # §4.2
def system_session() -> ContextManager[Session]: ...    # scope role='system': auth lookups, background jobs, seed

# app/services/audit.py (Asif)
def record(s, *, action, actor, summary, case=None, changes=None, metadata=None) -> None: ...

# app/errors.py, app/responses.py (Anim)
class ApiError(Exception): (status, code, message, details=None)
def ok(data, message="ok") -> dict: ...
Money = Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2),
                  PlainSerializer(float, return_type=float, when_used="json")]   # JSON number, not a string

# app/email.py (Anim)
def send(to: str, subject: str, body: str) -> None: ...     # console or SMTP; tests swap in an outbox

# app/services/case_workflow.py (Anim)
allowed_transitions(case, who) · check_transition(case, who, req) · missing_fields(case) · deadline_state(case, now)
```

### 4.4 Rules for every endpoint

1. **Contract first:** field names, status codes and error codes exactly as in API_SPEC and `openapi.yaml`.
2. **Envelope everywhere:** `ok(...)` for success, `raise ApiError(...)` for errors. Validation errors are converted to the envelope by one handler.
3. **Validation in schemas:** `extra="forbid"` on requests, constraints with `Field`/`StringConstraints`.
4. **Scope everywhere:** only `SessionDep` or `system_session()`, never a bare session. Another bank's record, or another victim's case, returns **404**.
5. **Commit before success**, with the audit entry in the same transaction (§4.2).
6. **Edit rules:** a missing field stays unchanged, `null` clears it, nested objects merge.
7. **Writes to a case send `expected_version`** (§4.2).
8. **Closed cases are read-only** (`409 CASE_CLOSED`), except for notes.
9. **Money** uses `Money` (JSON number). Time is `datetime.now(UTC)` / `timestamptz`. IDs are UUID v4.
10. **Logs** get one line per request (ID, route, status, duration, user ID). Never passwords, tokens, email links, `Authorization` headers, or the bodies of auth and victim requests.

Sync `def` routes by default (the `fastapi` skill). No network call while a transaction is open (§4.5).

### 4.5 AI calls

- **No open transaction during the call:** read what's needed, `s.commit()` (this ends the transaction and returns the connection to the pool), call the AI, then write the result. The next query starts a new transaction, and the scope is re-applied automatically (§4.2).
- **Limits:** `AI_TIMEOUT_SECONDS`, at most `AI_MAX_CONCURRENT` calls at once.
- **Circuit breaker**, a module-level counter:
  - after 3 failures or timeouts in a row, skip the AI for 60 s and use the fallback immediately;
  - then try one call;
  - `/api/health` shows `ai: unavailable` while it's open.

---

## 5. Accounts and authentication

### 5.1 Who gets an account how

| Account | How it's created | Can choose role or bank? |
| :--- | :--- | :--- |
| Victim | **Signs up** with email + password, then verifies the email | No. The role is always `victim`; there's no role field |
| Operator, supervisor, bank viewer | **Invitation** from a supervisor, who sets the role (and the bank for a bank viewer). The invitee sets a password. | No. The role and bank come from the invitation |
| Demo staff and victims | The seed (synthetic, API_SPEC §8) | — |

### 5.2 Tokens

| Token | Lifetime | Stored as | Ends when |
| :--- | :--- | :--- | :--- |
| **Session** (the bearer token after login) | `SESSION_HOURS` (8) | SHA-256 hash in `sessions` | Logout, password reset, deactivation, or expiry |
| Email verification | 24 h | hash in `auth_tokens` | Used once |
| Password reset | 1 h | hash in `auth_tokens` | Used once, or a newer reset is requested |
| Invitation | 72 h | hash in `invitations` | Accepted or revoked |

- All tokens are random: `secrets.token_urlsafe(32)`. The plaintext appears only in the response (session) or the email link, never in the database or the logs.
- Session tokens are opaque, not JWTs. Every request looks up `sessions` joined to `users` (`is_active`) by the token hash. That's one indexed read, it makes logout and deactivation take effect immediately, and there's no signing key to manage.
- Auth lookups run in `system_session()`. The caller's scope is only known after the lookup.

### 5.3 Flows

1. **Sign-up:** `POST /api/auth/signup` → `202`. A verification email is sent. If the email already has an account, the response is the same `202` and that address gets an "you already have an account" email instead, so nobody can test which emails exist.
2. **Verify:** `POST /api/auth/verify-email {token}` → `200`. Unverified victims get `403 EMAIL_NOT_VERIFIED` at login. `POST /api/auth/resend-verification {email}` always returns `202`.
3. **Login:** `POST /api/auth/login` → a session token + user. **Logout:** `POST /api/auth/logout` revokes the current session.
4. **Forgot password:** `POST /api/auth/forgot-password {email}` always returns `202`. A reset link is sent if an active account exists. **Reset:** `POST /api/auth/reset-password {token, new_password}` sets the password and revokes **all** that user's sessions.
5. **Invite** (supervisor): `POST /api/invitations {email, name, role, bank_id}`.
   - `bank_id` is required for `bank_viewer` and must be empty for `operator` and `supervisor`.
   - An email with a link is sent.
   - `GET /api/invitations` lists them; `POST /api/invitations/{id}/revoke` cancels one.
6. **Accept:** `POST /api/auth/accept-invitation {token, password}` creates the account with the invited role and bank. The email counts as verified, because the invitee received the link.
7. **Deactivate** (supervisor): `PATCH /api/users/{id} {"is_active": false}` revokes all that user's sessions. A supervisor can't deactivate themselves.
8. **Victim's phone/paper case** (Phase 4): an operator sends `POST /api/cases/{id}/victim-invite` to the email on the case. The victim, logged in with **that same verified email**, calls `POST /api/victim/claims {token}` and the case is linked to their account.

### 5.4 Rules

- **Passwords:** 10–128 characters, hashed with argon2id (`pwdlib`). Emails are stored lower-case.
- **Rate limits** (in memory, per IP and per email; fine for one server instance):
  - login: 5 failures per 15 min
  - sign-up, resend and forgot-password: 5 per hour
  - every `429` carries `Retry-After`
- **Victims' scope:** victims see only cases where `cases.victim_user_id` is their own ID. This is enforced by RLS, not only by the code.
- **Staff routes reject victim accounts with `403`, and victim routes reject staff with `403`.**

### 5.5 Future work (not in the hackathon build)

Multi-factor login, sign-in with Google or a bank, refresh tokens and a "my devices" list, changing email, account deletion, a breached-password check, bank-level admins who invite their own viewers, and a CLI to create the first supervisor outside the seed.

---

## 6. Recipe: one CRUD endpoint

1. Read the API_SPEC section and the `openapi.yaml` path: status codes and errors.
2. **Table** (Asif): a migration, the RLS policy, an index, and a grant to `app_user`.
3. **Schemas:** request (`extra="forbid"`) and response, mirroring API_SPEC §4.
4. **Service:** load in scope (or 404), check the rules, write, audit, **commit**, map to the response.
5. **Router:** a thin function with `ok(...)`.
6. **Tests:** §8.3. Then curl (§8.8) and the Definition of Done (§9).

```python
# app/services/notes.py
def add_note(s: Session, who: Principal, case_id: UUID, data: NoteCreate) -> NoteOut:
    case = s.exec(select(CaseRow).where(CaseRow.id == case_id)).first()   # RLS already limits rows
    if case is None:
        raise ApiError(404, "RESOURCE_NOT_FOUND", "Case not found")
    note = NoteRow(case_id=case.id, bank_id=case.bank_id, author_id=who.user_id, body=data.body)
    s.add(note)
    audit.record(s, action="note.added", actor=who.actor(), summary="Note added", case=case)
    s.commit()                                                             # before returning
    return NoteOut.from_row(note, author=who)

# app/routers/cases.py
@router.post("/{case_id}/notes", status_code=201, response_model=Envelope[NoteOut], summary="Add a note")
def create_note(case_id: UUID, data: NoteCreate, who: StaffUser, s: SessionDep) -> dict:
    return ok(notes_service.add_note(s, who, case_id, data), "Note added")
```

| Operation | Service must |
| :--- | :--- |
| **List** | Filter and sort in SQL; one query (no per-row queries); return `Page` |
| **Get** | Load in scope or 404; audit case views at most once per user per case every 10 minutes |
| **Create** | Validate references, insert, audit, commit; **201** |
| **Edit** | Edit rules (§4.4 rule 6), version check (§4.2), audit each changed field, commit |
| **Delete** | **We don't delete** cases, documents, notes or audit entries. Close or deactivate instead. |

---

## 7. Database (Asif)

1. **Two users** (§3.3). Every table has `FORCE ROW LEVEL SECURITY`.
2. **Hand-written migrations** for RLS, triggers, grants and extensions. Never edit a pushed migration.
3. **Migration 001 (core):**
   - `banks`
   - `users` (`role`, `bank_id`, `email_verified_at`, `is_active`)
   - `sessions`, `auth_tokens`, `invitations`
   - `cases` (`version`, `victim_user_id`, `payout_amount`, `document_count`, `pending_extraction_count`)
   - `documents` and `document_contents`
   - `ai_extractions`, `notes`, `audit_log`
4. **Migration 002:**
   - RLS policies:
     - staff by role and bank;
     - victims by `victim_user_id = app.user_id`;
     - `system` for the auth tables and background jobs.
   - Grants, the append-only audit trigger, and `next_case_reference()` (with `SET search_path`).
5. **Migration 003 (Phase 4):** `vector`, `kb_documents`, `kb_passages`, `chat_messages`.
6. **No enum types:** `text` + `CHECK`. **Counters** (`document_count`, `pending_extraction_count`) are updated by the service in the same transaction as the change.
7. **File contents** live in `document_contents`, loaded only by the download endpoint.
8. **The seed** is idempotent and synthetic. It creates the demo accounts in API_SPEC §8 (staff and two verified victims who own `RFR-2026-00042` and `RFR-2026-00051`).

---

## 8. Testing

### 8.1 Levels

| Folder | What | Example |
| :--- | :--- | :--- |
| `tests/unit/` | Pure logic, no database | transition rules, deadlines, the extraction fallback |
| `tests/api/` | Endpoints through `TestClient` on the test database, including concurrency | create case → 201 + audit entry; two edits at once → one 409 |
| `tests/rls/` | Raw SQL as **`app_user`**, no app code | a bank_a viewer sees 0 bank_b rows |
| `tests/permissions/` | Every role × endpoint from API_SPEC §2 | a victim on `GET /api/cases` → 403 |
| `tests/ai/` | AI down, timeout, bad output, circuit breaker | 3 timeouts → the next call falls back in under 100 ms |
| Contract | The Prism proxy over the smoke run (§8.7) | no schema errors |

**Never test as a database superuser.** Superusers skip RLS.

### 8.2 Test setup

- **The app under test gets explicit settings**, built from the `TEST_*` variables; nothing is read from `.env`. A guard fails at once unless the database name ends in `_test`.
- **Migrate and seed once per session**, as `migrator`.
- **Before each test:** clear the in-memory rate limiter and the email outbox.
- **Tests that write** create their own cases and accounts, and never assume global counts.

```python
# tests/conftest.py (Anim)
@pytest.fixture(scope="session")
def settings() -> Settings:
    db, mig = os.environ["TEST_DATABASE_URL"], os.environ["TEST_MIGRATIONS_DATABASE_URL"]
    for url in (db, mig):
        assert make_url(url).database.endswith("_test"), f"refusing to test against {make_url(url).database}"
    return Settings(app_env="test", database_url=db, migrations_database_url=mig,
                    email_mode="outbox", ai_timeout_seconds=1)

@pytest.fixture(scope="session")
def app(settings):
    migrate_and_seed(settings.migrations_database_url)
    return create_app(settings)

@pytest.fixture
def client(app):
    reset_rate_limits(); email.outbox.clear()
    with TestClient(app) as c:
        yield c

@pytest.fixture
def login_as(client):
    emails = {"operator": "operator1@opscenter.test", "supervisor": "supervisor@opscenter.test",
              "viewer_a": "viewer@bank-a.test", "victim1": "victim1@mail.test"}
    def _headers(who: str) -> dict:
        r = client.post("/api/auth/login", json={"email": emails[who], "password": "Demo@1234"})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['data']['token']}"}
    return _headers
```

### 8.3 What each endpoint's tests cover

| Case | Expect |
| :--- | :--- |
| Happy path | Status, envelope, exact fields, **audit entry** |
| No token, or a logged-out token | `401` |
| Wrong role (including a victim on staff routes) | `403` |
| Another bank's record (with a role allowed to do this), or another victim's case | **exactly** `404` |
| Bad body or an unknown field (e.g. `role` in sign-up) | `422 VALIDATION_ERROR` |
| Domain errors | `409 INVALID_STATUS_TRANSITION`, `422 MISSING_REQUIRED_INFO`, `409 STALE_CASE`, `409 CASE_CLOSED`, `403 EMAIL_NOT_VERIFIED`, `400 INVALID_TOKEN` |
| Two edits with the same `expected_version` at once | One 2xx, one `409 STALE_CASE`, one audit entry |
| Commit fails (monkeypatched) | A `500` envelope, never `2xx`, nothing saved |
| Money | Amounts are JSON numbers, never strings |

```python
def test_bank_viewer_gets_404_for_other_bank(client, login_as, case_in_bank_b):
    r = client.get(f"/api/cases/{case_in_bank_b}", headers=login_as("viewer_a"))   # GET is allowed for viewers
    assert r.status_code == 404 and r.json()["error"]["code"] == "RESOURCE_NOT_FOUND"

def test_parallel_edits_one_wins(client, login_as, new_case):
    h = login_as("operator")
    v = client.get(f"/api/cases/{new_case}", headers=h).json()["data"]["version"]
    edit = lambda amount: client.patch(f"/api/cases/{new_case}", headers=h,
                                       json={"amount": amount, "expected_version": v}).status_code
    with ThreadPoolExecutor(2) as pool:
        assert sorted(pool.map(edit, [1000, 2000])) == [200, 409]

def test_signup_verify_login(client):
    body = {"email": "new.victim@mail.test", "password": "a-long-password", "name": "New Victim"}
    assert client.post("/api/auth/signup", json=body).status_code == 202
    login = {"email": body["email"], "password": body["password"]}
    assert client.post("/api/auth/login", json=login).json()["error"]["code"] == "EMAIL_NOT_VERIFIED"
    token = email.outbox.last_token(to=body["email"])                    # the outbox keeps the link
    assert client.post("/api/auth/verify-email", json={"token": token}).status_code == 200
    assert client.post("/api/auth/login", json=login).status_code == 200

def test_signup_cannot_choose_role(client):
    r = client.post("/api/auth/signup", json={"email": "x@mail.test", "password": "a-long-password",
                                              "name": "X", "role": "supervisor"})
    assert r.status_code == 422
```

### 8.4 Database-rule tests (Asif)

Raw SQL as `app_user`, with `set_config` per test:
- a bank_a viewer sees only bank_a cases;
- no scope sees nothing;
- a bank viewer can't `UPDATE` cases;
- `DELETE FROM audit_log` fails;
- a victim scope sees only cases with its `victim_user_id`;
- `app_user` can't read `sessions` without the `system` scope.

### 8.5 Permission table (Anim)

One parametrized test with a row per role × endpoint from API_SPEC §2, for example:
- `("POST", "/api/cases", "victim1", 403)`
- `("POST", "/api/invitations", "operator", 403)`
- `("GET", "/api/audit-logs", "viewer_a", 200)`

When §2 changes, change this list first.

### 8.6 AI failures (Asif)

| Test | Expect |
| :--- | :--- |
| `extract_fields` raises | `source: rules_fallback` (text) or `failed` (image) |
| Slower than the timeout | Same, with `error.reason: timeout`, in about 1 s |
| Bad output | `failed`, `invalid_ai_output` |
| 3 failures in a row | Breaker opens; the next call falls back in under 100 ms; health shows `ai: unavailable` |
| No transaction held | During a slow mocked call, `pg_stat_activity` shows no `idle in transaction` from the app |
| Injection document | Extraction is `pending_review`; status, owner and amount unchanged |

### 8.7 Contract check

```bash
npx -y @redocly/cli@2.78.0 lint docs/openapi.yaml                                  # Node 22.12+
npx -y @stoplight/prism-cli@5.14.2 proxy docs/openapi.yaml http://localhost:8000 -p 4011 --errors
# send the smoke script or curls to :4011; a response that breaks the contract becomes an error
```

### 8.8 curl (Git Bash)

```bash
BASE=http://localhost:8000
jget() { python -c "import sys,json
d=json.load(sys.stdin)
for k in sys.argv[1].split('.'): d=d[int(k)] if k.isdigit() else d[k]
print(d)" "$1"; }
login() { curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"Demo@1234\"}" | jget data.token; }
code() { curl -s -o /dev/null -w '%{http_code}\n' "$@"; }
ver() { curl -s "$BASE/api/cases/$1" -H "Authorization: Bearer $OP" | jget data.version; }
OP=$(login operator1@opscenter.test); VA=$(login viewer@bank-a.test); V1=$(login victim1@mail.test)
```

**Happy path (gate 14).** Each step satisfies API_SPEC §3.3 before the case leaves Received.

```bash
# 1. A verified victim reports (seeded victim1)
curl -s -X POST "$BASE/api/victim/cases" -H "Authorization: Bearer $V1" -H 'Content-Type: application/json' -d '{
  "bank_id":"bank_b","victim":{"name":"Victim One","phone":"+81-90-0000-0101"},
  "amount":120000,"currency":"JPY","transfer_date":"2026-11-01","scam_type":"phishing","consent":true}'

# 2. An operator creates a paper case with only a name; the rest comes from the document
CASE=$(curl -s -X POST "$BASE/api/cases" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' \
  -d '{"bank_id":"bank_b","channel":"paper","victim":{"name":"Paper Victim"}}' | jget data.id)

# 3. Upload, extract, accept with EVERY field Received → Verified needs
DOC=$(curl -s -X POST "$BASE/api/cases/$CASE/documents" -H "Authorization: Bearer $OP" \
  -F "file=@eval/docs/paper_form_01.txt" -F "doc_type=intake_form" | jget data.id)
EXT=$(curl -s -X POST "$BASE/api/documents/$DOC/extract" -H "Authorization: Bearer $OP" | jget data.id)
curl -s -X POST "$BASE/api/extractions/$EXT/review" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' -d "{
  \"decision\":\"accept\",\"expected_version\":$(ver $CASE),
  \"fields\":{\"victim_phone\":\"+81-90-0000-0102\",\"amount\":250000,\"transfer_date\":\"2026-10-28\",
            \"account_number\":\"0012345\",\"scam_type\":\"impersonation\"}}"
curl -s "$BASE/api/cases/$CASE" -H "Authorization: Bearer $OP" | jget data.flags.missing_fields      # → []

# 4. Move to Verified (expect 200) and read the history
code -X POST "$BASE/api/cases/$CASE/transition" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' \
  -d "{\"to_status\":\"verified\",\"expected_version\":$(ver $CASE)}"
curl -s "$BASE/api/cases/$CASE/history" -H "Authorization: Bearer $OP"
```

**Error paths (each prints the expected code):**

```bash
code "$BASE/api/cases"                                                         # 401 no token
code "$BASE/api/cases/$CASE" -H "Authorization: Bearer $VA"                    # 404 bank_a viewer reads a bank_b case
code "$BASE/api/cases" -H "Authorization: Bearer $V1"                          # 403 victim on a staff route
code -X PATCH "$BASE/api/cases/$CASE" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' \
  -d '{"amount":1,"expected_version":0}'                                       # 409 STALE_CASE
code -X POST "$BASE/api/cases/$CASE/transition" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' \
  -d "{\"to_status\":\"closed\",\"closure_reason\":\"paid_out\",\"note\":\"x\",\"expected_version\":$(ver $CASE)}"   # 403 supervisor only
code -X POST "$BASE/api/auth/signup" -H 'Content-Type: application/json' \
  -d '{"email":"x@mail.test","password":"a-long-password","name":"X","role":"supervisor"}'   # 422 no role field
code -X POST "$BASE/api/auth/logout" -H "Authorization: Bearer $V1"; code "$BASE/api/auth/me" -H "Authorization: Bearer $V1"   # 200, then 401
for i in $(seq 1 6); do code -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"operator1@opscenter.test","password":"wrong"}'; done           # 401 ×5, then 429
```

**Sign-up by hand:** call `POST /api/auth/signup`, copy the verification link printed in the server log (`EMAIL_MODE=console`), then call `POST /api/auth/verify-email` with its token.

**PowerShell:** use `curl.exe` (plain `curl` is an alias there) or `Invoke-RestMethod`:

```powershell
$OP = (Invoke-RestMethod -Method Post http://localhost:8000/api/auth/login -ContentType 'application/json' `
  -Body '{"email":"operator1@opscenter.test","password":"Demo@1234"}').data.token
Invoke-RestMethod "http://localhost:8000/api/cases?page_size=5" -Headers @{ Authorization = "Bearer $OP" }
```

**Smoke script** (`scripts/smoke.sh`, Anim): runs the happy path and the error paths, prints PASS/FAIL per line, exits non-zero on any failure. It runs against `:8000`, or `:4011` for the contract check too.

```bash
uv run pytest -q                                   # all tests
uv run pytest --cov=app --cov-report=term-missing  # aim for 80%+ on app/services
uv run ruff check . && uv run ruff format --check .
```

---

## 9. Definition of Done (an endpoint becomes `LIVE`)

- [ ] Matches API_SPEC and `openapi.yaml`; no errors through the Prism proxy
- [ ] Role check + RLS scope; another bank's record or another victim's case → exactly 404
- [ ] Commits before success; the audit entry is in the same transaction
- [ ] Case writes use the version check; the concurrency test passes
- [ ] The §8.3 tests pass; curl works; it appears in Swagger with its error responses
- [ ] No network call inside a transaction; no secrets or personal data in logs; money as JSON numbers
- [ ] Asif sets the endpoint to `LIVE` in API_SPEC §5

---

## 10. Git workflow

| Change | Path to `main` |
| :--- | :--- |
| API contract (`docs/API_SPEC.md`, `docs/openapi.yaml`) | Branch → PR → **one teammate's approval** → merge |
| Shared config or framework (`pyproject.toml`, `uv.lock`, `.env.example`, `main.py`, `config.py`, `db.py`, `security.py`, migrations, `tests/conftest.py`) | Branch → PR → **one approval** → merge |
| Another person's area | Branch → PR → **that owner's approval** |
| A small change inside your own area | Straight to `main` after `git pull origin main` |

- **Branches:** `asif/<topic>` and `anim/<topic>`.
- **Commits:** Conventional Commits. No AI attribution anywhere.
- **Before pushing:** `git pull origin main`.

---

## 11. Contract v0.4.0 and what we left out

**In v0.4.0** (docs updated; needs PR approval):
- accounts for victims and staff (D15), logout, password reset, invitations, deactivation
- edit rules
- `version` + `409 STALE_CASE`
- `409 CASE_CLOSED`
- realistic deadlines
- money as JSON numbers
- `Retry-After` on 429
- `payout_amount`
- `possible_duplicate`
- the bluebook `audience` tag
- safe download headers
- deduplicated view audit
- "no API versioning during the hackathon"

**Left out on purpose (simpler):**
- `Idempotency-Key`: disabled buttons + `possible_duplicate` instead
- JWTs: opaque sessions instead
- a separate security-events table: denied requests go to the request log
- a repository layer
- background job queues

**Future work:** §5.5, plus multi-factor login and the audit-log retention policy from the design review (M6, M7).

## 12. Decisions the team still needs

1. **Must a victim have a verified account before reporting?** v0.4.0 says yes: one path, follow-up and chat work, and no access codes. The alternative is anonymous reporting plus a later claim.
2. **Email for the live demo:** which free SMTP provider? Console mode is enough for development and tests.
3. **D2:** do operators see all five banks, or only assigned banks?
4. **Phone/paper victims** (Phase 4): is the email invite + claim enough, or do we skip victim access for those cases in the hackathon?
