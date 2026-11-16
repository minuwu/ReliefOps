# Free, always-on deploy (XREQ-007)

Goal: API live for judging at **zero cost**, **no card**, **no sleep**, on **one platform**. This replaces the Cloud Run + Cloud SQL path in [DEPLOY.md](DEPLOY.md) (`--min-instances=1` and Cloud SQL need a paid billing account). The role SQL, env vars, smoke test and email decision in DEPLOY.md still apply.

> **Revised 2026-11-16 (Asif): the API runs on an Azure for Students VM, not Northflank.** Northflank's signup asked for a card despite "No card needed" on its pricing page (check A1 failed). Everything below the "Azure VM" section is kept for reference only.

## Azure VM (live path)

| Part | Where | Cost | Sleeps? |
|---|---|---|---|
| Frontend | Firebase Hosting, `https://reliefops.web.app` | Free | Never |
| Backend + AI (one container, Tesseract inside) | Azure VM `reliefops-api`, **Japan East**, `Standard_B2pts_v2` (2 vCPU Arm64, 1 GB RAM + 2 GB swap), Ubuntu 24.04, behind Caddy | Free: 750 VM hours/month for 12 months on Azure for Students ($100 credit, no card, expires 2027-11-16). The public IP and disk may draw a little of the credit | Never (no auto-shutdown) |
| Database | Supabase free, Tokyo (unchanged, see "Database: Supabase") | Free | Kept awake by [.github/workflows/keepalive.yml](../.github/workflows/keepalive.yml) |

- **API URL:** `https://reliefops-api.japaneast.cloudapp.azure.com`. HTTPS from Let's Encrypt via Caddy, renewed automatically.
- **The AI needs no other host.** Extraction and chat call Gemini, Groq and OpenRouter over HTTPS; embeddings are Gemini's API; only Tesseract runs locally, inside the image.
- **Why these choices:**
  - Japan East is in the subscription's allowed regions and in the same region as Supabase.
  - `B2ats_v2` and `B1s` (the other two free sizes) had no capacity in Japan East on 2026-11-16; `B2pts_v2` did. The image builds on Arm64 unchanged.
- **Files:** [deploy/azure-vm/](../deploy/azure-vm/). `compose.yml` (api + Caddy, log caps), `Caddyfile`, `env.prod.example`, `deploy.sh`.
- **Secrets:** `deploy/azure-vm/.env.prod` on the deployer's laptop (gitignored by `.env.*`), copied to `/opt/reliefops/.env.prod` on the VM with `chmod 600`. Same keys as `env.prod.example`.

**Redeploy** (from the repo root, after `git pull`; deploys `origin/main` by default):
```bash
bash deploy/azure-vm/deploy.sh reliefops-api.japaneast.cloudapp.azure.com
```
It needs the SSH key `~/.ssh/reliefops_azure` (Asif has it; to add a teammate, append their public key to `~azureuser/.ssh/authorized_keys` on the VM). A rebuild takes about 4 minutes on this VM.

**Operate:**
```bash
ssh -i ~/.ssh/reliefops_azure azureuser@reliefops-api.japaneast.cloudapp.azure.com
cd /opt/reliefops
sudo docker compose ps                  # both containers Up
sudo docker compose logs --tail 80 api  # app logs
sudo docker compose restart api         # after editing .env.prod on the VM
```
Azure resources live in resource group `reliefops`. Deleting that group removes everything.

> **Revised 2026-11-15.** The first version of this file used Hugging Face Spaces. That no longer works: HF now requires a paid plan (PRO / Team) to create Docker Spaces ([HF docs](https://huggingface.co/docs/hub/en/spaces-overview)). Do not use it.

## The stack

| Part | Host | Cost | Sleeps? |
|---|---|---|---|
| Frontend | Firebase Hosting (already live: `https://reliefops.web.app`) | Free | Never |
| Backend + AI | **Northflank Developer Sandbox**: 1 service built from `backend/Dockerfile` | Free, "No card needed" | "Always on, no sleeping" |
| Database | **Supabase free**, project `reliefops`, Tokyo. **Already set up, migrated and seeded** (see below). Replaces the Northflank Postgres addon. | Free | Pauses only after 7 days with no traffic |

Sandbox quota ([pricing](https://northflank.com/pricing)): 2 services, 2 jobs, 1 database, up to $20/mo of resources, Dockerfile builds included. We use 1 service + 1 job (the database is on Supabase).

## Database: Supabase (done 2026-11-15, Anim)

**A2, B1 and B4 are done.** Skip the Northflank Postgres addon. The `api` service only needs the two URLs below as secrets.

- **Project:** `reliefops`, ref `hlfmfzcadbitrqymktxe`, region `ap-northeast-1` (Tokyo), Postgres 17.11, pgvector 0.8.2, free plan.
- **Connect through the session pooler** (IPv4): host `aws-1-ap-northeast-1.pooler.supabase.com`, port `5432`, database `postgres`, users `migrator.hlfmfzcadbitrqymktxe` and `app_user.hlfmfzcadbitrqymktxe`, `?sslmode=require`.
  - Don't use the direct host `db.<ref>.supabase.co`: it's IPv6-only on the free plan.
  - Don't use port `6543` (the transaction pooler): psycopg's prepared statements break behind it.
- **Getting the URLs:** they're in Anim's local `backend/.env.deploy` (gitignored). Anim sends them privately; never put them in git or chat. They go in the Northflank secret group as `DATABASE_URL` (app_user) and `MIGRATIONS_DATABASE_URL` (migrator).
- **What was set up (as the Supabase admin):**
  - Roles `migrator` and `app_user`: `NOSUPERUSER NOBYPASSRLS`, passwords set as SCRAM hashes only.
  - `CREATE EXTENSION vector WITH SCHEMA extensions`.
  - `migrator` can create in `public`; `app_user` can only use it.
  - Per role: `search_path = "$user", public, extensions` (Supabase adds `extensions` only for `postgres`, so without this `vector` doesn't resolve) and `TimeZone = UTC`.
  - `REVOKE USAGE ON SCHEMA public FROM anon, authenticated`, which closes Supabase's Data API. The app never uses it.
- **Migrated and seeded:** 001→005, and the seed line matched (`banks=5, users=8, cases=42, documents=39, ai_extractions=5, notes=9, kb_documents=5, kb_passages=70`).
- **Checked with the API in prod mode against it:**
  - `/api/health` gave `db: ok`.
  - CORS allowed `reliefops.web.app` and refused other origins.
  - Supervisor saw 42 cases, viewer A saw 8 (bank_a only), viewer B saw 11 (bank_b only).
  - A victim on a staff route got `403`.
  - The app's `options=-c timezone=UTC` connect argument works through the pooler.
  - Supabase security advisor: 0 issues.
- **Future migrations:** run the `migrate` job (B4) as written; it works against Supabase. Or run them locally: `set -a; . backend/.env.deploy; set +a; cd backend && uv run alembic upgrade head`.
- **Free-plan limits:** 500 MB database. The project pauses after 7 days with no traffic (restore it from the Supabase dashboard).

**Budget (the $20/mo cap is the real limit).** Plan prices from `https://api.northflank.com/v1/plans`:

| Piece | Plan | vCPU / RAM | $/mo |
|---|---|---|---|
| `api` service | `nf-compute-50` | 0.5 / 1 GB | 12.00 |
| `db` addon | `nf-compute-20` | 0.2 / 512 MB | 5.40 |
| addon storage + job runs | smallest disk, a few minutes per run | | ~1–2 |
| **Total** | | | **~18–19, under 20** |

**With the database on Supabase** (done, see above), the `db` addon row and its storage drop out: about **$13–14/mo** (API plus job runs).

`nf-compute-100-1` (1 vCPU, $18) for the API would push the total over $20, so `nf-compute-50` is the ceiling. Honest expectation: normal API calls are fast. OCR of a large scanned PDF on 0.5 vCPU takes a few seconds longer than on a laptop, which is fine for a demo. If judges need more speed, the Cloud Run fallback below is faster.

**Tools needed on one laptop:** `npx @northflank/cli` (to reach the database) and `psql` (or any Postgres GUI). Northflank has no SQL console in the browser.

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
- [ ] **A1.** Sign up at northflank.com with the team GitHub account. Confirm the Sandbox plan shows **no card required** and **always on**, and write down which **regions** a free project may use (the docs don't list them). *(Fails: see Fallback.)*
- [x] **A2. Done on Supabase instead (2026-11-15, Anim); skip it.** Original check: do step B1 (addon + the full role SQL). The **whole** DEPLOY.md §1 script must succeed as the addon's admin user, not just a probe role. *(Fails even after the `GRANT migrator TO` fix in B1: keep the service on Northflank, put the database on **Neon** free instead: 1 GB, pgvector 0.8, scale-to-zero after 5 min, wakes in under a second. Run DEPLOY.md §1 there.)*
- [ ] **A3.** Confirm the Sandbox lets the service use **`nf-compute-50`** (0.5 vCPU / 1 GB) while the addon runs on `nf-compute-20`. 512 MB for the API may run out of memory on large scans.
- [ ] **A4.** Email choice: `console` (demo with the pre-verified seed accounts) or `smtp` (needs SMTP secrets). Post it.

**AI (Galib):**
- [ ] **A5.** **Rotate** `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` at the providers. The old keys are in git history (removed in `9018383`). Only the new keys go into secrets.
- [ ] **A6.** Confirm each provider's free quota covers a judging day (requests per minute and per day) with the current `AI_MAX_CONCURRENT` and `AI_TIMEOUT_SECONDS`. Write the numbers in the card.
- [ ] **A7.** Run the built image locally with `AI_MODE=live`. `/api/health` shows `ai` and `rag` available, and one extraction on a seed document succeeds.

---

## Phase B: implement (all in the Northflank web UI)

### B1. Project and database
> **Database already done on Supabase** (see "Database: Supabase" above). Only do step 1 here, then go to B2 with the two Supabase URLs.

1. **Create project** `reliefops`, region closest to the judges (Asia if offered).
2. **Add addon:** PostgreSQL, version 16, plan `nf-compute-20`, smallest disk, TLS off, **not** publicly accessible. Name it `db`.
3. Reach it from a laptop through the CLI tunnel. Copy the exact `forward` command from the addon's **Local access** section; it looks like:
   ```bash
   npx @northflank/cli login
   npx @northflank/cli forward addon --projectId reliefops --addonId db
   ```
   Then connect with the admin connection string (the one ending in `_ADMIN`, host `localhost`), for example `psql "<POSTGRES_URI_ADMIN with localhost>"`.
4. Run the role SQL from [DEPLOY.md §1](DEPLOY.md#1-database-managed-postgres-16-with-pgvector). It creates `migrator`, `app_user`, database `fraud_relief`, extension `vector`. `app_user` must not own the tables and must not have `BYPASSRLS`.
   - If `CREATE DATABASE ... OWNER migrator` or `ALTER SCHEMA public OWNER TO migrator` fails with `must be able to SET ROLE "migrator"` (Postgres 16 rule for admins that aren't superuser), run `GRANT migrator TO <admin user>;` once and retry the failed line.
5. Build the two URLs from the addon's **internal** host and port (Connection details tab):
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
5. Resources: `nf-compute-50`. Instances: **1**.
6. Health check: HTTP `GET /api/health` on port 8080.
7. Create. Wait for the build and the first deploy. Logs should show uvicorn on `0.0.0.0:8080`.

### B4. Migrate and seed (one-off job, same image)
> **Already run against Supabase on 2026-11-15.** Create the job anyway for future migrations. Running it again is harmless: Alembic is at head and the seed is idempotent. On Supabase the laptop alternative below needs no tunnel: use the URLs from `backend/.env.deploy` (see "Database: Supabase").

A job can't reuse a **combined** service's build (Northflank docs), so the job builds the same Dockerfile itself.
1. **Create job**, type **Manual**, name it `migrate`. Source: **version control**, same repo, branch `main`, Dockerfile build, context `/backend`, Dockerfile `/backend/Dockerfile`. Plan `nf-compute-10` is enough. It gets the project secret group too.
2. Advanced, Docker runtime mode: **custom command** `sh -c "alembic upgrade head && python -m app.seed"`.
3. Run it (free jobs run one at a time). The log should end with `seeded: banks=5, users=8, cases=42, documents=39, ai_extractions=5, notes=9, kb_documents=5, kb_passages=70`.
4. Run it again after every new migration. The seed is idempotent.

*Simpler alternative if the job gives trouble:* with the B1 tunnel open, run `uv run alembic upgrade head && uv run python -m app.seed` from `backend/` on the laptop, with `MIGRATIONS_DATABASE_URL` / `DATABASE_URL` pointing at `localhost:<forwarded port>`.

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
