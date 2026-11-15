"""Write audit entries (owner: Asif; guide §4.3, plan D8/D9).

Call ``record`` in the same transaction as the change it describes, before the
service's ``s.commit()``: the change and its audit entry are saved together or
not at all. Never pass passwords, tokens or email links (guide §4.4 rule 10).

    audit.record(s, action="case.updated", actor=who.actor(), summary="Phone changed",
                 case=case, changes=audit.diff(before, after))
    s.commit()

The insert never uses RETURNING, because victims may write audit entries
(``case.viewed``) but RLS doesn't let them read the audit log back.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Final, Protocol
from uuid import UUID, uuid4

from sqlalchemy import func, insert
from sqlmodel import Session, select

from app.models.audit import AUDIT_ACTIONS, ActorType, AuditLogRow

SUMMARY_MAX: Final = 500
VIEW_DEDUP_WINDOW: Final = timedelta(minutes=10)
_SECRET_MARKERS: Final = ("password", "token", "secret", "authorization")
_ACTOR_TYPES: Final = frozenset({"user", "public", "victim", "system", "ai"})


@dataclass(frozen=True, slots=True)
class Actor:
    """Who did it. Anim's ``Principal.actor()`` builds one for logged-in users."""

    type: ActorType
    id: UUID | None = None
    name: str | None = None
    role: str | None = None

    def __post_init__(self) -> None:
        if self.type not in _ACTOR_TYPES:
            raise ValueError(f"unknown actor type {self.type!r}")


SYSTEM_ACTOR: Final = Actor(type="system", name="System")
AI_ACTOR: Final = Actor(type="ai", name="AI extractor")


class CaseRef(Protocol):
    """Anything with a case's id and bank (the case row, or a small stand-in)."""

    @property
    def id(self) -> UUID: ...

    @property
    def bank_id(self) -> str: ...


def to_json(value: Any) -> Any:
    """Make a value JSON-safe. Money stays a number (API_SPEC §1), dates become ISO strings."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Enum):
        return to_json(value.value)
    if isinstance(value, Mapping):
        return {str(k): to_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [to_json(v) for v in value]
    raise TypeError(f"can't store {type(value).__name__} in an audit entry")


def diff(before: Mapping[str, Any], after: Mapping[str, Any]) -> dict[str, dict[str, Any]] | None:
    """``{field: {"from": old, "to": new}}`` for every field whose value changed; ``None`` if nothing did."""
    changed = {
        field: {"from": to_json(before.get(field)), "to": to_json(new)}
        for field, new in after.items()
        if to_json(before.get(field)) != to_json(new)
    }
    return changed or None


def _reject_secrets(payload: Mapping[str, Any] | None, label: str) -> None:
    for key in payload or {}:
        if any(marker in str(key).lower() for marker in _SECRET_MARKERS):
            raise ValueError(f"audit {label} must not contain {key!r}")


def _summary(text: str) -> str:
    text = " ".join(text.split())
    if not text:
        raise ValueError("audit summary is empty")
    return text if len(text) <= SUMMARY_MAX else text[: SUMMARY_MAX - 1] + "…"


def record(
    s: Session,
    *,
    action: str,
    actor: Actor,
    summary: str,
    case: CaseRef | None = None,
    bank_id: str | None = None,
    changes: Mapping[str, Any] | None = None,
    metadata: Mapping[str, Any] | None = None,
    at: datetime | None = None,
) -> None:
    """Add one audit entry to the current transaction. The caller commits."""
    if action not in AUDIT_ACTIONS:
        raise ValueError(f"unknown audit action {action!r}")
    if case is not None and bank_id is not None and bank_id != case.bank_id:
        raise ValueError("bank_id doesn't match the case's bank")
    _reject_secrets(metadata, "metadata")
    _reject_secrets(changes, "changes")
    s.exec(
        insert(AuditLogRow).values(
            id=uuid4(),
            # The database clock (microseconds) by default: Python's clock on Windows ticks
            # every ~15 ms, so two quick events could share a timestamp and lose their order.
            at=at if at is not None else func.clock_timestamp(),
            actor_type=actor.type,
            actor_id=actor.id,
            actor_name=actor.name,
            actor_role=actor.role,
            action=action,
            case_id=case.id if case is not None else None,
            bank_id=case.bank_id if case is not None else bank_id,
            summary=_summary(summary),
            changes=to_json(changes) if changes else None,
            metadata_=to_json(metadata) if metadata else None,
        )
    )


def record_case_view(s: Session, *, actor: Actor, case: CaseRef, now: datetime | None = None) -> bool:
    """Audit ``case.viewed`` at most once per actor and case every 10 minutes (guide §6).

    Returns True when an entry was written. Victims can't read the audit log, so
    their views are always written; that only affects how often, never who can see what.
    """
    now = now or datetime.now(UTC)
    recent = s.exec(
        select(func.count())
        .select_from(AuditLogRow)
        .where(
            AuditLogRow.case_id == case.id,
            AuditLogRow.actor_id == actor.id,
            AuditLogRow.action == "case.viewed",
            AuditLogRow.at > now - VIEW_DEDUP_WINDOW,
        )
    ).one()
    if recent:
        return False
    record(s, action="case.viewed", actor=actor, summary="Case viewed", case=case, at=now)
    return True
