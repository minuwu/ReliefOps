"""Staff writes to a case: create and edit (owner: Anim; API_SPEC §6.3, guide §4.2 and §4.4).

Every write runs in the caller's scoped session, ends with ``s.commit()`` (the audit
entry in the same transaction), and returns the full ``Case``. Edits go through Asif's
``case_sql.update_case``: one ``UPDATE … WHERE version = :expected`` that also bumps the
version, so two edits with the same ``expected_version`` can never both win.

Edit rules (§1 and §4.4): a field left out stays unchanged, ``null`` clears it, and
``victim`` merges field by field. An edit that changes nothing creates no new version.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Final
from uuid import UUID

from sqlalchemy import insert, text
from sqlmodel import Session

from app.errors import ApiError
from app.models.cases import Case, CaseCreate, CaseUpdate, Note, NoteCreate
from app.security import Principal
from app.models.documents import UserRef
from app.services import audit, case_sql
from app.services.cases import load_case

# API field → cases column (§3.5 names, used in audit "changes" too).
VICTIM_COLUMNS: Final = {
    "name": "victim_name",
    "phone": "victim_phone",
    "email": "victim_email",
    "address": "victim_address",
    "preferred_language": "preferred_language",
}
CASE_COLUMNS: Final = (
    "amount",
    "currency",
    "transfer_date",
    "account_number",
    "account_holder_name",
    "scam_type",
    "description",
)


@dataclass(frozen=True, slots=True)
class CaseKey:
    """What ``audit.record`` needs to know about a case."""

    id: UUID
    bank_id: str


def field_error(field: str, message: str) -> ApiError:
    return ApiError(
        422, "VALIDATION_ERROR", "Request has invalid fields", {"fields": [{"field": field, "message": message}]}
    )


def check_assignee(s: Session, who: Principal, operator_id: UUID | None, field: str) -> None:
    """Operators may assign only themselves; supervisors any active operator or supervisor (§2)."""
    if operator_id is None:
        return
    if who.role == "operator" and operator_id != who.user_id:
        raise ApiError(403, "FORBIDDEN", "Operators can assign cases only to themselves")
    ok = s.exec(  # type: ignore[call-overload]
        text("select 1 from users where id = :id and is_active and role in ('operator', 'supervisor')"),
        params={"id": operator_id},
    ).first()
    if ok is None:
        raise field_error(field, "Not an active operator or supervisor")


def _possible_duplicate(s: Session, values: dict[str, Any]) -> bool:
    """Same contact, amount, transfer date and account as another case (§4 CaseFlags)."""
    contact = [values.get("victim_phone"), values.get("victim_email")]
    if not any(contact) or None in (values.get("amount"), values.get("transfer_date"), values.get("account_number")):
        return False
    row = s.exec(  # type: ignore[call-overload]
        text(
            "select 1 from cases where amount = :amount and transfer_date = :transfer_date "
            "and account_number = :account_number "
            "and (victim_phone = :phone or lower(victim_email) = lower(:email)) limit 1"
        ),
        params={
            "amount": values["amount"],
            "transfer_date": values["transfer_date"],
            "account_number": values["account_number"],
            "phone": values.get("victim_phone"),
            "email": values.get("victim_email"),
        },
    ).first()
    return row is not None


def create_case(s: Session, who: Principal, data: CaseCreate, now: datetime) -> Case:
    """``POST /api/cases``: a phone or paper case, in ``received``. Only bank, channel and victim name are required."""
    if data.channel == "web_form":
        raise field_error("channel", "Staff create phone or paper cases; web_form is the victim's own report")
    check_assignee(s, who, data.assigned_operator_id, "assigned_operator_id")
    reference = s.exec(text("select next_case_reference()")).scalar_one()  # type: ignore[call-overload]
    values: dict[str, Any] = {
        "reference": reference,
        "bank_id": data.bank_id,
        "status": "received",
        "status_changed_at": now,
        "deadline": case_sql.deadline_for("received", now),
        "channel": data.channel,
        "reported_date": data.reported_date or now.date(),
        "assigned_operator_id": data.assigned_operator_id,
        "victim_name": data.victim.name,
        "victim_phone": data.victim.phone,
        "victim_email": data.victim.email,
        "victim_address": data.victim.address,
        "preferred_language": data.victim.preferred_language,
        "amount": data.amount,
        "currency": data.currency,
        "transfer_date": data.transfer_date,
        "account_number": data.account_number,
        "account_holder_name": data.account_holder_name,
        "scam_type": data.scam_type,
        "description": data.description,
        "created_at": now,
        "updated_at": now,
    }
    values["possible_duplicate"] = _possible_duplicate(s, values)
    case_id = s.exec(insert(case_sql.cases).values(**values).returning(case_sql.cases.c.id)).scalar_one()  # type: ignore[call-overload]
    audit.record(
        s,
        action="case.created",
        actor=who.actor(),
        summary=f"Case created from a {data.channel} report",
        case=CaseKey(case_id, data.bank_id),
        metadata={"channel": data.channel, "possible_duplicate": values["possible_duplicate"]},
    )
    s.commit()
    return load_case(s, who, case_id, now)


def _requested_changes(data: CaseUpdate) -> dict[str, tuple[str, Any]]:
    """``{api_field: (column, new_value)}`` for the fields the request actually sent."""
    sent: dict[str, tuple[str, Any]] = {}
    if data.victim is not None:
        for name in data.victim.model_fields_set:
            sent[f"victim.{name}"] = (VICTIM_COLUMNS[name], getattr(data.victim, name))
    for name in CASE_COLUMNS:
        if name in data.model_fields_set:
            sent[name] = (name, getattr(data, name))
    return sent


def _same(a: Any, b: Any) -> bool:
    return audit.to_json(a) == audit.to_json(b)


def update_case(s: Session, who: Principal, case_id: UUID, data: CaseUpdate, now: datetime) -> Case:
    """``PATCH /api/cases/{id}``: partial edit with the version check; each changed field is audited."""
    case = case_sql.require_case(s, case_id)  # 404 if not visible
    case_sql.require_open(case)
    case_sql.check_version(case, data.expected_version)
    if data.deadline is not None and who.role != "supervisor":
        raise ApiError(403, "FORBIDDEN", "Only a supervisor can change a deadline")

    changes = {
        field: (column, value)
        for field, (column, value) in _requested_changes(data).items()
        if not _same(case[column], value)
    }
    deadline_changed = data.deadline is not None and not _same(case["deadline"], data.deadline)
    if not changes and not deadline_changed:
        s.rollback()
        return load_case(s, who, case_id, now)

    values = {column: value for column, value in changes.values()}
    if deadline_changed:
        values["deadline"] = data.deadline
    updated = case_sql.update_case(s, case_id, data.expected_version, values)
    key = CaseKey(case_id, updated["bank_id"])
    if changes:
        audit.record(
            s,
            action="case.updated",
            actor=who.actor(),
            summary=f"Edited {', '.join(changes)}",
            case=key,
            changes={field: {"from": case[column], "to": value} for field, (column, value) in changes.items()},
        )
    if deadline_changed:
        audit.record(
            s,
            action="case.deadline_changed",
            actor=who.actor(),
            summary=f"Deadline changed: {data.deadline_reason}",
            case=key,
            changes={"deadline": {"from": case["deadline"], "to": data.deadline}},
            metadata={"reason": data.deadline_reason},
        )
    s.commit()
    return load_case(s, who, case_id, now)


def add_note(s: Session, who: Principal, case_id: UUID, data: NoteCreate) -> Note:
    """``POST /api/cases/{id}/notes`` → 201. Notes are the one write a closed case still accepts (§3.2)."""
    case = case_sql.require_case(s, case_id)  # 404 if not visible
    row = (
        s.exec(  # type: ignore[call-overload]
            text(
                "insert into notes (case_id, bank_id, author_id, body) values (:case_id, :bank_id, :author_id, :body) "
                "returning id, created_at"
            ),
            params={"case_id": case_id, "bank_id": case["bank_id"], "author_id": who.user_id, "body": data.body},
        )
        .mappings()
        .one()
    )
    audit.record(
        s,
        action="note.added",
        actor=who.actor(),
        summary="Note added",
        case=CaseKey(case_id, case["bank_id"]),
        metadata={"note_id": row["id"]},
    )
    s.commit()
    return Note(
        id=str(row["id"]),
        body=data.body,
        author=UserRef(id=str(who.user_id), name=who.name),
        created_at=row["created_at"],
    )
