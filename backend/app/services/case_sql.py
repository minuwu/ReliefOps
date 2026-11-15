"""Reading and updating ``cases`` from my services (owner: Asif).

The ``cases`` ORM model belongs to the cases domain (Anim). To avoid two
mappings of one table, my services use this lightweight SQL description
instead. Row-level security still decides which rows a query can see.

Edits are atomic: ``UPDATE ... WHERE id = :id AND version = :expected`` bumps
``version`` in the same statement, so two edits with the same
``expected_version`` can never both win (guide §4.2 rule 3, D12).
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any, Final
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, Integer, Numeric, RowMapping, String, Uuid, column, func, select, table, update
from sqlmodel import Session

from app.services.service_errors import ServiceError, not_found

cases = table(
    "cases",
    column("id", Uuid), column("reference", String), column("bank_id", String), column("status", String),
    column("status_changed_at", DateTime(timezone=True)), column("channel", String), column("reported_date", Date),
    column("deadline", DateTime(timezone=True)), column("assigned_operator_id", Uuid), column("victim_user_id", Uuid),
    column("victim_name", String), column("victim_phone", String), column("victim_email", String),
    column("victim_address", String), column("preferred_language", String), column("amount", Numeric(14, 2)),
    column("currency", String), column("transfer_date", Date), column("account_number", String),
    column("account_holder_name", String), column("scam_type", String), column("description", String),
    column("consent_at", DateTime(timezone=True)), column("payout_amount", Numeric(14, 2)),
    column("closure_reason", String), column("closed_at", DateTime(timezone=True)),
    column("document_count", Integer), column("pending_extraction_count", Integer),
    column("victim_question_pending", Boolean), column("possible_duplicate", Boolean),
    column("version", Integer), column("created_at", DateTime(timezone=True)), column("updated_at", DateTime(timezone=True)),
)
banks = table("banks", column("id", String), column("name", String))

# API_SPEC §3.1: days allowed in each stage (placeholders, changeable in config).
STAGE_DAYS: Final[dict[str, int]] = {
    "received": 7, "verified": 14, "account_check": 45, "notice_published": 90, "payout_review": 45,
}


def deadline_for(status: str, entered_at: datetime) -> datetime | None:
    days = STAGE_DAYS.get(status)
    return entered_at + timedelta(days=days) if days is not None else None


def get_case(s: Session, case_id: UUID) -> RowMapping | None:
    """The case if the caller's scope can see it, else None."""
    return s.exec(select(cases).where(cases.c.id == case_id)).mappings().first()  # type: ignore[call-overload]


def require_case(s: Session, case_id: UUID) -> RowMapping:
    case = get_case(s, case_id)
    if case is None:
        raise not_found("Case")
    return case


def require_open(case: RowMapping) -> None:
    if case["status"] == "closed":
        raise ServiceError(409, "CASE_CLOSED", "This case is closed and can't be changed")


def check_version(case: RowMapping, expected_version: int) -> None:
    if case["version"] != expected_version:
        raise stale(case["version"])


def stale(current_version: int) -> ServiceError:
    return ServiceError(409, "STALE_CASE", "This case changed; reload it", {"current_version": current_version})


def update_case(s: Session, case_id: UUID, expected_version: int, values: dict[str, Any]) -> RowMapping:
    """Write ``values`` only if the case is still at ``expected_version``; bump the version. Doesn't commit."""
    row = s.exec(  # type: ignore[call-overload]
        update(cases)
        .where(cases.c.id == case_id, cases.c.version == expected_version)
        .values(**values, version=cases.c.version + 1, updated_at=func.now())
        .returning(*cases.c)
    ).mappings().first()
    if row is not None:
        return row
    current = get_case(s, case_id)
    if current is None:
        raise not_found("Case")
    if current["version"] == expected_version:
        # Visible and current, yet not writable: RLS refused this role (a missing role check in code).
        raise ServiceError(403, "FORBIDDEN", "Your role can't change this case")
    raise stale(current["version"])


def bank_name(s: Session, bank_id: str) -> str:
    name = s.exec(select(banks.c.name).where(banks.c.id == bank_id)).first()  # type: ignore[call-overload]
    return name[0] if name else bank_id


def missing_fields(case: RowMapping | dict[str, Any]) -> list[str]:
    """API_SPEC §3.3: what a case still needs before it can leave ``received``."""
    missing = []
    if not (case.get("victim_phone") or case.get("victim_email")):
        missing.append("victim_contact")
    for name in ("amount", "transfer_date", "account_number", "scam_type"):
        if case.get(name) is None:
            missing.append(name)
    if not case.get("document_count"):
        missing.append("document")
    return missing


def now() -> datetime:
    return datetime.now(UTC)


def today() -> date:
    return datetime.now(UTC).date()
