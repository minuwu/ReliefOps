# Anim's Work Log

Owner: Anim (`anim710`) — Role: Backend / Services / Database — Branches: `anim/*`

Update after each work session. Newest entry first. Bangladesh time (UTC+6). Link commits/PRs/XREQs.

My area (backend guide §1): the app framework (`create_app`, settings, errors, envelope, logging, rate limits), accounts and authentication, email, seed data, the cases domain (`case_workflow.py`, cases routes), dashboard and alerts, staff chat, bluebooks, the smoke script, and the use-case diagram.

---

## 2026-11-15 (session 3) — review of the team's backend, then N1 (app framework)

### Review of Asif's and Galib's work (read in full; suite run independently)
I read Asif's whole work log, [REMAINING_WORK.md](../asif/REMAINING_WORK.md), migrations 001–002, `db.py`, `caller.py`, `service_errors.py`, `case_sql.py`, `audit.py`, the victim-chat router and the AI engine, against API_SPEC v0.4.2 and the backend guide.

- **Independent check:** on a fresh `pgvector/pgvector:pg16` Docker database (not Asif's machine), migrations 001→004 apply cleanly and **all 375 existing tests pass**. The database rules are real, not just claimed.
- **What's solid:** `FORCE` RLS on every table, no `DELETE` grant anywhere, a statement-level append-only audit trigger, scope re-applied on every transaction, atomic `WHERE version = :expected` updates, no transaction held during AI calls (proven with `pg_stat_activity`), a real circuit breaker, and a 404 (never 403) for another bank's case. Asif's services are built so my routers can stay thin.

| Severity | Finding | Owner | Action |
| :--- | :--- | :--- | :--- |
| 🔴 Critical | The three `*_API_KEY` entries in the committed `backend/.env.example` (commit `fe22150`) have real-key lengths (59–81 characters), not placeholders. The repo is on GitHub. I didn't open or copy the values. | Galib | Rotate all three keys now, replace them with empty values in `.env.example`, and keep real keys only in the untracked `backend/.env`. Deleting them from the file doesn't undo the exposure; rotating does. |
| 🟠 High | On Windows, connecting to a Postgres that's down doesn't fail fast. With no connect timeout, every request (even `/api/health`) could hang during an outage. | Anim (fixed in my area) | `Settings.app_database_url` adds `connect_timeout` (`DB_CONNECT_TIMEOUT_SECONDS`, default 5). Asif may also want a default in `db.init_engine`. |
| 🟡 Medium | My use-case diagram ([use-cases.excalidraw](../../docs/diagrams/use-cases.excalidraw)) is still at contract v0.3.0. It shows "Issue victim access code", which v0.4 removed (victims now have accounts). | Anim | Update it to v0.4.2. |
| 🟡 Medium | The XREQ-003 card in AGENTS.md still asks for `/api/intake` and access codes, which the contract replaced with victim accounts. The row is still `[PENDING]`. | Anim + Asif | Answer the card with the v0.4.2 routes and split it: auth is mine, victim cases and chat are Asif's. |
| 🟡 Medium | Review item H4 asked for `token_version`. With opaque sessions that are checked in the database on every request (guide §5.2), logout and deactivation already take effect at once, so `token_version` isn't needed. | Anim | Close H4 with the per-request session lookup in N2, no migration. |
| 🟢 Low | Newer Ruff versions widen the default rule set. Someone pinned `select = ["E4", "E7", "E9", "F"]` in `pyproject.toml`, so the whole team gets the same result. | — | Done. |
| 🟢 Low | Old stash `stash@{0}` ("local excalidraw re-save before pull", 2026-11-14) is still on my machine. | Anim | Check it against the current diagram, then drop it. |

### Completed
- **Pulled `main`** three times today (Asif's 27 + 30 + 12 commits, Galib's AI work). All fast-forwards, no conflicts.
- **`pyproject.toml` + `uv.lock`** (`1ab74c0`): Python 3.12, uv-managed, `package = false`. Runtime: FastAPI, SQLModel, SQLAlchemy, psycopg, Alembic, pydantic-settings, pwdlib[argon2]. Galib's AI packages moved in from `requirements-ai.txt` (as that file asked). Dev group: pytest, pytest-cov, freezegun, ruff, pyyaml, jsonschema. `migrations/README.md` now says `uv sync`. Installed uv 0.13.8 locally.
- **N1, app framework:**
  - [config.py](../../backend/app/config.py): `Settings` from env / `.env`, dev defaults, comma-separated `CORS_ORIGINS`, refuses dev database URLs when `APP_ENV=prod`, `ai_configured` for health.
  - [errors.py](../../backend/app/errors.py): `ApiError` is Asif's `ServiceError`, so services and routers raise one type. Handlers: `ApiError` → its status and code (`429` adds `Retry-After` from `details.retry_after`); validation → `422 VALIDATION_ERROR` with `details.fields[{field, message}]`; invalid JSON → `400 BAD_REQUEST`; unknown route → `404 RESOURCE_NOT_FOUND`.
  - [responses.py](../../backend/app/responses.py): `ok()`, `Envelope[T]`, `ErrorEnvelope`, `error_responses()` for Swagger; re-exports Asif's `Money`, `Page`, `PageParams`.
  - [middleware.py](../../backend/app/middleware.py): pure ASGI. One log line per request (request ID, method, route template, status, duration, user ID, never the query string, headers or body), an `X-Request-ID` header, and unexpected exceptions become a `500 INTERNAL_ERROR` envelope inside CORS.
  - [main.py](../../backend/app/main.py): `create_app(settings)` with `db.init_engine` and `extraction_engine.configure` in the lifespan, CORS (exposes `Retry-After`, `X-Request-ID`, `Content-Disposition`), and a `ROUTERS` tuple that teammates add one line to.
  - [routers/reference.py](../../backend/app/routers/reference.py): `GET /api/health` (`db` / `ai` / `rag` per the contract, always 200) and `GET /api/banks`.
  - `.env.example`: appended the app settings block (guide §3.6). Galib's lines are untouched.
- **Tests:** [tests/unit/test_app.py](../../backend/tests/unit/test_app.py) has 16 tests with no database: every error family, `Retry-After`, the 500 envelope with CORS, request IDs, no secrets in the request log, CORS preflight, health with the database down, AI breaker → `unavailable`/`degraded`, `AI_MODE=off`, settings validation, OpenAPI builds. **391 tests pass** (375 + 16); Ruff clean.
- **Live check:** against the Docker database, `/api/health` returns `db: ok`. `/api/banks` returns `[]` until the seed (N5).

### Local test database (for anyone on Windows without Postgres)
```bash
docker run -d --name reliefops-pg -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:55433:5432 pgvector/pgvector:pg16
docker exec -i reliefops-pg psql -q -U postgres < backend/scripts/bootstrap_db.sql
for d in fraud_relief fraud_relief_test; do docker exec reliefops-pg psql -q -U postgres -d $d -c "CREATE EXTENSION IF NOT EXISTS vector;"; done
export TEST_MIGRATIONS_DATABASE_URL=postgresql+psycopg://migrator:migrator_password@127.0.0.1:55433/fraud_relief_test
export TEST_DATABASE_URL=postgresql+psycopg://app_user:app_password@127.0.0.1:55433/fraud_relief_test
cd backend && uv run pytest -q
```

### Process note
- Guide §10 says framework files (`pyproject.toml`, `main.py`, `config.py`, `security.py`, `tests/conftest.py`) go through a branch, a PR and one approval. **Decision (Anim, 2026-11-15):** push each finished task straight to `main` after `git pull`, so Asif and Galib can wire their routers at once. **Asif: please review `1ab74c0` and the N1 commit on `main` after the fact,** the same way session 7 handled the contract.

### Next (in order, each: tests → commit → pull → push)
- **N2** `security.py`: argon2 hashing, opaque session tokens (SHA-256 in `sessions`), `Principal` (`.scope()`, `.actor()`), `CurrentPrincipal` / `StaffUser` / `SupervisorUser` / `VictimUser`, and `SessionDep` from `db.session_for(who.scope())`.
- **N3** login, logout, me, in-memory rate limits with `Retry-After`. **N4** `email.py`. **N5** seed. **N6** API test harness (`tests/api/conftest.py`).
- Then N7 (sign-up, verify, reset), N8 `case_workflow.py`, N9–N11 (cases: XREQ-001).

### Blockers / handoff
- **Galib:** rotate the AI keys (critical finding above).
- **Asif:** N1 is ready to build on. Raise `ApiError`/`ServiceError` as before. A `429` with `details.retry_after` gets `Retry-After` automatically, so the victim-chat router's manual `JSONResponse` can go. Add routers to `ROUTERS` in `main.py`. `Principal` and `SessionDep` come in N2.

### Related issues / commits / PRs
- `1ab74c0` chore(backend): add pyproject.toml and uv.lock
- N1: feat(backend): app framework (this session)

---

## 2026-11-15 (session 2) — contract v0.4.1 fixes

### Completed
- `b7af9b8` docs(api): fixed mismatches between `API_SPEC.md` and `openapi.yaml` (v0.4.1):
  - the reject-review example now sends `expected_version` (the schema always required it);
  - `POST /api/victim/cases`: phone and email optional; `victim.email` defaults to the account's verified email;
  - revoking an invitation that isn't pending documents `409 INVALID_STATUS_TRANSITION`;
  - `User` gained `is_active`; `GET /api/users` gained `include_inactive` (supervisor only); deactivated logins return `401 INVALID_CREDENTIALS`.

### Next
- Start the backend framework once Asif's migrations land.

---

## 2026-11-15 — incoming cross-functional dispatch (frontend ready, XREQ-003 & XREQ-001)

### Pending XREQs Assigned (AGENTS.md §2)
- **`[XREQ-003]` (P1 High)**: Public Citizen Intake & 6-Stage Progress Tracker (`POST /api/intake`, `POST /api/victim/auth`, `GET /api/victim/cases/{reference}`, `POST /api/victim/chat`).
- **`[XREQ-001]` (P0 Blocker, Pairing with Asif)**: Core Cases & Bank Tenant Isolation API (`GET /api/cases`, `GET /api/cases/{id}`, `POST /api/cases/{id}/transitions`).

### Frontend Status & Handoff
- Citizen Portal (`/victim`) is fully built with 1-click test credentials, intake form, and 6-stage lifecycle stepper.
- Backend intake route needs to generate reference (`RFR-2026-XXXXX`) and access code (`XXXX-XXXX-XXXX`).
- Ensure status transitions strictly enforce the statutory sequence (`received` -> `verified` -> `account_check` -> `notice_published` -> `payout_review` -> `closed`).

*(Update 2026-11-15, session 3: contract v0.4.2 replaced the access-code flow with victim accounts. The transition route is `/transition`, singular. See the review table above.)*

---

## 2026-11-14 (session 2) — use-case diagram

### Completed
- `cafabcf` docs: added [docs/diagrams/use-cases.excalidraw](../../docs/diagrams/use-cases.excalidraw), the use-case diagram derived from API_SPEC. Merged as PR #6 (`anim/use-case-diagram`, `de8949d`).
- Asif later updated it to contract v0.3.0 (`17a11bf`, his session 5) and asked me to check the layout.

### Next
- Review Asif's v0.3.0 diagram update and his direct-to-`main` contract commits `fc67951`…`b23b97c` (his session 7 asked Minhaz and me for a retroactive review).

---

## 2026-11-14

### Completed
- Cloned the repository, enabled the pre-push sync hook, and registered as a contributor (`fa61915`: AGENTS.md §5, TEAM_INSTRUCTIONS.md, README, contributors index).

### Next
- Read AGENTS.md and docs/SKILLS.md; claim a first backend task with Asif at kickoff.

### Blockers / handoff
- None.

### Related issues / commits / PRs
- Branch `anim/onboarding`
