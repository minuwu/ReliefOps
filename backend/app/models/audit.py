"""The audit_log table (owner: Asif). Append-only in the database (migration 002, D8)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Final, Literal
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

ActorType = Literal["user", "public", "victim", "system", "ai"]

# Same values, same order as API_SPEC §3.4 AuditAction and the CHECK in migration 001.
AUDIT_ACTIONS: Final[tuple[str, ...]] = (
    "auth.login", "auth.login_failed", "auth.logout", "auth.signup", "auth.email_verified",
    "auth.password_reset", "user.invited", "user.invitation_revoked", "user.joined",
    "user.deactivated", "case.created", "case.viewed", "case.updated", "case.status_changed",
    "case.assigned", "case.deadline_changed", "case.victim_invited", "case.claimed",
    "note.added", "document.uploaded", "document.downloaded", "ai.extraction_completed",
    "ai.extraction_failed", "ai.review_accepted", "ai.review_rejected", "export.generated",
    "chat.escalated", "chat.staff_replied", "kb.document_uploaded", "kb.document_published",
    "kb.document_archived",
)


class AuditLogRow(SQLModel, table=True):
    __tablename__ = "audit_log"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    actor_type: str
    actor_id: UUID | None = None
    actor_name: str | None = None
    actor_role: str | None = None
    action: str
    case_id: UUID | None = None
    bank_id: str | None = None
    summary: str
    changes: dict[str, Any] | None = Field(default=None, sa_column=Column(JSONB))
    # "metadata" is reserved on SQLAlchemy models, so the attribute has a trailing underscore.
    metadata_: dict[str, Any] | None = Field(default=None, sa_column=Column("metadata", JSONB))
