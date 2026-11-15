"""The FastAPI app (owner: Anim; guide §4.1).

``create_app(settings)`` builds a fresh app: tests pass explicit settings, while
``fastapi dev`` / ``fastapi run`` use the module-level ``app`` built from the
environment. Asif and Galib add their routers to ``ROUTERS`` with one line.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import db
from app.config import Settings, get_settings
from app.errors import register_error_handlers
from app.middleware import RequestContextMiddleware
from app.routers import auth, reference, victim_chat
from app.security import get_principal
from app.services import extraction_engine
from app.services.victim_chat import ChatSettings

API_VERSION = "0.4.2"

ROUTERS: tuple[APIRouter, ...] = (reference.router, auth.router)


def settings_routers(settings: Settings) -> tuple[APIRouter, ...]:
    """Routers built from settings or with the auth dependency injected."""
    chat = ChatSettings(timeout=settings.ai_timeout_seconds, ai_enabled=settings.ai_configured)
    return (victim_chat.create_router(get_principal, chat),)


def configure_logging(settings: Settings) -> None:
    logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    logging.getLogger("app").setLevel(settings.log_level)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        db.init_engine(settings.app_database_url)
        extraction_engine.configure(max_concurrent=settings.ai_max_concurrent)
        try:
            yield
        finally:
            db.dispose_engine()

    app = FastAPI(
        title="ReliefOps Fraud Relief API",
        version=API_VERSION,
        description="Contract: docs/API_SPEC.md and docs/openapi.yaml.",
        lifespan=lifespan,
    )
    app.state.settings = settings
    register_error_handlers(app)

    # Added first = innermost: the request log sits inside CORS, so even a 500 gets CORS headers.
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Retry-After", "X-Request-ID", "Content-Disposition"],
    )

    for router in (*ROUTERS, *settings_routers(settings)):
        app.include_router(router)
    return app


app = create_app()
