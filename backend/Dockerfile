# ReliefOps backend (FastAPI + SQLModel on PostgreSQL 16 with pgvector). See docs/DEPLOY.md.
#
#   docker build -t reliefops-backend backend
#   docker run -p 8080:8080 --env-file backend/.env reliefops-backend                      # the API
#   docker run --env-file backend/.env reliefops-backend sh -c "alembic upgrade head && python -m app.seed"
#
# APP_ENV defaults to prod, and prod refuses the development database URLs, so a container started
# without DATABASE_URL / MIGRATIONS_DATABASE_URL fails at boot instead of running half-configured.

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

# Tesseract verifies the AI's evidence on images and scans (Galib's ai_extraction.py), Japanese included.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-jpn \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv==0.13.8

WORKDIR /app

# Dependencies first, so code changes don't reinstall them.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY alembic.ini ./
COPY migrations ./migrations
COPY app ./app
# The seed loads the synthetic bluebooks and sample documents.
COPY seed_data ./seed_data
COPY eval/extraction/documents ./eval/extraction/documents
COPY eval/extraction/labels.json ./eval/extraction/labels.json

RUN useradd --create-home --uid 10001 app && chown -R app /app
USER app

ENV PATH="/app/.venv/bin:$PATH" \
    APP_ENV=prod \
    PORT=8080
EXPOSE 8080

# --proxy-headers + --forwarded-allow-ips: behind Cloud Run's load balancer the real client IP comes in
# X-Forwarded-For. Without it every request looks like the proxy's IP and the per-IP login limit
# would lock everyone out after 5 wrong passwords from anyone. Only safe because the platform's
# proxy is the sole way in (no direct access to the container).
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips '*'"]
