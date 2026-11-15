# Deploying the backend (XREQ-006)

The frontend is already live at `https://reliefops.web.app` (Firebase Hosting). This runbook puts the API next to it: **one container on Cloud Run** (HTTPS by default, same Google Cloud project as Firebase) and **one managed PostgreSQL 16 with `pgvector`**. Every step below was rehearsed locally on 2026-11-15 with the same image against a brand-new empty database: the migration job, the seed, prod-mode boot, CORS for the frontend's origin, the per-client rate limit behind a proxy, and `scripts/smoke.sh` (39/39).

## 1. Database (managed Postgres 16 with pgvector)

Any of these works; all have a free or trial tier and support `pgvector`: **Cloud SQL for PostgreSQL**, **Neon**, **Supabase**. In the provider's console, as the admin user:

```sql
CREATE ROLE migrator LOGIN PASSWORD '<strong password 1>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE app_user LOGIN PASSWORD '<strong password 2>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE DATABASE fraud_relief OWNER migrator;
\connect fraud_relief
CREATE EXTENSION IF NOT EXISTS vector;          -- migration 003 needs it; the migrator can't create it
REVOKE ALL ON DATABASE fraud_relief FROM PUBLIC;
GRANT CONNECT ON DATABASE fraud_relief TO migrator, app_user;
ALTER SCHEMA public OWNER TO migrator;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_user;
```

`app_user` must **not** own the tables or have `BYPASSRLS`, otherwise bank separation (row-level security) stops applying. Hosted URLs usually need `?sslmode=require`:

```
MIGRATIONS_DATABASE_URL=postgresql+psycopg://migrator:<pw1>@<host>:5432/fraud_relief?sslmode=require
DATABASE_URL=postgresql+psycopg://app_user:<pw2>@<host>:5432/fraud_relief?sslmode=require
```

## 2. Build and push the image

```bash
gcloud auth login && gcloud config set project <project-id>       # the Firebase project
gcloud artifacts repositories create reliefops --repository-format=docker --location=asia-northeast1
gcloud builds submit backend --tag asia-northeast1-docker.pkg.dev/<project-id>/reliefops/backend:v0.4.3
```

## 3. Secrets (never in git, never in `.env.example`)

```bash
printf '%s' "$DATABASE_URL"            | gcloud secrets create DATABASE_URL --data-file=-
printf '%s' "$MIGRATIONS_DATABASE_URL" | gcloud secrets create MIGRATIONS_DATABASE_URL --data-file=-
printf '%s' "<new key>" | gcloud secrets create GEMINI_API_KEY --data-file=-       # rotated keys only
printf '%s' "<new key>" | gcloud secrets create OPENROUTER_API_KEY --data-file=-
printf '%s' "<new key>" | gcloud secrets create GROQ_API_KEY --data-file=-
```

The three AI keys that were committed to `backend/.env.example` (removed in `9018383`) are still in git history: **rotate them at the providers before deploying** and store only the new ones.

## 4. Migrate and seed (a one-off job, same image)

```bash
gcloud run jobs create reliefops-migrate --region=asia-northeast1 \
  --image=asia-northeast1-docker.pkg.dev/<project-id>/reliefops/backend:v0.4.3 \
  --set-secrets=MIGRATIONS_DATABASE_URL=MIGRATIONS_DATABASE_URL:latest,DATABASE_URL=DATABASE_URL:latest \
  --command=sh --args=-c,"alembic upgrade head && python -m app.seed"
gcloud run jobs execute reliefops-migrate --region=asia-northeast1 --wait
```

Expected log end: `seeded: banks=5, users=8, cases=42, documents=39, ai_extractions=5, notes=9, kb_documents=5, kb_passages=70`. The seed is idempotent; re-running it changes nothing. Run the job again after every new migration.

## 5. Run the API

```bash
gcloud run deploy reliefops-api --region=asia-northeast1 \
  --image=asia-northeast1-docker.pkg.dev/<project-id>/reliefops/backend:v0.4.3 \
  --allow-unauthenticated --port=8080 --min-instances=1 --max-instances=1 --memory=1Gi \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,MIGRATIONS_DATABASE_URL=MIGRATIONS_DATABASE_URL:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest,GROQ_API_KEY=GROQ_API_KEY:latest \
  --set-env-vars=^@^CORS_ORIGINS=https://reliefops.web.app,https://reliefops.firebaseapp.com,http://localhost:5173@FRONTEND_BASE_URL=https://reliefops.web.app@EMAIL_MODE=console@AI_MODE=live@SESSION_HOURS=8@LOG_LEVEL=INFO
```

Why these flags:
- `--max-instances=1`: rate limits and the AI circuit breaker live in process memory (guide §5.4); a second instance would split them.
- `--min-instances=1`: no cold start during judging.
- `APP_ENV=prod` is the image default; it refuses development database URLs and the test-only outbox email.
- The image runs uvicorn with `--proxy-headers --forwarded-allow-ips '*'`, so the per-IP login limit sees each real client. Safe because Cloud Run's front end is the only way in.
- `^@^` switches gcloud's list separator so the commas inside `CORS_ORIGINS` survive.

## 6. Check it, then hand the URL to the frontend

```bash
API=https://reliefops-api-<hash>.asia-northeast1.run.app
curl -s $API/api/health                         # db: ok, ai: available, rag: available
bash backend/scripts/smoke.sh $API              # 39/39; its last check locks your IP out of login for 15 min
```

Post `$API` in XREQ-006. The frontend builds with `VITE_API_BASE_URL=$API` and `VITE_USE_MOCK=false`.

## Email (team decision)

- `EMAIL_MODE=console` (default above): verification, reset and invitation links go only to the server log (Cloud Run → Logs). Demo with the pre-verified seed accounts (`victim1@mail.test`, `victim2@mail.test`, staff, all `Demo@1234`); a judge can't verify a brand-new sign-up.
- `EMAIL_MODE=smtp`: also set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `EMAIL_FROM` and the secret `SMTP_PASSWORD` (any free SMTP tier). Then sign-up works end to end.

## Rolling back

`gcloud run services update-traffic reliefops-api --to-revisions=<previous revision>=100`. Migrations only add things (005 included), so the previous image runs on the newer schema.
