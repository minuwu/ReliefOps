# Free, always-on deploy (XREQ-007)

Goal: API live for judging at **zero cost**, **no card**, **no sleep**, on **one platform**. This replaces the Cloud Run + Cloud SQL path in [DEPLOY.md](DEPLOY.md) (`--min-instances=1` and Cloud SQL need a paid billing account). The role SQL, env vars, smoke test and email decision in DEPLOY.md still apply.

> **Revised 2026-11-15.** The first version of this file used Hugging Face Spaces. That no longer works: HF now requires a paid plan (PRO / Team) to create Docker Spaces ([HF docs](https://huggingface.co/docs/hub/en/spaces-overview)). Do not use it.

## The stack

| Part | Host | Cost | Sleeps? |
|---|---|---|---|
| Frontend | Firebase Hosting (already live: `https://reliefops.web.app`) | Free | Never |
| Backend + AI | **Northflank Developer Sandbox**: 1 service built from `backend/Dockerfile` | Free, "No card needed" | "Always on, no sleeping" |
| Database | **Northflank Postgres addon** (same project), `pgvector` built in | Free (the Sandbox's 1 database) | Never |

Sandbox quota ([pricing](https://northflank.com/pricing)): 2 services, 2 jobs, 1 database, up to $20/mo of resources, Dockerfile builds included. We use 1 service + 1 job + 1 database.

The AI needs no host of its own: the backend calls Gemini / Groq / OpenRouter over HTTPS and runs Tesseract inside the same image. It only needs the keys as secrets.

Why this fits the code as it is:
- The existing [backend/Dockerfile](../backend/Dockerfile) builds unchanged (Tesseract + `jpn` included). No code changes needed.
- One service with one instance matches the in-memory rate limits and AI circuit breaker (same reason as `--max-instances=1`).
- Uploaded files live in Postgres (`LargeBinary`), not on disk, so container restarts lose nothing.
- RLS scope uses `set_config(..., true)` (transaction-local), so it is safe on any Postgres connection.

---

## Phase A: verify before you build (about 20 minutes)

Tick these in the XREQ-007 reply block. If one fails, write why in the card and use the fallback named next to it.

**Backend (Asif / Anim):**
- [ ] **A1.** Sign up at northflank.com with the team GitHub account. Confirm the Sandbox plan shows **no card required** and **always on**. *(Fails: see Fallback.)*
- [ ] **A2.** Create the Postgres addon (step B1), open its shell and run `CREATE EXTENSION vector;` and `CREATE ROLE probe LOGIN NOBYPASSRLS; DROP ROLE probe;`. Both must succeed. *(Fails: keep the service on Northflank, put the database on **Neon** free instead: 1 GB, pgvector 0.8, scale-to-zero after 5 min, wakes in under a second. Run DEPLOY.md §1 there.)*
- [ ] **A3.** Note the largest compute plan the Sandbox lets the service use. At least **0.5 vCPU / 1 GB** (`nf-compute-50`) is needed for OCR on PDFs. 512 MB may run out of memory on large scans.
- [ ] **A4.** Email choice: `console` (demo with the pre-verified seed accounts) or `smtp` (needs SMTP secrets). Post it.

**AI (Galib):**
- [ ] **A5.** **Rotate** `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` at the providers. The old keys are in git history (removed in `9018383`). Only the new keys go into secrets.
- [ ] **A6.** Confirm each provider's free quota covers a judging day (requests per minute and per day) with the current `AI_MAX_CONCURRENT` and `AI_TIMEOUT_SECONDS`. Write the numbers in the card.
- [ ] **A7.** Run the built image locally with `AI_MODE=live`. `/api/health` shows `ai` and `rag` available, and one extraction on a seed document succeeds.

---

## Phase B: implement (all in the Northflank web UI)

### B1. Project and database
1. **Create project** `reliefops`, region closest to the judges (Asia if offered).
2. **Add addon:** PostgreSQL, version 16, smallest Sandbox size. Name it `db`.
3. Open the addon's shell (or connect with the admin connection string) and run the role SQL from [DEPLOY.md §1](DEPLOY.md#1-database-managed-postgres-16-with-pgvector). It creates `migrator`, `app_user`, database `fraud_relief`, extension `vector`. `app_user` must not own the tables and must not have `BYPASSRLS`.
4. Build the two URLs from the addon's **internal** host and port (Connection details tab):
   ```
   MIGRATIONS_DATABASE_URL=postgresql+psycopg://migrator:<pw1>@<internal-host>:5432/fraud_relief
   DATABASE_URL=postgresql+psycopg://app_user:<pw2>@<internal-host>:5432/fraud_relief
   ```
   Add `?sslmode=require` only if the addon has TLS turned on.

### B2. Secrets
**Secret group** `reliefops-env`, applied to the whole project. Set these as secrets: `DATABASE_URL`, `MIGRATIONS_DATABASE_URL`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` (plus `SMTP_PASSWORD` if smtp). Set these as plain values:
```
APP_ENV=prod
CORS_ORIGINS=https://reliefops.web.app,https://reliefops.firebaseapp.com,http://localhost:5173
FRONTEND_BASE_URL=https://reliefops.web.app
EMAIL_MODE=console
AI_MODE=live
SESSION_HOURS=8
LOG_LEVEL=INFO
```

### B3. API service
1. **Create service**, type **Combined** (build and deploy). Name it `api`.
2. Repository: the team GitHub repo, branch `main`.
3. Build: **Dockerfile**. Build context `/backend`, Dockerfile path `/backend/Dockerfile`.
4. Networking: port **8080**, HTTP, **public**. Northflank gives an `https://...code.run` URL.
5. Resources: the plan from A3. Instances: **1**.
6. Health check: HTTP `GET /api/health` on port 8080.
7. Create. Wait for the build and the first deploy. Logs should show uvicorn on `0.0.0.0:8080`.

### B4. Migrate and seed (one-off job, same image)
1. **Create job**, type **Manual**, name it `migrate`. Deployment source: the `api` service's build.
2. Override the command: `sh -c "alembic upgrade head && python -m app.seed"`.
3. Run it. The log should end with `seeded: banks=5, users=8, cases=42, documents=39, ai_extractions=5, notes=9, kb_documents=5, kb_passages=70`.
4. Run it again after every new migration. The seed is idempotent.

### B5. Verify live (Backend + AI)
```bash
API=https://<service>--<project>--<id>.code.run      # from the service's Networking panel
curl -s $API/api/health                                            # db: ok, ai + rag available
curl -si -H "Origin: https://reliefops.web.app" $API/api/health | grep -i access-control-allow-origin
bash backend/scripts/smoke.sh $API                                 # 39/39; its last check locks your IP out of login for 15 min
```
Galib also runs one real extraction and one KB chat question through the live API, and checks that the answer cites passages.

### B6. Hand off
Post the reply block in XREQ-007 with `API_URL`. Minhaz builds the frontend with `VITE_USE_MOCK=false VITE_API_URL=$API` and redeploys Firebase.

---

## Rules during judging
- **Freeze deploys.** Turn off auto-deploy on the `api` service (CI toggle) before judging, so a push to `main` doesn't restart the API mid-demo.
- **Rollback:** pick the previous build in the service's Deployments tab. Migrations only add things, so an older build runs on the newer schema.
- **Secrets** stay in the secret group only: never in git, never in `.env.example`.

## Fallback (only if A1 fails)
**Google Cloud Run** as in [DEPLOY.md](DEPLOY.md), with `--min-instances=0` (inside the free tier), a free cron-job.org ping to `/api/health` every 5 minutes to keep it warm, and **Neon** for the database. Fast, but it needs a Google Cloud billing account with a card, even though usage stays at $0.

Rejected, so nobody re-tries them: Hugging Face Docker Spaces (paid plan required), Render free (sleeps after 15 min, about 1 min cold start, free Postgres deleted after 30 days), Koyeb free (0.1 vCPU / 512 MB, sleeps after 1 h, US/EU only), Vercel (no long-running Docker container for Tesseract).
