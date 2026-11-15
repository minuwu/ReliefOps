"""Health and the bank list, both public (owner: Anim; API_SPEC §6.2)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app import db
from app.config import Settings
from app.models.reference import Bank, Health
from app.responses import Envelope, ok
from app.services import extraction_engine, victim_chat

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["reference"])


def _db_ok() -> bool:
    try:
        with db.system_session() as s:
            s.exec(text("select 1"))  # type: ignore[call-overload]
        return True
    except SQLAlchemyError:
        log.warning("health: database unreachable")
        return False


def health_status(settings: Settings, *, db_ok: bool) -> Health:
    if not settings.ai_configured:
        ai, rag = "disabled", "disabled"
    elif extraction_engine.ai_status() == "unavailable":
        ai, rag = "unavailable", "degraded"
    else:
        ai = "available"
        rag = "available" if victim_chat.assistant_available() else "degraded"
    if not db_ok and rag != "disabled":
        rag = "unavailable"  # the assistant can't read bluebooks without the database
    return Health(db="ok" if db_ok else "unavailable", ai=ai, rag=rag, timestamp=datetime.now(UTC))


@router.get("/health", response_model=Envelope[Health], summary="Server, database and AI status")
def get_health(request: Request) -> dict:
    return ok(health_status(request.app.state.settings, db_ok=_db_ok()))


@router.get("/banks", response_model=Envelope[list[Bank]], summary="All five banks (intake form dropdown)")
def list_banks() -> dict:
    with db.system_session() as s:
        rows = s.exec(text("select id, name from banks order by id")).all()  # type: ignore[call-overload]
    return ok([Bank(id=row.id, name=row.name) for row in rows])
