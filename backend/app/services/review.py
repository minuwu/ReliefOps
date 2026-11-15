"""A person reviews an AI extraction; only then can the case change (owner: Asif; API_SPEC §6.5, D3).

- The extraction row is locked (``FOR UPDATE``) so two reviewers can't both
  decide; the second gets ``409 ALREADY_REVIEWED``.
- Every review sends ``expected_version``; an accept that changes the case
  bumps its version atomically (case_sql.update_case).
- ``ai.review_accepted`` stores each field's AI value next to its final value,
  which is how AI accuracy is measured on real reviews.
"""

from __future__ import annotations

from typing import Any, Final
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy import RowMapping, func, update
from sqlmodel import Session, select

from app.models.documents import ExtractionRow
from app.models.review import FIELD_TYPES, ReviewRequest, ReviewResult
from app.services import audit, case_sql
from app.services.caller import Caller, is_staff
from app.services.case_sql import cases
from app.services.documents import CaseRef
from app.services.extraction import CASE_COLUMN, json_value, to_extraction
from app.services.service_errors import ServiceError, forbidden, not_found, validation_error

# ExtractableField -> the name used in audit changes (same as victim edits)
AUDIT_NAME: Final[dict[str, str]] = {"victim_name": "victim.name", "victim_phone": "victim.phone",
                                     "victim_email": "victim.email"}


def _checked_values(fields: dict[str, Any]) -> dict[str, Any]:
    values: dict[str, Any] = {}
    for name, raw in fields.items():
        try:
            values[name] = FIELD_TYPES[name].validate_python(raw)
        except ValidationError as exc:
            raise validation_error(f"fields.{name}", exc.errors()[0]["msg"]) from exc
    return values


def _decrement_pending(s: Session, case_id: UUID) -> None:
    s.exec(update(cases).where(cases.c.id == case_id)  # type: ignore[call-overload]
           .values(pending_extraction_count=func.greatest(cases.c.pending_extraction_count - 1, 0)))


def _reviewed_fields(row: ExtractionRow, accepted: dict[str, Any], case: RowMapping) -> list[dict[str, Any]]:
    """The AI's fields with ``final_value`` filled in, plus any field the person added."""
    out = [{**f, "final_value": json_value(accepted.get(f["name"]))} for f in row.fields]
    seen = {f["name"] for f in row.fields}
    out += [
        {"name": name, "value": None, "confidence": 0.0, "evidence": None,
         "current_case_value": json_value(case[CASE_COLUMN[name]]), "final_value": json_value(value)}
        for name, value in accepted.items() if name not in seen
    ]
    return out


def review_extraction(s: Session, caller: Caller, extraction_id: UUID, data: ReviewRequest) -> ReviewResult:
    """``POST /api/extractions/{id}/review`` → 200 ``{extraction, case}``."""
    if not is_staff(caller):
        raise forbidden()
    row = s.exec(select(ExtractionRow).where(ExtractionRow.id == extraction_id).with_for_update()).first()
    if row is None:
        raise not_found("Extraction")
    if row.status != "pending_review":
        raise ServiceError(409, "ALREADY_REVIEWED", "This extraction was already reviewed")
    case = case_sql.require_case(s, row.case_id)
    case_sql.require_open(case)
    case_sql.check_version(case, data.expected_version)
    now = case_sql.now()

    if data.decision == "reject":
        if not (data.note and data.note.strip()):
            raise validation_error("note", "A note is required to reject")
        row.status, row.reviewed_by, row.reviewed_at, row.review_note = "rejected", caller.user_id, now, data.note
        s.add(row)
        _decrement_pending(s, row.case_id)
        audit.record(s, action="ai.review_rejected", actor=caller.actor(), case=CaseRef(row.case_id, row.bank_id),
                     summary="AI extraction rejected", metadata={"extraction_id": row.id, "note": data.note})
        s.commit()
        return ReviewResult(extraction=to_extraction(row, case["reference"], caller.name),
                            case=case_sql.require_case(s, row.case_id))

    if not data.fields:
        raise validation_error("fields", "Choose at least one value to accept")
    accepted = _checked_values(dict(data.fields))
    before = {AUDIT_NAME.get(n, n): case[CASE_COLUMN[n]] for n in accepted}
    after = {AUDIT_NAME.get(n, n): v for n, v in accepted.items()}
    changes = audit.diff(before, after)

    row.fields = _reviewed_fields(row, accepted, case)
    row.status, row.reviewed_by, row.reviewed_at, row.review_note = "accepted", caller.user_id, now, data.note
    s.add(row)
    if changes:
        values = {CASE_COLUMN[n]: v for n, v in accepted.items()}
        values["pending_extraction_count"] = func.greatest(cases.c.pending_extraction_count - 1, 0)
        updated = case_sql.update_case(s, row.case_id, data.expected_version, values)
    else:
        _decrement_pending(s, row.case_id)
        updated = None
    audit.record(
        s, action="ai.review_accepted", actor=caller.actor(), case=CaseRef(row.case_id, row.bank_id),
        summary="AI extraction accepted: " + ", ".join(sorted(accepted)), changes=changes,
        metadata={"extraction_id": row.id, "fields": [
            {"name": f["name"], "ai_value": f["value"], "final_value": f["final_value"]}
            for f in row.fields if f["final_value"] is not None
        ]},
    )
    s.commit()
    return ReviewResult(extraction=to_extraction(row, case["reference"], caller.name),
                        case=updated if updated is not None else case_sql.require_case(s, row.case_id))
