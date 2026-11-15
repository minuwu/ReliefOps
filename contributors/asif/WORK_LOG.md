# Asif's Work Log

Owner: Asif (`MdAsif-Hossain`) — Role: Backend / Services / Database — Branches: `asif/*`

Use this log to share progress, planned work, and dependencies with the team. Update it after each work session, keep the newest entry first, and use Bangladesh time (UTC+6). Link to relevant issues, commits, or pull requests when available.

## 2026-11-15 (session 11) — my services, built before Anim's framework

Decision (Asif): build all my business logic as **service functions with database tests** now. When Anim's framework lands, each endpoint is a thin router on top. None of Anim's files are touched. How the pieces fit together:
- Services raise `ServiceError(status, code, message, details)` ([service_errors.py](../../backend/app/services/service_errors.py)); Anim's handler maps it to the envelope.
- They take a `Caller` ([caller.py](../../backend/app/services/caller.py)), which his `Principal` satisfies.
- `cases` is read and written through plain SQL ([case_sql.py](../../backend/app/services/case_sql.py)), so there's no second ORM mapping of his table.

### Completed (each part: tests → commit → pull → push to `main`)
- Test folder renamed `tests/rls` → `tests/database`: one shared, migrated test database for every database test.
- **B1, foundation:**
  - `ServiceError` and `Caller`.
  - Contract types in [common.py](../../backend/app/models/common.py) (`Money` serializes to a JSON number).
  - `case_sql`: the atomic version check (two parallel edits with the same version → exactly one wins), `CASE_CLOSED`, 404 for another bank's case, `403` when RLS refuses a write, the §3.3 missing-fields rule and the §3.1 stage deadlines.
  - 168 tests pass.
- **A6, victim cases** ([victim_cases.py](../../backend/app/services/victim_cases.py)): report, list, view and edit, following API_SPEC §3.5 and §6.7.
  - **Report:** a `received` web-form case linked to the account. The email defaults to the account's, the 7-day stage deadline is set, and a repeat report gets `possible_duplicate`.
  - **Visibility:** a victim sees only their own cases; anyone else's is `404`. Views are audited.
  - **Edits:** contact details until the case closes, report facts only while `received` (otherwise `409 CASE_LOCKED` with `locked_fields`). A phone or an email must remain, and edits need `expected_version`.
  - **Records:** each changed field is audited as `{from, to}`. An edit that changes nothing creates no new version.
  - 32 tests.

## 2026-11-15 (session 10) — backend Phase 1 done

### Completed (each part tested, then pushed to `main`)
- **Local database:** portable PostgreSQL 16.16 at `E:\pgsql16` (outside the repo), plus [bootstrap_db.sql](../../backend/scripts/bootstrap_db.sql) to create `migrator`, `app_user`, `fraud_relief` and `fraud_relief_test`.
- **A1** `73d8ac6`, migration 001: the 11 core tables.
  - Enums are text + CHECK.
  - Composite `(case_id, bank_id)` foreign keys keep every child row on its case's bank.
- **A2 + A5** `b663ad2`, migration 002: RLS forced on every table, and `app_user` has no `DELETE` grant anywhere.
  - The append-only audit trigger is statement-level, so it also blocks superusers. Tested live: `ERROR: audit_log is append-only`.
  - `next_case_reference()` starts at 100, so it never collides with the seeded references.
  - Also: XREQ-001 set to `[IN_PROGRESS]`, and `.gitignore` now covers coverage output and database dumps.
- **A3** `22e7536`, [app/db.py](../../backend/app/db.py): every transaction gets its scope (`after_begin` hook).
  - Tested: scope is re-applied after commit and rollback, a pooled connection doesn't leak it, and scope values can't inject SQL.
- **A4** `5efc472`, [app/services/audit.py](../../backend/app/services/audit.py): `record()`, `record_case_view()` (10-minute dedupe) and `diff()`.
  - No `RETURNING`, so victims and bank viewers can write audit entries.
  - Refuses passwords and tokens in metadata.
- **A9 engine** `05df5aa`, [extraction_engine.py](../../backend/app/services/extraction_engine.py): the API_SPEC §6.5 outcome table, timeout, concurrency limit, circuit breaker (`ai_status()` for health), validation of the AI's answer, and the rule-based fallback.
- **A8 checks** `576cc41`, [document_files.py](../../backend/app/services/document_files.py): file type from its first bytes, the 10 MB cap, safe filenames, and download headers (attachment, nosniff).
- **Tests:** 158 pass (`tests/rls` 104, `tests/ai` 29, `tests/unit` 25). Recipe in [backend/migrations/README.md](../../backend/migrations/README.md).

### Next (blocked on Anim's framework)
- A6–A15 endpoints need Anim's N1/N2:
  - `create_app`, `ApiError`/`ok()`;
  - `Principal` (with `.scope()` → `db.Scope` and `.actor()` → `audit.Actor`) and the `CurrentPrincipal`/`StaffUser`/`VictimUser` dependencies;
  - `pyproject.toml`, which until then means using `uv run --no-project --with ...`.
- Shared table models for `cases`, `documents` and `ai_extractions`: agree with Anim who writes `app/models/cases.py`.
- Migration 003 (Phase 4) needs pgvector, which the portable Windows build doesn't include. Use Docker or a hosted Postgres for it.

### Blockers / handoff
- **Anim:** call `db.init_engine(settings.database_url)` in `create_app`.
  - Build `SessionDep` from `db.session_for(who.scope())` (example in the `db.py` docstring).
  - Use `audit.Actor` in `Principal.actor()`.
  - The seed must run with `app.role = 'system'`, because FORCE RLS applies to the table owner too.
- **Galib:** raise `app.services.ai_errors.AIUnavailableError` from `extract_fields()`. The backend handles timeouts.

## 2026-11-15 (session 9)

### Completed
- Checked contract v0.4.1 on the Prism mock (port 4010).
  - Sent the documented example to all 48 operations: 48 returned their success code and the envelope.
  - Probed bad input: a privileged role or bank at signup is rejected; missing `expected_version` → 422; the 409/429/403 variants work; the removed v0.3 routes return 404.
- Fixed what the run found, as contract **v0.4.2** (additive only):
  - Real examples for `GET /api/victim/cases` and `POST /api/victim/claims`; the mock was returning `"string"` placeholders that broke the schema.
  - `404` on both victim chat routes.
  - `422` on claims and on `GET /api/users`.
  - §9.1 now says where the mock prints the real cause of a 422.
  - Re-ran everything: 48/48 pass, 0 schema violations, lint valid.
- Replayed the frontend's real requests against the mock: 15 of 22 accepted. The frontend is still on v0.3.0. `transition` and `review` use the old field names and send no `expected_version`, and all five victim calls hit removed routes.
- Wrote [contributors/minhaz/suggested_by_backend_team.md](../minhaz/suggested_by_backend_team.md): each problem with its fix and code, the new victim account flow, a proposal for the email-link URLs, error handling, type updates, answers to XREQ-001..004, and a suggested order of work.
- Added a [verify skill](../../.claude/skills/verify/SKILL.md) with the mock launch and drive recipe.

### Next
- Answer XREQ-001..004 in AGENTS.md with the contract routes (see Minhaz's note §9). XREQ-004 (fraud-ring freeze) needs a team decision first.
- Once Minhaz agrees the email-link paths, add `FRONTEND_URL` to the backend guide's env vars.
- Optional v0.4.3: `version` on `CaseSummary` and `case_version` on review items, if the frontend wants to skip the extra request.

### Blockers / handoff
- Minhaz: move the frontend to v0.4.2 (his note, sections 1–8).

## 2026-11-15 — incoming cross-functional dispatch (frontend ready, XREQ-001 & XREQ-004)

### Pending XREQs Assigned (AGENTS.md §2)
- **`[XREQ-001]` (P0 Blocker)**: Core Case Workstation & Bank Tenant Isolation API (`GET /api/cases`, `GET /api/cases/{id}`, `POST /api/cases/{id}/transitions`).
- **`[XREQ-004]` (P1 High)**: Cross-Bank Fraud Ring Topology & Coordinated Freeze API (`GET /api/analytics/fraud-rings`, `POST /api/analytics/fraud-rings/{account_number}/freeze`).

### Frontend Status & Handoff
- Frontend UI, Neo-Brutalist design system, and in-app interactive demo tour are 100% complete and tested.
- As soon as FastAPI routes in `backend/app/main.py` are live, Frontend will flip `USE_MOCK = false` for live end-to-end integration.
- Database models must enforce tenant isolation (Bank B viewer receives `404 RESOURCE_NOT_FOUND` on cross-bank queries).

---

## 2026-11-14 (session 8)

### Completed
- Installed the `backend-design-review` skill into the repo (`npx skills add … -a claude-code --copy -y`), read it in full (Markdown only, no scripts) and registered it in docs/SKILLS.md.
- Wrote [docs/plans/backend-design-review.md](../../docs/plans/backend-design-review.md): 0 new critical, 5 high, 8 medium, 6 low; 16 action items with owners and phases.
  - **H1:** circuit breaker for the AI provider.
  - **H2:** align the plan with guide v1.1 (database users, enums, HNSW, file table, `version`).
  - **H3:** apply contract v0.4.0.
  - **H4:** check the user against the database on every request, plus `token_version`.
  - **H5:** decide D2.

### Next
- One PR (Minhaz approves): contract v0.4.0 + plan alignment + versioning decision + shared 500 response (review items 1–5).

---

## 2026-11-14 (session 7)

### Completed
- Wrote [docs/plans/backend-development-guide.md](../../docs/plans/backend-development-guide.md):
  - work split between Asif and Anim, by area and by file
  - phases with hour-14 and hour-30 gates
  - setup, layers and shared interfaces, 13 endpoint rules, the CRUD recipe and database rules
  - testing: unit, API, database rules, permission table, AI failure, Prism contract proxy, curl for Git Bash and PowerShell, smoke script
  - Definition of Done; contract changes C1–C11 for v0.4.0
- Merged `asif/api-contract` into `main`: contract v0.3.0, openapi.yaml, backend plan, the updated use-case diagram, Galib's suggestions, this guide.
  - **Process miss:** AGENTS.md §3.5 requires a PR with one teammate's approval for contract changes and other people's areas (the diagram is Anim's). This went straight to `main`. Fix: Minhaz (contract) and Anim (diagram) review commits `fc67951`…`b23b97c` on `main` after the fact; from now on, contract changes go through a PR.
- Guide **v1.1** after a review, all 8 points fixed:
  - commit before the response (`scope="function"`), and `short_tx(who)` re-applies the scope
  - scoped, atomic duplicate protection, none on anonymous intake
  - atomic version check using an integer `version` (timestamps lose microseconds in JavaScript)
  - explicit test database with a `_test` guard and a reset between tests
  - corrected happy path (the case now meets the Received → Verified requirements) and a real cross-bank 404 test
  - lighter Phase 1 (security and seed → Anim; victim and assistant migrations → Phase 4), an hour-24 security and contract gate before extras, an early hello-world deploy
  - `Money` serialized as a JSON number
  - Node 22.12+, and the PR rule in §9

### Next
- Phase 0: contract v0.4.0 (C1–C4, C7) and agreeing the shared interfaces with Anim.

---

## 2026-11-14 (session 6)

### Completed
- Wrote [contributors/galib/suggested_by_backend_team.md](../galib/suggested_by_backend_team.md), the AI suggestions for Galib:
  - who owns what
  - extraction (confidence, evidence, the injection test, held-out measurement)
  - the case assistant (synthetic bluebooks with a `victim_facing`/`staff_only` tag, how to split them, answer rules, golden set, leak and refusal tests)
  - cost limits and failure behaviour
  - open questions and an hour-by-hour order
- Reviewed the whole system (22 findings) and then the backend in depth. The backend review found:
  - migrations and seed would run as `app_user`
  - background jobs have no database scope
  - database connections would be held open during 20 s AI calls
  - tests that run as superuser would skip the database rules, among others

### Next
- Apply the agreed fixes to the plan and the contract (v0.4.0).

---

## 2026-11-14 (session 5)

### Completed
- Updated Anim's use-case diagram [docs/diagrams/use-cases.excalidraw](../../docs/diagrams/use-cases.excalidraw) from contract v0.1.0 to v0.3.0 (137 → 208 elements), in the file's own style.
  - **Group 1:** + Open my case, View & edit my own case, Issue victim access code.
  - **Group 2:** "Edit case fields & add notes" split into Edit case fields and Add internal note (staff only).
  - **New group 5, Case assistant (RAG):** Ask, Rate an answer, Reply to the victim («extend» Ask), Read the case's chat.
  - **New group 6, Bluebooks (one per bank):** List and Manage.
  - **New system actor, Case assistant (RAG):** cyan, with a dashed arrow to the bluebooks labelled "reads only the published bluebook of the case's bank".
  - **Repeat copies** of Victim, Operator, Supervisor and Bank Viewer next to groups 5–6, so lines don't cross the whole diagram.
  - **All 26 existing actor lines** recalculated to the moved use cases.
  - Subtitle → v0.3.0; two notes bullets; legend entry "Case assistant".
- Kept the original JSON format (1-space indent, raw Unicode). Checked the layout with a rendered preview.

### Blockers / handoff
- **Anim:** your diagram now matches API_SPEC v0.3.0. Open it in Excalidraw and adjust anything you'd lay out differently.

---

## 2026-11-14 (session 4)

### Completed
- Pulled `main` and merged it into `asif/api-contract`. Resolved the `backend-plan.md` conflict with Minhaz's hardening by keeping both sides:
  - my victim decision became D13
  - S8 (login rate limit) is marked done
- Team decisions for the RAG chatbot: **victim-facing, one bluebook per bank, case-aware answers**. Recorded as D14.
- Contract v0.3.0 (API_SPEC + openapi.yaml), additive only:
  - victim chat: `GET /api/victim/chat`, `POST /api/victim/chat/messages`, `.../feedback`
  - staff side: `GET /api/cases/{id}/chat`, `POST /api/cases/{id}/chat/reply`
  - bluebooks per bank: list, upload, publish, archive (`/api/kb/documents*`)
  - rules in §3.6: the bank comes from the case; an allow-listed case summary only; no tools; no money promises
  - answer types: `grounded`, `passages_only`, `no_answer`, `refused`
  - escalation to staff through `flags.victim_question_pending`
  - AI interface in §7.2: `split_bluebook`, `embed`, `answer`. Retrieval stays in the backend so bank scoping is enforced by our database rules.
- `redocly lint`: the description is valid, with the same 5 expected warnings. Mock check: 401 with no token; the grounded, no_answer, passages_only and refused examples; 422 on a too-long question; staff thread and reply; bluebook list; 409 on publishing a document that isn't ready.
- backend-plan: D14; `kb_documents`, `kb_passages` (pgvector) and `chat_messages`; the pgvector image; RAG env vars; seed bluebooks; the chatbot failure table and measurement (golden set, cross-bank leak test, refusal test); timing (cut at the freeze if not stable).
- **Found and fixed a security hole in the planned database rules:** the case read rule matched `bank_id = app.bank_id` for any role. Victim sessions now set `app.bank_id` for retrieval, so they would have seen every case of their bank. The rule now requires `role = 'bank_viewer'` on that branch.

### Next
- Open questions 6–7 with Galib: the embedding and AI models for the assistant, and the bluebook language and translation.
- Minhaz's contract fixes S1–S7 and S9–S11 (plan §11) are still not applied.

### Blockers / handoff
- **Galib:** API_SPEC §7.2 (three functions) and backend-plan §6 (golden set and leak test). Write 5 synthetic bluebooks that differ on purpose.
- **Minhaz:** a victim chat UI on the mock. Use `Prefer: example=no_answer`, `passages_only` and `refused` for the edge cases, and show `victim_question_pending` on the staff board.

---

## 2026-11-14 (session 3)

### Completed
- Contract v0.2.0: victims can now view and edit their own case (decision D13 in backend-plan; first numbered D11, renumbered after merging Minhaz's D11/D12).
  - Intake returns a one-time `access_code` alongside the reference. Staff can issue a new one with `POST /api/cases/{id}/victim-access`, for phone or paper cases or a lost code.
  - `POST /api/victim/session` takes reference + code and returns a 1-hour token for that one case. `GET` and `PATCH /api/victim/case` use it.
  - Contact details are editable until the case closes; report details only while it is `received`; bank, status, documents and notes never. Anything else returns `409 CASE_LOCKED`. `editable_fields` tells the UI what is allowed.
  - Additive only: new error `CASE_LOCKED`, actor type `victim`, audit action `case.access_code_issued`.
- Updated docs/API_SPEC.md and docs/openapi.yaml together. `redocly lint` reports the description valid, with the same 5 expected warnings. Merged `main`, which brought in Galib's problem statement.
- Mock check on `localhost:4010`:
  - intake returns the access code; the victim session opens with the demo code
  - no token → `401`
  - the `received` example has every field editable; a contact edit → `200`
  - a locked field → `409`; an unknown field → `422`
  - staff can issue a new code
- backend-plan: D13, the requirement-map row, `victim_access_hash`/`victim_access_version` on `cases`, the victim RLS policy in §5, and a proof test.

### Next
- Decide whether victims may also upload documents. Galib's demo script (problem statement §8, step 1) has the victim upload one; it is not in the contract yet.

### Blockers / handoff
- **Minhaz (Frontend):** new screens: intake confirmation (reference + access code), "open my case" (reference + code), and the victim's case page with an edit form built from `editable_fields`. Try them on the mock with `Prefer: example=received` and `Prefer: code=409`.

---

## 2026-11-14 (session 2)

### Completed
- Added [docs/openapi.yaml](../../docs/openapi.yaml), the machine-readable OpenAPI 3.1 version of the contract:
  - all 23 endpoints and schemas
  - examples, including the AI-low-confidence, rule-based-fallback and AI-down paths
- Validated it with `npx -y @redocly/cli@2.78.0 lint docs/openapi.yaml`:
  - the description is valid
  - every example matches its schema
  - 5 warnings, all expected: localhost server URLs, no license field, no 4xx responses on `/health` and `/banks`
- Mock API with no backend: `npx -y @stoplight/prism-cli@5.14.2 mock docs/openapi.yaml` serves the contract at `http://localhost:4010`. I checked:
  - health and login responses
  - `401` when there's no token
  - the case list with a `status` filter
  - the AI-failed, fallback and `ai_down` examples via `Prefer`
  - a forced `404`, and the `422` envelope
  - a CORS preflight from `localhost:5173`
- API_SPEC v0.1.1:
  - links to openapi.yaml and adds the mock section (§9.1)
  - login can return `429`
  - names Galib as AI owner (§7)
- backend-plan:
  - team split (Backend: Asif, Anim; AI: Galib; Frontend: Minhaz)
  - SQLModel instead of plain SQLAlchemy, per the `fastapi` skill
  - login, JWT and CORS hardening, per ECC's FastAPI rules
  - updated open questions
- Installed ECC 2.2.3 locally (core profile, project scope, hooks on) as described in docs/SKILLS.md §6. `doctor` reports OK. ECC is machine-local and gitignored.
- Reviewed the branch's earlier commits (`fdc6808`, `f8b772b`):
  - compared with `main`, the branch changes only the contract, plan, work log, backend skeleton and knowledge graph
  - no attribution trailers

### Next
- Kickoff answers for backend-plan §10: AI provider, backend split with Anim, frontend framework.
- Open the PR `asif/api-contract` → `main`.
- Then start the backend from the contract (not before the team agrees the contract).

### Blockers / handoff
- **Minhaz (Frontend):** run the mock (API_SPEC §9.1) and point the API base URL at `http://localhost:4010`. Use the `Prefer` headers to build the error and AI-down screens.
- **Galib (AI):** API_SPEC §7 is the interface; backend-plan §6 is the accuracy plan.
- **Anim (Backend):** API_SPEC §6 lists the endpoints; backend-plan §4–5 covers the data model and bank separation.

---

## 2026-11-14

### Completed
- Read the Mock Hackathon #1 brief (fraud-relief case system for five banks). I own backend, database and devops.
- Wrote API contract v0.1 in [docs/API_SPEC.md](../../docs/API_SPEC.md):
  - 23 endpoints, tagged MVP / Should / Nice
  - role permissions table, status rules, error codes
  - TypeScript data types, JSON examples, seeded demo logins
  - the interface the AI module must implement
- Wrote [docs/plans/backend-plan.md](../../docs/plans/backend-plan.md):
  - decisions D1–D10
  - which endpoint covers each brief requirement
  - Postgres data model
  - bank-separation design (RLS)
  - AI failure plan
  - docker compose / env / deploy plan
  - backend milestones against the brief's checkpoints
- Created the backend skeleton `backend/app/{routers,services,models}`, following the team structure in HACKATHON_PRESETUP §3.
- Re-ran the `find-skills` install with the repo flags (`-a claude-code --copy -y`). The repo copy was already up to date; no changes.
- Branch: `asif/api-contract`.

### Next
- Get team sign-off on the open questions in backend-plan §10. These are Proposed decisions D1, D2, D4, D6, plus AI ownership and provider.
- Scaffold FastAPI (CORS, response envelope, `/api/health`), `docker-compose.yml` with Postgres, `.env.example`; deploy the hello-world.
- First Alembic migration with RLS policies and the audit trigger, then the seed script (≥ 30 cases, ≥ 10 documents).

### Blockers / handoff
- **Ready for Frontend (Minhaz):** API_SPEC v0.1. Build mocks from §4 data types and §6 examples; build order is in §5. Change requests go through an `XREQ`.
- **Ready for the AI owner:** API_SPEC §7 (the `extract_fields` interface) and backend-plan §6 (how accuracy is measured).
- Waiting on the kickoff decisions above. Work continues on the Proposed defaults until then.

### Related issues / commits / PRs
- Branch `asif/api-contract` (PR to `main` pending)

---

## 2026-11-13

### Completed
- Confirmed write access to [BJET-Hackathon](https://github.com/minuwu/BJET-Hackathon).
- Connected the local workspace to the repository on the `main` branch and configured my Git commit identity.
- Created this work log for team coordination.

### Next
- Record my first agreed project task and any dependencies on teammates before starting implementation.

### Blockers / handoff
- No blockers identified during repository setup.
- No implementation work is ready for handoff yet.

### Related issues / commits / PRs
- Add links when available.

---

## Daily entry template

Copy this template above the latest dated entry. Replace the placeholders with actual progress; keep planned work under **Next**.

```markdown
## YYYY-MM-DD

### Completed
- [Task completed and its outcome; include validation when relevant.]

### Next
- [Task I plan to take next, so teammates can avoid overlapping work.]

### Blockers / handoff
- [What I need, from whom, or what is ready for a teammate. Use "None" if applicable.]

### Related issues / commits / PRs
- [Title](link)
```
