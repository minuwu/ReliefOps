# Asif's backend handoff

Updated 2026-11-15. Branch `asif/backend-db`; contract v0.4.2.

## Ready for integration

The database and service functions below are implemented. Victim chat also has a tested HTTP adapter. **This branch does not create or deploy Anim's FastAPI application. There is no new public server URL.**

| Area | Entry point | HTTP wiring |
|---|---|---|
| Scoped database | `app.db.init_engine`, `session_for`, `scoped_session` | Initialize once with `app_user`, not the migrator |
| Victim reports | `victim_cases.create_report`, `list_cases`, `get_case`, `update_case` | `/api/victim/cases` and `/{case_id}` |
| History/export | `history.case_history`, `case_history_csv`, `audit_logs` | History `?format=csv` returns raw CSV, not JSON |
| Documents | `documents.upload_document`, `download_document`, `case_documents` | Use bounded upload reads; download returns bytes/headers |
| Extraction | `extraction.run_extraction`, `get_extraction` | Pass `ExtractionSettings`; no transaction held during AI |
| Human review | `review.review_extraction` | `ReviewRequest` requires `expected_version`; serialize its returned case through Anim's public case serializer |
| Review queue | `review_queue.review_queue` | Paginated, lane/bank filters |
| Victim link | `claims.invite_victim`, `claim_case` | Pass Anim's `send_email` and frontend URL; never return/email tokens through logs |
| Retrieval | `retrieval.retrieve` | Bank comes from an owned case; model vectors are optional |
| Victim chat | `victim_chat.ask`, `get_thread`, `feedback` | Mount `app.routers.victim_chat.create_router` below |

The original services accept a scoped `Session` and a `Caller`. The `Caller` protocol requires `user_id`, `name`, `role`, `bank_id`, `scope()` and `actor()`. Writes commit before returning. `victim_chat` opens its own short sessions: **do not wrap it in an open request transaction**.

## Mount chat in Anim's app

After `db.init_engine(settings.database_url)` and app error handlers are installed:

```python
from app.routers.victim_chat import create_router
from app.services.victim_chat import ChatSettings

# Supply the function behind CurrentPrincipal, not the Annotated alias itself.
# It must authenticate an active, verified user from the real session token.
app.include_router(create_router(get_current_principal, ChatSettings()))
```

`get_current_principal` is the integration name here; use Anim's actual dependency function. The router has no default/mock authentication and no hard-coded credentials.

Routes:

- `GET /api/victim/cases/{case_id}/chat`
- `POST /api/victim/cases/{case_id}/chat/messages`
- `POST /api/victim/cases/{case_id}/chat/messages/{message_id}/feedback`

Success responses use `{success, data, message}` with public Pydantic schemas. Register Anim's handlers for `ServiceError` and `RequestValidationError` to produce the canonical error envelope. The chat router supplies `Retry-After` itself for its 429 response. Use a normal synchronous router, since the services use synchronous database/model clients.

`ChatSettings(ai_enabled=False)` is the offline demo mode: matching guidance returns `passages_only`; no match or an explicit request for a person escalates. Defaults call Galib's `rag.embed(..., task="query")` and `rag.answer` with a shared 20-second budget and four-worker admission limit. No paid services are introduced.

For `/api/health`, `victim_chat.assistant_available()` reports recent process-local provider failures. It is not a live network health probe. It does not establish deployment readiness.

## Database and seed handoff

1. Use PostgreSQL with pgvector. As a database administrator, enable `CREATE EXTENSION IF NOT EXISTS vector;` in application and test databases.
2. Run Alembic through `003_chat` as the non-superuser migrator. Missing pgvector fails with a setup message. Downgrade leaves the extension installed.
3. Anim's seed runs with `app.role=system`. Insert Galib's synthetic bluebooks into `kb_documents`, with `audience=victim_facing`, `status=published`, and a real seeded supervisor in `uploaded_by`.
4. Insert the 70 fixture passages from `backend/seed_data/bluebooks/kb_passages.json`. Map textual fixture IDs to generated UUIDs; keep document/bank foreign keys consistent. Preserve `embedding_model=gemini-embedding-001` and all 768 components. Do not call an embedding API when seeding these precomputed vectors.

Tables are documented in migration 003. `kb_documents` contains file bytes and SHA-256; `kb_passages` carries keyword and vector indexes; `chat_messages` carries the public transcript plus internal model/citation metadata. One thread per case. No application DELETE/TRUNCATE grants.

Anim's staff reply should insert a `role=staff` message with `author_id`, `author_name`, language and the case bank, clear `cases.victim_question_pending` and append `chat.staff_replied` in the **same transaction**. Staff can reuse `get_thread` for the read endpoint. Those staff/bluebook endpoints remain Anim's responsibility.

## Verification recipe

Tests use a database whose name ends in `_test` and reset its schema. Do not point them at the application database. This session used a separate disposable loopback cluster on port 55432; the existing database on 5432 was untouched. Its local setup used pgvector 0.8.1 compiled from the upstream source, not a paid service.

From `backend/`, set `TEST_MIGRATIONS_DATABASE_URL` (migrator) and `TEST_DATABASE_URL` (app_user), then:

```powershell
uv run --no-project --with alembic --with sqlalchemy --with 'psycopg[binary]' --with pytest --with sqlmodel --with fastapi --with httpx --with pyyaml --with jsonschema python -m pytest tests/database tests/unit tests/ai -q
```

Until Anim commits `pyproject.toml`, these dependencies are supplied through uv. AI tests may additionally require the dependencies in `backend/requirements-ai.txt`; use that file when setting up a fresh environment. All model calls in the automated tests are doubles, so tests do not spend provider quota.

The HTTP checks use FastAPI TestClient with real database services and test-only authentication. They validate thread, exchange and feedback responses against the canonical OpenAPI file and check 401/403/404/422/429 behavior. **They do not verify real login or a deployed server.**

## Remaining team work and limits

- Anim: mount routes, finish real authentication/app configuration, earlier service routers, staff chat, bluebook ingestion/publishing, seed and smoke script.
- Minhaz: replace v0.3 victim access-code routes and outdated transition/review payloads with v0.4.2.
- Shared gate: real login → report → upload → extract → human review → case update → victim chat over HTTP, then a public deployment URL for the AI team.
- XREQ-004: user confirmed it stays a documented team decision. Account numbers alone cannot establish a cross-bank identity; agree bank/branch/account identity, authorized roles and simulation-only freeze semantics first.
- AI privacy: case context is allow-listed and known identifiers/email/phone-like strings are redacted. This is not a guarantee that arbitrary unknown names or addresses typed into chat are detected.
- Reliability: a crash after question commit can leave a visible unanswered question. Timed-out threads remain bounded but cannot be forcibly killed. Keyword fallback has limited Japanese segmentation; the semantic cutoff is a starting heuristic. Synthetic AI evaluations are not production accuracy evidence.

References used for implementation: [PostgreSQL row security](https://www.postgresql.org/docs/16/ddl-rowsecurity.html), [pgvector](https://github.com/pgvector/pgvector), [FastAPI dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/).
