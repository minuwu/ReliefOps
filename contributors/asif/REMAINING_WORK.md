# Asif's remaining backend work

Updated: 2026-11-15 (Bangladesh time). Branch: `asif/backend-db`.

## Scope and order

The services for A1–A11 and A14 already exist. The 240 database/unit tests passed before this work. This is not evidence of a running HTTP server: Anim owns `main.py`, authentication, routing dependencies and app configuration.

1. **A15 database:** migration 003 for bluebooks, 768-dimensional pgvector passages and case chat; database-enforced bank/owner isolation and migration tests.
2. **A15 retrieval:** published, victim-facing passages from the case's bank; keyword fallback when embeddings are unavailable; no identifying case fields in model context.
3. **A15 victim chat:** persisted questions/answers, feedback, 20 questions/case/hour, bounded AI calls, fallback citations and audited escalation; service and concurrency tests.
4. **A12/A13 handoff:** verify contract-shaped outputs, regression/concurrency/failure checks, and document the exact router integration for Anim. Keep endpoints marked planned until real HTTP integration passes.

Each completed part gets its own tested commit and push, after pulling both the branch and `main`. Shared API changes require a PR and teammate approval; no direct merge to `main`.

## Cross-team requests first

- **XREQ-001:** Asif's isolation/database portion exists; Anim's case routes remain.
- **XREQ-002:** extraction/review services and Galib's AI exist; HTTP integration remains. The queue card's review route/threshold do not match the current contract; use `/api/extractions/{id}/review` and the contract's configured threshold (default 0.75).
- **XREQ-003:** claim Asif's victim-chat portion. Victim report/claim services already use verified accounts. Do not recreate the removed public access-code flow in this older card. Anim owns authentication; frontend must move to contract v0.4.2.
- **XREQ-004:** needs a team decision before implementation. An account number alone is not a cross-bank account identity; the current `bank_id` is the receiving bank. Freeze must be explicitly a simulation, and cross-bank visibility needs agreed role rules. Keep pending rather than claiming an unsafe or misleading implementation.

## Completion evidence

This section will be updated after each part with tests, commit references and remaining dependencies.

## Integration dependencies

- Anim: FastAPI app, authenticated `Principal`/dependencies, error envelope, rate-limit headers, seed and staff/bluebook services.
- Minhaz: update the frontend's removed victim routes and old transition/review payloads.
- Deployment: a real server URL, seeded database and HTTP smoke test are still required. Service tests alone do not complete deployment.
