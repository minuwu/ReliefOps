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

- **N2, security** ([security.py](../../backend/app/security.py)):
  - argon2id hashing via `pwdlib`. An unknown email still runs one verification (timing), and a malformed stored hash counts as a wrong password, never a 500.
  - Opaque `secrets.token_urlsafe(32)` session tokens; only the SHA-256 is stored. `issue_session()` returns the plaintext once.
  - Every request looks the token up in `sessions ⋈ users` (system scope): unknown, expired, revoked, or deactivated user → `401 UNAUTHORIZED`. This **closes review item H4 without `token_version`**.
  - `Principal` (frozen dataclass) satisfies Asif's `Caller`: `.scope()` → `db.Scope` (bank only for bank viewers), `.actor()` → `audit.Actor`.
  - Dependencies: `CurrentPrincipal`, `StaffUser` (operator/supervisor), `AnyStaffUser` (+ bank_viewer), `SupervisorUser`, `VictimUser` (verified; else `403 EMAIL_NOT_VERIFIED`), `require_roles(...)` for other mixes, and `SessionDep` (`db.session_for(who.scope())`, `scope="function"`, so it closes before the response is sent).
  - The request log now records the user ID, never the token.
  - **Asif's victim-chat router is mounted** in `main.py` with `get_principal` and `ChatSettings` from settings.
  - [test_security.py](../../backend/tests/database/test_security.py): 22 tests on the real database, covering hashing, token lookup (expired, revoked, deactivated, oversized), every role dependency, the bank scope through `SessionDep` (a bank_a viewer sees only bank_a), the log line, and the mounted chat routes. **413 tests pass.**

- **N3, login / logout / me + rate limits:**
  - [rate_limit.py](../../backend/app/rate_limit.py): an in-memory sliding window (thread-safe, injectable clock). `login_failures` = 5 per 15 min and `email_requests` = 5 per hour (for N7), per IP and per email. `enforce()` raises `429 RATE_LIMITED` with `details.retry_after`, which the N1 handler turns into `Retry-After`. `reset_rate_limits()` is for tests.
  - [services/auth.py](../../backend/app/services/auth.py) + [routers/auth.py](../../backend/app/routers/auth.py): `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.
    - A wrong password, an unknown email and a deactivated account all get the same `401 INVALID_CREDENTIALS`. An unverified victim gets `403 EMAIL_NOT_VERIFIED`, but only with the right password.
    - The 6th failure in 15 minutes is `429` even with the right password, and a success clears that email's failures.
    - `auth.login`, `auth.login_failed` (with `reason`) and `auth.logout` are audited, never with the password. Logout ends only the current session. `revoke_all_sessions()` is ready for N7 and N12.
  - [models/auth.py](../../backend/app/models/auth.py): `LoginRequest` (`extra="forbid"`; login accepts the seed's 9-character `Demo@1234`, while the 10–128 rule is for new passwords in N7), `User`, `LoginResult`.
  - [test_auth_http.py](../../backend/tests/database/test_auth_http.py): 8 HTTP tests on the real database, plus a limiter unit test with a fake clock.
  - **Fixed two of Asif's tests** (`test_db_scope.py`, `test_rls.py`): they asserted exactly one row in `sessions`, which broke once login tests created sessions (guide §8.2: no global counts). They now count the fixture's own session. Intent unchanged. **Asif, please check.**
  - **422 tests pass** (two runs in a row); Ruff clean.

- **N4, email** ([email.py](../../backend/app/email.py)): `send(to, subject, body)` matches Asif's `claims.SendEmail`, so `send_email=email.send` plugs in.
  - Modes: `console` (dev; the message and link go to the `app.email` log, with a warning if used in prod), `smtp` (STARTTLS, login when a user is set, 10 s timeout) and `outbox` (tests; `email.outbox.last_token(to)` reads the link's token).
  - `send` never raises. Callers send after commit, so an SMTP error is logged with the recipient's domain only and never turns a saved change into a 500. `create_app` calls `email.configure(settings)`.
  - [test_email.py](../../backend/tests/unit/test_email.py): 4 tests with a fake SMTP. **426 tests pass.**

- **N5, seed** ([seed.py](../../backend/app/seed.py)): `uv run python -m app.seed` (uses `MIGRATIONS_DATABASE_URL`, `system` scope, one transaction).
  - **Accounts (API_SPEC §8), password `Demo@1234`:** `operator1` (the contract's example ID `1111…`), `operator2`, `supervisor`, `viewer@bank-a.test`, `viewer@bank-b.test`, `victim1` (owns `RFR-2026-00042`, verified, bank_b, the contract's example case ID), `victim2` (owns `RFR-2026-00051`, received, bank_c) and `victim3` (unverified → `403 EMAIL_NOT_VERIFIED`).
  - **42 cases** across all 5 banks and all 6 statuses; **6 overdue**; dates relative to the first run.
  - **3 same-bank shared accounts.** Account `9876543210` (GLOBAL ASSET TRUST) also appears at a second bank, for the fraud-ring story.
  - **39 documents** from Galib's 12 real sample files (clean, messy, the injection one).
  - **5 extractions** for the review queue: low-confidence LLM ×2, `rules_fallback`, standard, and one `failed` (`ai_unavailable`).
  - Plus 9 notes, `case.created` / `document.uploaded` audit entries, and the **5 published bluebooks with Galib's 70 pre-embedded passages**, so the assistant works without calling the embedding API.
  - **Idempotent:** fixed UUIDs and `ON CONFLICT DO NOTHING`; a second run changes nothing. `document_count` and `pending_extraction_count` match the real rows.
  - Checked over HTTP on the dev database: all 8 demo logins behave as the contract says, and `/api/banks` returns the 5 banks.
  - [test_seed.py](../../backend/tests/database/test_seed.py): 7 tests. `seed_into(conn)` runs inside a rolled-back transaction, so the shared test database stays clean for count-based tests. **433 tests pass.**

- **N6, API test harness** ([tests/api/conftest.py](../../backend/tests/api/conftest.py), guide §8.2):
  - Explicit `Settings` from `TEST_*` (never `.env`) with the `_test` guard, `EMAIL_MODE=outbox` and `AI_MODE=off`.
  - Once per session: migrate down to base and back to head, then **seed**, so every endpoint test starts from the §8 demo data.
  - Before each test: `reset_rate_limits()` and `email.outbox.clear()`.
  - `login_as("operator" | "supervisor" | "viewer_a" | "viewer_b" | "victim1" | …)` returns auth headers, with tokens cached per session.
  - [test_smoke.py](../../backend/tests/api/test_smoke.py): the §8.8 paths that work today, on seeded data (health, banks, every demo login, victim3 → `EMAIL_NOT_VERIFIED`, 401 without a token, logout → 401, 5 wrong → 429, the victim chat on case 00042 for its owner only).
  - `tests/api` and `tests/database` each migrate the same test database once. **441 tests pass in both folder orders.**

- **N7, sign-up / verify / resend / forgot / reset** ([services/accounts.py](../../backend/app/services/accounts.py)):
  - `POST /api/auth/signup` → always `202` with the same message. A new email gets a victim account (unverified) and a 24 h link `FRONTEND_BASE_URL/verify-email?token=…`; an existing email gets "you already have an account" and nothing changes. There's no `role` field, so sending one is `422`, and passwords must be 10–128 characters.
  - `verify-email` → `200`; `400 INVALID_TOKEN` for an unknown, used or expired token. `resend-verification` and `forgot-password` → always `202`, sending only when there's an account to act on.
  - A newer link cancels the older one. A reset link is valid for 1 h (`/reset-password?token=…`); the reset sets the password, **revokes every session**, and also counts as verifying the email.
  - Tokens are SHA-256 in `auth_tokens` and single-use through one atomic `UPDATE … RETURNING`: four concurrent uses → exactly one `200`. Rate limits: 5 per hour per IP and per email for each of sign-up, resend and forgot. Audited: `auth.signup`, `auth.email_verified`, `auth.password_reset`. Emails are sent after the commit.
  - [test_accounts.py](../../backend/tests/api/test_accounts.py): 11 HTTP tests. **452 tests pass.**
  - **Open (Asif):** `SignupRequest.preferred_language` is in the contract, but `users` has no column for it, so it's accepted and dropped for now. Add a `users.preferred_language` column, or remove the field from the contract?

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
- ~~N2~~ done.
- ~~N3~~, ~~N4~~, ~~N5~~, ~~N6~~, ~~N7~~ done.
- Next: N8 `case_workflow.py`, N9–N11 (cases: XREQ-001).

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
