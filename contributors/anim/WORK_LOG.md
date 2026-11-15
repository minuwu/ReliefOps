# Anim's Work Log

Owner: Anim (`anim710`) — Role: Backend / Services / Database — Branches: `anim/*`

Update after each work session. Newest entry first. Bangladesh time (UTC+6). Link commits/PRs/XREQs.

My area (backend guide §1): the app framework (`create_app`, settings, errors, envelope, logging, rate limits), accounts and authentication, email, seed data, the cases domain (`case_workflow.py`, cases routes), dashboard and alerts, staff chat, bluebooks, the smoke script, and the use-case diagram.

---

## 2026-11-15 (session 5) — backend lead: finishing Asif's list, the contract and deployment

From this session on I lead the whole backend (Asif's area and mine).

### Completed (each step tested → commit → pull → push)
- **Security** (`9018383`): blanked the three AI keys in `backend/.env.example` without reading or printing them. No other tracked file has key-shaped strings (checked by prefix only). **The keys are still in git history, so Galib must rotate them.**
- **Migration 005** (`6d55546`): `users.preferred_language` (en/ja/bn) is now stored at sign-up, and reactivating a user is audited as the new `user.reactivated`. The downgrade restores the old action list `NOT VALID`, so the append-only log keeps its rows and test databases can still migrate to base. 756 tests pass twice in a row (down and up each session).
  - Process note: a folder-wide `ruff format` reformatted ~45 of Asif's and Galib's files; I reverted that churn before committing, so only real changes went in.
- **Asif's item 1, contract tests for his routes** ([test_contract_routes.py](../../backend/tests/api/test_contract_routes.py)): every route over HTTP, each body validated against the schema `openapi.yaml` declares **for that exact path, method and status**. It found real contract gaps right away: **21 operations could send `403`/`422`/`409` the contract didn't declare.**
- **Contract v0.4.3** (`869b477`, additive): declared those statuses (new shared `CaseClosed`), added `user.reactivated`, and **marked all 48 operations LIVE** in API_SPEC §5 (Asif's item 4). `redocly lint`: valid (5 expected warnings).
- **Asif's item 3, A12 Prism check:** the smoke run through `prism proxy --errors` gives **39/39 with 0 response violations**. It caught one bug, in my smoke script: it sent a `{}` body to `/extract`, which the contract defines with none.
- **Asif's item 2** was done in session 4 (the smoke script's full demo flow).
- **Asif's item 6:** I reviewed my own two edits to his tests (`test_db_scope.py`, `test_rls.py`). They count the fixture's own session instead of all sessions, intent unchanged, and are covered by the suite. Signed off as backend lead.
- **Deployment, XREQ-006** (`9dc1936`): `backend/Dockerfile` (python 3.12-slim, tesseract+jpn, uv-locked, non-root, prod by default, uvicorn `--proxy-headers`), `.dockerignore`, and [docs/DEPLOY.md](../../docs/DEPLOY.md) (Cloud Run + Postgres with pgvector, roles, secrets, migrate+seed job, flags, CORS, email decision, rollback).
  - **Rehearsed locally on an empty database with the same image:** no database URL → refuses to start; the job applies 001→005 and seeds; prod health `ok`; CORS allows `reliefops.web.app` and rejects others; **the login lockout is per client behind a proxy** (attacker IP → 429, another client → 200; without `--proxy-headers` everyone would share the proxy's IP); smoke 39/39 against the container.
- **XREQ cards:** 002, 003 and 005 → `[RESOLVED]` with proof; 006 → `[IN_PROGRESS]` (ready, cloud steps left); 004 unchanged (the freeze needs a team decision).

### Left (needs people or accounts, not code)
- **Galib:** rotate the three AI keys.
- **Team:** a Google Cloud project and database account for DEPLOY.md §1–5, the **email decision** (console vs SMTP), and the XREQ-004 freeze decision.
- **Minhaz:** test XREQ-001/002/003/005 against the live backend and mark them `[VERIFIED_AND_CLOSED]`.

---

## 2026-11-15 (session 4) — check after Asif's routes, and the full demo run in the smoke script

### What I checked after Asif's push (`3c506a3`)
- **All 48 contract operations are mounted**: every path and method in `openapi.yaml` is served, with none missing and none extra. **754 tests pass**; Ruff clean.
- Drove the guide §8.8 happy path over HTTP on the seeded database and validated every response against `openapi.yaml`: victim report and list, upload, download, extract (AI off → `rules_fallback`, low confidence), get extraction, review queue, review accept (`ReviewResultResponse`), a second review → `409 ALREADY_REVIEWED`, transition → Verified, history + CSV, audit logs for supervisor and viewer, victim-invite → `422` without an email. All match.
- XREQ-005's "victim chat errors aren't the error envelope" **doesn't reproduce in the real app**: a bad question is `422` and another victim's case is `404`, both a valid `ErrorEnvelope`. It was probably seen in a standalone test app.

### Completed
- **Smoke script: the demo flow is no longer skipped.** [scripts/smoke.sh](../../backend/scripts/smoke.sh) now runs paper case → upload Galib's intake form → bank_a viewer can't download it → AI extraction is `pending_review` and in the review queue → a person accepts → nothing missing → second review `409` → **Verified** → history has `case.created`, `document.uploaded`, `ai.review_accepted`, `case.status_changed` → CSV download.
  - Fix: Windows curl can't read Git Bash paths (`/e/...`), so the upload path goes through `cygpath -m` when it exists (no effect on Linux or macOS).
  - **39/39 PASS** against a real `fastapi run` server on the seeded Docker database.

### Asif's review list, by owner
- Asif: (1) contract tests for each of his routes, (3) the A12 Prism contract check, (4) mark routes LIVE in API_SPEC §5, (6) review my changes to his two tests.
- Mine: (2) the smoke demo run, **done above**.
- Shared: (5) `users.preferred_language` and a `user.reactivated` audit action. Both need migration 005, which is Asif's (guide §1.2); after that, my side is two small code changes.
- **Not in his list, and still blocking the live demo:** XREQ-006 deployment (no Dockerfile, host, cloud database, production CORS or email decision yet), rotating and blanking the three AI keys in `backend/.env.example`, the `409` on `/assign` missing from the contract, and the unanswered XREQ-005 card (all its routes are mounted now).

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
| 🟡 Medium | My use-case diagram ([use-cases.excalidraw](../../docs/diagrams/use-cases.excalidraw)) is behind the contract. *Correction:* Asif had already moved it to v0.4.0 with victim accounts (`6446b61`), but the stage deadlines (2/5/10/60/10 days), the review route and the `due_soon` rule were still old. | Anim | ✅ Done: updated to v0.4.2 (7/14/45/90/45 days, `/extractions/{id}/review`, due_soon = last 20%, ≥1 day). |
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

- **N8, case lifecycle rules** ([case_workflow.py](../../backend/app/services/case_workflow.py)): pure functions over a case row and the caller, so the cases routes, Asif's review and victim edits, and tests all use one set of rules (API_SPEC §3.1–3.3).
  - `allowed_transitions` gives the buttons in order (forward, back, closed): `verified` as an operator → `["account_check", "received", "closed"]`, the contract example. `allowed_closure_reasons`: operators `withdrawn`; supervisors `rejected`, `withdrawn`, plus `paid_out` only in `payout_review`. Viewers, victims and closed cases get `[]`.
  - `check_transition` raises the contract's errors. `409 CASE_CLOSED`. `403` for a non-staff role or a money closure by an operator. `409 INVALID_STATUS_TRANSITION` with `{from, to, allowed}` for a skipped step or `paid_out` outside `payout_review`. `422 VALIDATION_ERROR` for a missing `note` (back or close), `closure_reason` or `payout_amount`, or closure fields on a normal move. `422 MISSING_REQUIRED_INFO` with `missing_fields` when leaving `received` forward; closing needs no facts.
  - `deadline_state`: `none` (closed), `overdue`, `due_soon` (the last 20% of the stage, at least 1 day) or `on_track`. `transition_values` gives the column changes (new stage deadline, or closed fields).
  - [test_case_workflow.py](../../backend/tests/unit/test_case_workflow.py): 24 unit tests. **493 tests pass.**

- **N9, case list and detail (XREQ-001, reads)** ([services/cases.py](../../backend/app/services/cases.py), [routers/cases.py](../../backend/app/routers/cases.py), [models/cases.py](../../backend/app/models/cases.py)):
  - `GET /api/cases` (operator, supervisor, bank_viewer; victim → 403) is **one SQL query**: bank and operator joins, a correlated count for `shared_account_case_count`, and `count(*) over ()` for the total.
    - Filters: `status` (comma-separated, validated), `bank_id` (**ignored for bank viewers**), `assigned_to` (`me`, `unassigned` or a user ID), `deadline_state` (computed in SQL with the same `now` as the response field, so the filter and the field agree), `scam_type`, and `q` (reference, victim name or account number, with `%` and `_` escaped).
    - Sort by `deadline` (default), `reported_date`, `amount` or `updated_at`, nulls last and ties broken by reference. `page` and `page_size` ≤ 100.
  - `GET /api/cases/{id}`: the full `Case` with `allowed_transitions` and `allowed_closure_reasons` for this user, Asif's `case_documents()`, and notes (newest first). A **`case.viewed` audit is written at most once per 10 minutes**. Another bank's case → **404**.
  - `build_case` and `load_case` are ready for N10/N11 (writes return the full `Case`). The models reuse Asif's `UserRef`, `DocumentMeta` and `VictimOut`.
  - [test_cases_read.py](../../backend/tests/api/test_cases_read.py): 13 tests on the seeded data. **Contract check:** [contract.py](../../backend/tests/api/contract.py) + [test_contract.py](../../backend/tests/api/test_contract.py) validate every response from N1–N9 (health, banks, login, me, logout, sign-up, errors, the case list and 15+ case details) against `docs/openapi.yaml`.
  - Answered XREQ-001 in AGENTS.md (reads live; transition in N11). **510 tests pass.**

- **N10, create and edit a case** ([services/case_edits.py](../../backend/app/services/case_edits.py)):
  - `POST /api/cases` (operator, supervisor) → `201` with the full `Case`: a phone or paper case in `received` with a 7-day deadline and a `next_case_reference()` reference (from 00100). Only `bank_id`, `channel` and `victim.name` are required.
    - `web_form` → `422`, because the database requires victim consent for web forms and staff can't give it.
    - `assigned_operator_id`: an operator may assign only themselves (else `403`); a supervisor may assign any active operator or supervisor (anyone else → `422`).
    - `possible_duplicate` is set when contact, amount, transfer date and account match another case. Audited as `case.created`.
  - `PATCH /api/cases/{id}`: a missing field stays unchanged, `null` clears it, and `victim` merges field by field (Asif's `VictimPatch`). Name and currency can't be cleared, and an unknown field (e.g. `status`) is `422`.
    - The atomic version check goes through Asif's `case_sql.update_case`. **Two parallel edits → one `200`, one `409 STALE_CASE` with `current_version`, one audit entry.** A no-op keeps the version.
    - `deadline` is supervisor-only (`403`) and needs `deadline_reason` (`422`); it's audited as `case.deadline_changed` with the reason. Every other changed field goes into `case.updated` `changes` `{from, to}`. Closed → `409 CASE_CLOSED`; viewers and victims → `403`.
  - [test_case_edits.py](../../backend/tests/api/test_case_edits.py): 12 tests, every response validated against `openapi.yaml`. **525 tests pass.**

- **N11, transition and assign (finishes XREQ-001)** ([services/case_moves.py](../../backend/app/services/case_moves.py)):
  - `POST /api/cases/{id}/transition`: N8's rules plus the atomic version check. On success the case gets the new stage deadline (or the closed fields), and `case.status_changed` is audited ("Status Received → Verified") with the note in metadata and the closure reason and payout in `changes`.
  - `POST /api/cases/{id}/assign` (`operator_id`, `null` unassigns): operators may assign only themselves and unassign only their own cases; supervisors may assign any active operator or supervisor. Closed → `409`. The contract has no `expected_version` here, so it bumps the version without checking it. Audited as `case.assigned`.
  - [test_case_moves.py](../../backend/tests/api/test_case_moves.py): 9 tests, including **the full received → paid_out lifecycle**, `MISSING_REQUIRED_INFO` `[document]`, a skipped step, a back move without a note, money closures, **two concurrent transitions → one `200`, one `409`, one audit entry**, and every role. **535 tests pass.**
  - **XREQ-001 → `[RESOLVED]`** in AGENTS.md, with proof. Minhaz can switch the case screens off the mock.

- **N12, staff accounts** ([services/staff.py](../../backend/app/services/staff.py), [routers/staff.py](../../backend/app/routers/staff.py)):
  - `POST /api/invitations` (supervisor) → `201` `Invitation`, plus an email with a 72 h link `/accept-invitation?token=…`. `bank_id` is required for `bank_viewer` and refused for other roles (`422`). An email that already has an account or a pending invitation → `409 BAD_REQUEST` (the contract's code). An expired pending invitation is marked `expired` so the email can be invited again.
  - `GET /api/invitations` lists newest first; the status reads `expired` after 72 h. `POST /api/invitations/{id}/revoke` works only on pending ones (`409 INVALID_STATUS_TRANSITION` `{from, to: "revoked", allowed: []}`; unknown → `404`).
  - `POST /api/auth/accept-invitation` creates the account with the invited role and bank, email verified, and marks the invitation accepted in one transaction (single-use, `400 INVALID_TOKEN` after that).
  - `GET /api/users` (operator, supervisor): active users, with a `role` filter; `include_inactive` works only for supervisors. `PATCH /api/users/{id}` `{is_active}` (supervisor): deactivating **ends every session** and blocks login (`401 INVALID_CREDENTIALS`); reactivating restores it. A supervisor can't deactivate themselves (`422`).
  - Audited: `user.invited`, `user.invitation_revoked`, `user.joined`, `user.deactivated`.
  - **Open (Asif, contract):** there's no `user.reactivated` audit action, so a reactivation is recorded as `user.deactivated` with `changes.is_active {from: false, to: true}` and the summary "reactivated". Add the action in a migration and the contract?
  - [test_staff.py](../../backend/tests/api/test_staff.py): 8 tests, including **an invited bank_c viewer who, once joined, sees only bank_c cases**. Responses are validated against `openapi.yaml`. **545 tests pass.**

- **N13, notes**: `POST /api/cases/{id}/notes` (operator, supervisor) → `201` `Note`, body 1–4000 characters. Notes are **the one write a closed case still accepts**, and a note doesn't change the case's version. Audited as `note.added`; the case detail lists notes newest first. [test_notes.py](../../backend/tests/api/test_notes.py): 3 tests. **548 tests pass.**
- **Frontend check:** Minhaz's routes `/verify-email`, `/reset-password`, `/accept-invitation` and `/claim-case` read `?token=`, which **matches the links my emails send** (and Asif's claim link), so the email-link flows work end to end.

- **N14, dashboard and alerts** ([services/dashboard.py](../../backend/app/services/dashboard.py)):
  - `GET /api/dashboard/stats` (supervisor: all banks, or one with `bank_id`; bank_viewer: always their own bank, from RLS, with `bank_id` ignored and `workload: []`). Returns open, overdue, due-soon and unassigned counts, `avg_handling_days` (closed cases: `closed_at − reported_date`), pending AI reviews (total and low-confidence), `cases_by_status` (all 6 keys) and per-operator workload (every active operator, including idle ones).
  - The **overdue and due-soon SQL is the case list's own filter**, so the tests check that each dashboard number equals the case-list total for the same filter.
  - `GET /api/alerts/shared-accounts` (supervisor; `min_cases` 2–50): grouped by `(bank_id, account_number)`, most cases first, with total amount and the cases. **Never compares across banks** (that's XREQ-004 and still needs the team decision); the test checks that bank_a's single `9876543210` case doesn't join bank_b's ring.
  - [test_dashboard.py](../../backend/tests/api/test_dashboard.py): 6 tests, validated against `openapi.yaml`. **554 tests pass.**

- **N15, permission table** ([test_permissions.py](../../backend/tests/api/test_permissions.py), guide §8.5): API_SPEC §2 as data, one row per route, checked for operator, supervisor, viewer_b and victim1.
  - An allowed role must pass the role check (write routes get an empty body, so `422` and nothing is written). A denied role gets exactly `403`, no token gets `401` on every protected route, and the 9 public routes need no token. The cross-bank `404` is checked too.
  - **Guard:** a test fails if a mounted `/api/*` route is missing from the table, so a new route can't ship without its permission row. **When §2 changes, change this table first.**
  - 91 checks. **645 tests pass.**

- **N16, smoke script** ([scripts/smoke.sh](../../backend/scripts/smoke.sh), guide §8.8): `bash scripts/smoke.sh [BASE]` against a running, seeded server (or the Prism proxy on `:4011`). PASS/FAIL per line, non-zero exit on any failure.
  - Covers health, banks, demo logins, victim3 → `EMAIL_NOT_VERIFIED`, `401`/`403`, **cross-bank 404 and the bank_b-only list**, and victim chat. A phone case goes create → `MISSING_REQUIRED_INFO` → edit (version bump) → `STALE_CASE` → `403` money closure → assign → note → withdrawn → closed read-only. Then the dashboards, alerts, sign-up (`422` with a role, `202` otherwise), logout → `401`, and, last, 5 wrong passwords → `429`.
  - **Ran it against a real `fastapi run` server (uvicorn) on the seeded Docker database: 29/29 PASS.** The upload → AI extraction → review → Verified step is printed as `SKIP` until Asif's document routes are mounted.

### Handoff: what's live now (all on `main`)
- **My whole list is done (N1–N18).** Live routes: health, banks, all of `/api/auth/*`, invitations, users, cases (list, get, create, edit, transition, assign, notes), dashboard, alerts, staff chat (read and reply), bluebooks (list, upload, publish, archive), plus Asif's victim chat (mounted with real auth).
- **Asif: your services can get routers now.** Use `from app.security import StaffUser, AnyStaffUser, VictimUser, SessionDep` and raise `ApiError`/`ServiceError` as you do (a `429` with `details.retry_after` gets `Retry-After` automatically). Add each router to `ROUTERS` in `main.py` **and a row to `tests/api/test_permissions.py`** (its guard test fails on an unlisted route).
  - Still unrouted: documents upload/download, extract, get extraction, review, review queue, case history + CSV, audit logs, victim cases (report, list, get, patch), victim invite + claim.
  - `tests/api/conftest.py` gives you `client`, `login_as(...)` and the seeded data; `tests/api/contract.py` `validate(body, "SchemaName")` checks a response against `openapi.yaml`.
- **Open questions for Asif:** (1) `users.preferred_language` column, or drop the field from `SignupRequest`? (2) add a `user.reactivated` audit action? (3) a default `connect_timeout` in `db.init_engine`?
- **Galib:** rotate the three AI keys in `backend/.env.example` (critical finding at the top).

- **N17, staff side of the case chat** ([services/staff_chat.py](../../backend/app/services/staff_chat.py), [routers/staff_chat.py](../../backend/app/routers/staff_chat.py)):
  - `GET /api/cases/{id}/chat` (operator, supervisor, bank_viewer for their own bank; another bank → 404; victims → 403): **the same `ChatThread` the victim sees**, through Asif's `victim_chat.get_thread`.
  - `POST /api/cases/{id}/chat/reply` (operator, supervisor) → `201` `ChatMessage` with `role: "staff"`, the author's name, and the case's language. In one transaction it writes the message, **clears `victim_question_pending`** and audits `chat.staff_replied`. RLS only lets staff insert `staff` rows under their own `author_id`, so a reply can't pose as the assistant. Allowed on closed cases, like notes.
  - [test_staff_chat.py](../../backend/tests/api/test_staff_chat.py): 3 tests, including **victim asks for a person → escalated → staff reply → flag cleared → the victim sees the reply**. Both new routes were added to the permission table. **658 tests pass.**

- **N18, bluebooks** ([services/kb.py](../../backend/app/services/kb.py), [routers/kb.py](../../backend/app/routers/kb.py)):
  - `GET /api/kb/documents` (`bank_id`, `status`): staff see all banks, bank viewers only their own (RLS; `bank_id` ignored), victims → 403.
  - `POST /api/kb/documents` (supervisor, multipart: `file`, `bank_id`, `title`, `version`, `language`, optional `audience`, default `victim_facing`) → `201` with status `processing`. The type is checked from the file's bytes (PDF or UTF-8 TXT, else `400`); over 20 MB → `413 FILE_TOO_LARGE`. Audited as `kb.document_uploaded`.
  - **Indexing runs as a background task** in the system scope: Galib's `rag.split_bluebook`, then `rag.embed` with **no transaction open during the call**. If embedding is unavailable, passages are stored without vectors and retrieval falls back to keywords. No numbered sections or an unreadable file → `failed` with a reason.
  - `publish` works only from `ready` (else `409 INVALID_STATUS_TRANSITION`) and **archives the older published version with the same title**. `archive` works from any status and is idempotent. Audited as `kb.document_published` / `kb.document_archived`.
  - [test_kb.py](../../backend/tests/api/test_kb.py): 6 tests, including upload → ready (3 passages) → publish replaces the seeded bank_e version → archive, a failed file, type and size checks, and **Galib's real `bank_a_bluebook.pdf` indexing into exactly as many passages as his `kb_passages.json`**. The 4 routes were added to the permission table. **684 tests pass.**

- **Diagram → v0.4.2** ([use-cases.excalidraw](../../docs/diagrams/use-cases.excalidraw)): stage deadlines now 7/14/45/90/45 days (API_SPEC §3.1), the review label is `POST /extractions/{id}/review`, the lifecycle note gives the `due_soon` rule, and the subtitle says v0.4.2. Only those 8 labels changed; the file keeps its own format.
- **XREQ-003 answered** in AGENTS.md: the auth and account part is live (mine), victim chat is live (Asif's router, mounted), and victim-case report/list/edit/claim still need Asif's routers, so it stays `[IN_PROGRESS]`.
- **All my assigned tasks are done (N1–N18).**

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
- ~~N3~~, ~~N4~~, ~~N5~~, ~~N6~~, ~~N7~~, ~~N8~~, ~~N9~~, ~~N10~~, ~~N11~~ done (Phase 2 complete; XREQ-001 resolved). ~~N12~~, ~~N13~~, ~~N14~~, ~~N15~~, ~~N16~~ done (Phase 3 complete).
- ~~N17~~, ~~N18~~ done (Phase 4 complete), diagram updated, XREQ-003 answered. **Every task assigned to me in the backend guide is done.** What's left is review and integration: Asif's routers, the open questions below, and Minhaz verifying XREQ-001.

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
