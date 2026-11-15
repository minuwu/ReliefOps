"""Victim self-service: report, list, view and edit own cases (owner: Asif; API_SPEC §3.5, §6.7).

Every function expects a session opened with the victim's scope. RLS already
limits a victim to cases whose ``victim_user_id`` is theirs; the services also
check it, so another victim's case is a 404 twice over.
"""

from __future__ import annotations

from typing import Any, Final
from uuid import UUID

from sqlalchemy import RowMapping, and_, column, func, insert, or_, select, table, text
from sqlmodel import Session

from app.models.victim_cases import (
    ALL_EDITABLE_FIELDS,
    CONTACT_FIELDS,
    VictimCase,
    VictimCaseUpdate,
    VictimOut,
    VictimReport,
)
from app.services import audit, case_sql
from app.services.caller import Caller
from app.services.case_sql import cases
from app.services.service_errors import ServiceError, forbidden, not_found, validation_error

# API field name -> cases column
COLUMN_FOR: Final[dict[str, str]] = {
    "victim.name": "victim_name", "victim.phone": "victim_phone", "victim.email": "victim_email",
    "victim.address": "victim_address", "victim.preferred_language": "preferred_language",
    "amount": "amount", "currency": "currency", "transfer_date": "transfer_date",
    "account_number": "account_number", "account_holder_name": "account_holder_name",
    "scam_type": "scam_type", "description": "description",
}
_users = table("users", column("id"), column("email"))


def editable_fields(status: str) -> list[str]:
    """API_SPEC §3.5: contact details until closed, report details only while received."""
    if status == "closed":
        return []
    if status == "received":
        return list(ALL_EDITABLE_FIELDS)
    return list(CONTACT_FIELDS)


def to_victim_case(case: RowMapping, bank_name: str) -> VictimCase:
    return VictimCase(
        id=str(case["id"]), version=case["version"], reference=case["reference"], bank_name=bank_name,
        status=case["status"], closure_reason=case["closure_reason"],
        victim=VictimOut(
            name=case["victim_name"], phone=case["victim_phone"], email=case["victim_email"],
            address=case["victim_address"], preferred_language=case["preferred_language"],
        ),
        amount=case["amount"], currency=case["currency"], transfer_date=case["transfer_date"],
        account_number=case["account_number"], account_holder_name=case["account_holder_name"],
        scam_type=case["scam_type"], description=case["description"],
        missing_fields=case_sql.missing_fields(case), editable_fields=editable_fields(case["status"]),
        submitted_at=case["created_at"], updated_at=case["updated_at"],
    )


def _require_victim(caller: Caller) -> None:
    if caller.role != "victim":
        raise forbidden("Only victims can use this")


def _own_case(s: Session, caller: Caller, case_id: UUID) -> RowMapping:
    case = case_sql.get_case(s, case_id)
    if case is None or case["victim_user_id"] != caller.user_id:
        raise not_found("Case")
    return case


def _is_possible_duplicate(s: Session, caller: Caller, data: VictimReport) -> bool:
    """Another open report by the same victim to the same bank, for the same money or account."""
    same_money = and_(cases.c.amount == data.amount, cases.c.transfer_date == data.transfer_date)
    match = or_(same_money, cases.c.account_number == data.account_number) if data.account_number else same_money
    found = s.exec(  # type: ignore[call-overload]
        select(func.count()).select_from(cases).where(
            cases.c.victim_user_id == caller.user_id, cases.c.bank_id == data.bank_id,
            cases.c.status != "closed", match,
        )
    ).scalar_one()
    return found > 0


def create_report(s: Session, caller: Caller, data: VictimReport) -> VictimCase:
    """``POST /api/victim/cases`` → 201. A ``received`` web-form case linked to the victim's account."""
    _require_victim(caller)
    account_email = s.exec(select(_users.c.email).where(_users.c.id == caller.user_id)).scalar_one()  # type: ignore[call-overload]
    duplicate = _is_possible_duplicate(s, caller, data)
    reference = s.exec(text("select next_case_reference()")).scalar_one()
    created_at = case_sql.now()
    victim = data.victim
    case = s.exec(  # type: ignore[call-overload]
        insert(cases).values(
            reference=reference, bank_id=data.bank_id, status="received", status_changed_at=created_at,
            channel="web_form", reported_date=created_at.date(),
            deadline=case_sql.deadline_for("received", created_at), victim_user_id=caller.user_id,
            victim_name=victim.name, victim_phone=victim.phone, victim_email=victim.email or account_email,
            victim_address=victim.address, preferred_language=victim.preferred_language,
            amount=data.amount, currency=data.currency, transfer_date=data.transfer_date,
            account_number=data.account_number, account_holder_name=data.account_holder_name,
            scam_type=data.scam_type, description=data.description, consent_at=created_at,
            possible_duplicate=duplicate, created_at=created_at, updated_at=created_at,
        ).returning(*cases.c)
    ).mappings().one()
    audit.record(s, action="case.created", actor=caller.actor(), summary="Case reported online", case=case,
                 metadata={"channel": "web_form", "possible_duplicate": duplicate})
    s.commit()
    return to_victim_case(case, case_sql.bank_name(s, case["bank_id"]))


def list_cases(s: Session, caller: Caller) -> list[VictimCase]:
    """``GET /api/victim/cases``: own cases, newest first, not paginated."""
    _require_victim(caller)
    rows = s.exec(  # type: ignore[call-overload]
        select(cases).where(cases.c.victim_user_id == caller.user_id).order_by(cases.c.created_at.desc())
    ).mappings().all()
    names: dict[str, str] = {}
    return [to_victim_case(row, names.setdefault(row["bank_id"], case_sql.bank_name(s, row["bank_id"]))) for row in rows]


def get_case(s: Session, caller: Caller, case_id: UUID) -> VictimCase:
    """``GET /api/victim/cases/{id}``, audited as ``case.viewed`` (at most every 10 minutes)."""
    _require_victim(caller)
    case = _own_case(s, caller, case_id)
    audit.record_case_view(s, actor=caller.actor(), case=case)
    s.commit()
    return to_victim_case(case, case_sql.bank_name(s, case["bank_id"]))


def update_case(s: Session, caller: Caller, case_id: UUID, data: VictimCaseUpdate) -> VictimCase:
    """``PATCH /api/victim/cases/{id}``: only what §3.5 allows right now."""
    _require_victim(caller)
    case = _own_case(s, caller, case_id)
    case_sql.require_open(case)
    case_sql.check_version(case, data.expected_version)

    requested = data.requested()
    allowed = set(editable_fields(case["status"]))
    locked = sorted(name for name in requested if name not in allowed)
    if locked:
        raise ServiceError(
            409, "CASE_LOCKED",
            "These details are locked after verification. Please call the operations center to correct them.",
            {"locked_fields": locked},
        )

    before = {name: case[COLUMN_FOR[name]] for name in requested}
    phone = requested.get("victim.phone", case["victim_phone"])
    email = requested.get("victim.email", case["victim_email"])
    if not phone and not email:
        raise validation_error("victim", "A phone number or an email must remain")

    changes = audit.diff(before, requested)
    if changes is None:
        return to_victim_case(case, case_sql.bank_name(s, case["bank_id"]))  # nothing changed: no new version

    values: dict[str, Any] = {COLUMN_FOR[name]: requested[name] for name in changes}
    updated = case_sql.update_case(s, case_id, data.expected_version, values)
    audit.record(s, action="case.updated", actor=caller.actor(), case=updated, changes=changes,
                 summary="Victim updated " + ", ".join(sorted(changes)))
    s.commit()
    return to_victim_case(updated, case_sql.bank_name(s, updated["bank_id"]))
