"""Audit entries as the API returns them (owner: Asif; API_SPEC §4 AuditEntry, §6.4)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

ActorType = Literal["user", "public", "victim", "system", "ai"]


class AuditActor(BaseModel):
    type: ActorType
    id: str | None
    name: str
    role: str | None


class AuditEntry(BaseModel):
    id: str
    at: datetime
    actor: AuditActor
    action: str
    case_id: str | None
    case_reference: str | None
    bank_id: str | None
    summary: str
    changes: dict[str, Any] | None
    metadata: dict[str, Any] | None


class AuditFilters(BaseModel):
    """Query of ``GET /api/audit-logs``."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    case_id: UUID | None = None
    actor_id: UUID | None = None
    action: str | None = Field(default=None, max_length=40)
    from_: datetime | None = Field(default=None, alias="from")
    to: datetime | None = None
