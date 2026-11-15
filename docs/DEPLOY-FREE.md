# Free, always-on deploy (XREQ-007)

Goal: get the API live for judging at **zero cost**, with **no card**, and **no sleep while people use it**. This replaces the Cloud Run + Cloud SQL path in [DEPLOY.md](DEPLOY.md), which needs a billing account (`--min-instances=1` and Cloud SQL are not free). Everything else in DEPLOY.md (roles, env vars, smoke test, email decision) still applies.

| Part | Host | Cost | Sleeps? |
|---|---|---|---|
| Frontend | Firebase Hosting (already live: `https://reliefops.web.app`) | Free | Never |
| Backend + AI | **Hugging Face Spaces, Docker SDK, "CPU basic"** (2 vCPU, 16 GB RAM) | Free, no card | Only after 48 h with no traffic |
| Database | **Neon** Postgres 16 + `pgvector` (free plan) | Free, no card | Compute pauses after 5 min idle, wakes in ~0.5 s |

The AI part needs no host of its own: the backend calls Gemini / Groq / OpenRouter over HTTPS and runs Tesseract inside the same image. It only needs the keys as secrets.

Why this fits the code as it is:
- The existing [backend/Dockerfile](../backend/Dockerfile) runs unchanged (Tesseract + `jpn` included).
- One Space = one container, which is what the in-memory rate limits and AI circuit breaker need (same reason as `--max-instances=1`).
- Uploaded files live in Postgres (`LargeBinary`), not on disk, so the Space's ephemeral disk loses nothing on restart.
- RLS scope uses `set_config(..., true)` (transaction-local), so it is safe on any Postgres connection.

---

## Phase A: verify the plan first (do this before creating anything)

Each owner ticks these in the XREQ-007 reply block. If any check fails, write why in the card and stop; Minhaz picks the fallback (bottom of this file).

**Backend (Asif / Anim):**
- [ ] A1. Hugging Face free "CPU basic" Space still offers Docker SDK, 2 vCPU / 16 GB, sleep after 48 h idle (check the HF Spaces docs / pricing page today).
- [ ] A2. Building the image locally works: `docker build -t reliefops-backend backend`.
- [ ] A3. The image runs as **uid 1000** without errors (HF runs Space containers as uid 1000; the Dockerfile creates uid 10001): `docker run --rm --user 1000 --env-file backend/.env -p 8080:8080 reliefops-backend` then `curl localhost:8080/api/health`. If it fails on permissions, change `useradd ... --uid 10001` to `--uid 1000` in the Dockerfile.
- [ ] A4. Neon free plan supports `CREATE EXTENSION vector` and `CREATE ROLE ... NOBYPASSRLS` from its SQL editor, and 0.5 GB storage is enough for the seed plus demo uploads.
- [ ] A5. Decide email: `console` (demo with pre-verified seed accounts) or `smtp` (free SMTP tier + secrets). Hugging Face may block outbound SMTP ports, so if you pick `smtp`, test it from the Space before relying on it.

**AI (Galib):**
- [ ] A6. **Rotate** `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` at the providers. The old ones are in git history (removed in `9018383`). Only new keys go into secrets.
- [ ] A7. Confirm each provider's free quota covers a judging day (requests per minute / per day) with the current `AI_MAX_CONCURRENT` and `AI_TIMEOUT_SECONDS`. Write the numbers in the card.
- [ ] A8. Confirm OCR + extraction + RAG work in the built image with `AI_MODE=live` locally (`/api/health` shows `ai` and `rag` available, one extraction on a seed document succeeds).

---

## Phase B: implement

### B1. Database on Neon (Backend)

1. Create a Neon project, Postgres 16, region close to Japan/Bangladesh (for example `aws-ap-southeast-1`).
2. In the Neon SQL editor, run the role and grant SQL from [DEPLOY.md §1](DEPLOY.md#1-database-managed-postgres-16-with-pgvector) (creates `migrator`, `app_user`, database `fraud_relief`, extension `vector`). `app_user` must not own tables and must not have `BYPASSRLS`.
3. Use the **direct** connection host (the one **without** `-pooler`) for both URLs. psycopg 3 auto-prepares statements, which can break behind a transaction pooler.
   ```
   MIGRATIONS_DATABASE_URL=postgresql+psycopg://migrator:<pw1>@<ep-xxx>.<region>.aws.neon.tech/fraud_relief?sslmode=require
   DATABASE_URL=postgresql+psycopg://app_user:<pw2>@<ep-xxx>.<region>.aws.neon.tech/fraud_relief?sslmode=require
   ```

### B2. Migrate and seed once, from a laptop (Backend)

```bash
cd backend
export MIGRATIONS_DATABASE_URL='...'  DATABASE_URL='...'  APP_ENV=prod
uv run alembic upgrade head
uv run python -m app.seed
```
Expected last line: `seeded: banks=5, users=8, cases=42, documents=39, ai_extractions=5, notes=9, kb_documents=5, kb_passages=70`. Re-run both after any new migration. Never commit these URLs.

### B3. Hugging Face Space (Backend)

1. Create a Space: owner = team account, name `reliefops-api`, SDK **Docker**, hardware **CPU basic (free)**.
2. Space settings, **Variables and secrets**. Add as **secrets**: `DATABASE_URL`, `MIGRATIONS_DATABASE_URL`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` (and `SMTP_PASSWORD` if smtp). Add as **variables**:
   ```
   APP_ENV=prod
   CORS_ORIGINS=https://reliefops.web.app,https://reliefops.firebaseapp.com,http://localhost:5173
   FRONTEND_BASE_URL=https://reliefops.web.app
   EMAIL_MODE=console
   AI_MODE=live
   SESSION_HOURS=8
   LOG_LEVEL=INFO
   ```
3. The Space repo root must hold a `README.md` with this front matter (the Space reads `app_port` from it):
   ```yaml
   ---
   title: ReliefOps API
   sdk: docker
   app_port: 8080
   pinned: false
   ---
   ```
   Add it as `backend/README.md` in our repo, so the subtree push below carries it.
4. Push only `backend/` to the Space (from the repo root, on an up-to-date `main`). Use a Hugging Face **write token** as the password when git asks; never put it in a URL that gets saved or committed.
   ```bash
   git subtree push --prefix backend https://huggingface.co/spaces/<hf-owner>/reliefops-api main
   ```
   Redeploy = run the same command after new backend commits on `main`.
5. Watch the Space **Logs** tab until uvicorn listens on `0.0.0.0:8080`.

The API URL is `https://<hf-owner>-reliefops-api.hf.space` (shown under the Space's "Embed this Space" menu).

### B4. Verify live (Backend + AI)

```bash
API=https://<hf-owner>-reliefops-api.hf.space
curl -s $API/api/health                                            # db: ok, ai + rag available
curl -si -H "Origin: https://reliefops.web.app" $API/api/health | grep -i access-control-allow-origin
bash backend/scripts/smoke.sh $API                                 # 39/39; last check locks your IP out of login for 15 min
```
Galib also runs one real extraction and one KB chat question through the live API and confirms the answer cites passages.

### B5. Keep it awake (Backend)

Create a free monitor on cron-job.org (or UptimeRobot) that GETs `$API/api/health` every 30 minutes. That keeps the Space under its 48 h idle limit and keeps Neon's compute warm during judging hours.

### B6. Hand off

Post the reply block in XREQ-007 with `API_URL`. Minhaz then builds the frontend with `VITE_USE_MOCK=false VITE_API_URL=$API` and redeploys Firebase.

---

## Caveats

- **A free Space is public, code included.** Secrets stay private. Everything in `backend/` (seed data, eval documents) becomes readable, so check nothing private is in there before the first push.
- **No zero-downtime deploys.** A push rebuilds and restarts the container (a few minutes). Don't push during judging.
- **Rollback:** push an older split commit to the Space (`git push https://huggingface.co/spaces/<hf-owner>/reliefops-api <old-split-sha>:main --force`) or use the Space's "Factory reboot". Migrations only add things, so an older image runs on the newer schema.

## Fallback (only if Phase A fails)

Cloud Run as in [DEPLOY.md](DEPLOY.md), but with `--min-instances=0` (inside the free tier) plus the same health ping every 5 minutes, and Neon instead of Cloud SQL. Needs a Google Cloud billing account with a card, even though usage stays free.
