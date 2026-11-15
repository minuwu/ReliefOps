"""Reference data and health schemas (owner: Anim; API_SPEC §4 and §6.2)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models.common import BankId


class Bank(BaseModel):
    id: BankId
    name: str


class Health(BaseModel):
    status: Literal["healthy"] = "healthy"
    db: Literal["ok", "unavailable"]
    ai: Literal["available", "unavailable", "disabled"]
    rag: Literal["available", "degraded", "unavailable", "disabled"]
    timestamp: datetime
