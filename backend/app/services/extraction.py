"""Run and read AI extractions for case documents (owner: Asif; API_SPEC §6.5, guide §4.5).

``run_extraction`` never holds a database transaction while the AI works: it
reads what it needs, commits (the connection goes back to the pool), calls the
engine, then writes the result in a new transaction, whose scope is applied
again automatically (db.py). An AI failure is never an error here; the request
always saves and returns an extraction (failed or rules_fallback if need be).

Only a person's review (review.py) ever copies values onto the case (D3).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any, Final
from uuid import UUID, uuid4

from sqlalchemy import RowMapping, update
from sqlmodel import Session, select

from app.models.documents import (
    DocumentContentRow,
    DocumentRow,
    ExtractedField,
    Extraction,
    ExtractionError,
    ExtractionRow,
    UserRef,
)
from app.services import audit, case_sql, extraction_engine
from app.services.caller import Caller, is_staff
from app.services.case_sql import cases
from app.services.documents import CaseRef, user_names
from app.services.service_errors import forbidden, not_found

# ExtractableField -> cases column (API_SPEC §3.4: victim_* map to victim.*)
CASE_COLUMN: Final[dict[str, str]] = {
    "victim_name": "victim_name", "victim_phone": "victim_phone", "victim_email": "victim_email",
    "amount": "amount", "currency": "currency", "transfer_date": "transfer_date",
    "account_number": "account_number", "account_holder_name": "account_holder_name", "scam_type": "scam_type",
}
SUPERSEDED_NOTE: Final = "superseded"


@dataclass(frozen=True, slots=True)
class ExtractionSettings:
    """From the app settings (AI_TIMEOUT_SECONDS, AI_MODE, the review threshold)."""

    timeout: float = 20.0
    threshold: float = extraction_engine.DEFAULT_THRESHOLD
    ai_enabled: bool = True
    ai: extraction_engine.ExtractFn = extraction_engine.galib_extract_fields
    ai_caller: extraction_engine.AICaller | None = None


def json_value(value: Any) -> Any:
    """A case or AI value as stored in the extraction's JSON (money stays a number)."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, date):
        return value.isoformat()
    return value


def to_extraction(row: ExtractionRow, case_reference: str, reviewer_name: str | None = None) -> Extraction:
    return Extraction(
        id=str(row.id), document_id=str(row.document_id), case_id=str(row.case_id), case_reference=case_reference,
        bank_id=row.bank_id, status=row.status, source=row.source, model=row.model,  # type: ignore[arg-type]
        prompt_version=row.prompt_version,
        overall_confidence=float(row.overall_confidence) if row.overall_confidence is not None else None,
        review_lane=row.review_lane,  # type: ignore[arg-type]
        fields=[ExtractedField(**f) for f in row.fields],
        missing_fields=list(row.missing_fields),  # type: ignore[arg-type]
        error=ExtractionError(**row.error) if row.error else None,
        created_at=row.created_at,
        reviewed_by=UserRef(id=str(row.reviewed_by), name=reviewer_name or "Unknown") if row.reviewed_by else None,
        reviewed_at=row.reviewed_at, review_note=row.review_note,
    )


def _fields_json(outcome: extraction_engine.Outcome, case: RowMapping) -> list[dict[str, Any]]:
    return [
        {
            "name": guess.name, "value": json_value(guess.value), "confidence": guess.confidence,
            "evidence": guess.evidence, "current_case_value": json_value(case[CASE_COLUMN[guess.name]]),
            "final_value": None,
        }
        for guess in outcome.fields
    ]


def _supersede_pending(s: Session, caller: Caller, document_id: UUID) -> int:
    """Re-running extraction rejects the document's older pending result (API_SPEC §6.5)."""
    older = s.exec(
        select(ExtractionRow).where(ExtractionRow.document_id == document_id,
                                    ExtractionRow.status == "pending_review")
    ).all()
    now = case_sql.now()
    for row in older:
        row.status, row.reviewed_by, row.reviewed_at, row.review_note = "rejected", caller.user_id, now, SUPERSEDED_NOTE
        s.add(row)
    return len(older)


def run_extraction(s: Session, caller: Caller, document_id: UUID,
                   settings: ExtractionSettings | None = None) -> Extraction:
    """``POST /api/documents/{id}/extract`` → 201, always (even when the AI is down)."""
    settings = settings or ExtractionSettings()
    if not is_staff(caller):
        raise forbidden()
    doc = s.get(DocumentRow, document_id)
    if doc is None:
        raise not_found("Document")
    case_sql.require_open(case_sql.require_case(s, doc.case_id))
    content = s.get(DocumentContentRow, document_id)
    if content is None:
        raise not_found("Document")
    file_bytes, mime_type, doc_type, case_id = content.content, doc.mime_type, doc.doc_type, doc.case_id
    s.commit()  # no open transaction while the AI works (guide §4.5)

    outcome = extraction_engine.extract(
        file_bytes, mime_type, doc_type, timeout=settings.timeout, threshold=settings.threshold,
        ai_enabled=settings.ai_enabled, ai=settings.ai, caller=settings.ai_caller,
    )

    case = case_sql.require_case(s, case_id)  # a new transaction, scoped again
    case_sql.require_open(case)  # closed while the AI worked: save nothing
    superseded = _supersede_pending(s, caller, document_id)
    row = ExtractionRow(
        id=uuid4(), document_id=document_id, case_id=case_id, bank_id=case["bank_id"],
        status=outcome.status, source=outcome.source, model=outcome.model, prompt_version=outcome.prompt_version,
        overall_confidence=Decimal(str(outcome.overall_confidence)) if outcome.overall_confidence is not None else None,
        review_lane=outcome.review_lane, fields=_fields_json(outcome, case), missing_fields=list(outcome.missing_fields),
        error=outcome.error, created_at=case_sql.now(),
    )
    s.add(row)
    delta = (1 if outcome.status == "pending_review" else 0) - superseded
    if delta:
        s.exec(update(cases).where(cases.c.id == case_id)  # type: ignore[call-overload]
               .values(pending_extraction_count=cases.c.pending_extraction_count + delta))
    completed = outcome.status == "pending_review"
    audit.record(
        s, action="ai.extraction_completed" if completed else "ai.extraction_failed", actor=caller.actor(),
        case=CaseRef(case_id, case["bank_id"]),
        summary=(f"AI extraction ready for review ({outcome.source}, {outcome.review_lane})" if completed
                 else f"AI extraction failed: {outcome.error['reason'] if outcome.error else 'unknown'}"),
        metadata={"extraction_id": row.id, "document_id": document_id, "source": outcome.source,
                  "overall_confidence": outcome.overall_confidence, "review_lane": outcome.review_lane,
                  "error_reason": outcome.error["reason"] if outcome.error else None, "superseded": superseded},
    )
    s.commit()
    return to_extraction(row, case["reference"])


def get_extraction(s: Session, caller: Caller, extraction_id: UUID) -> Extraction:
    """``GET /api/extractions/{id}``: staff only."""
    if not is_staff(caller):
        raise forbidden()
    row = s.get(ExtractionRow, extraction_id)
    if row is None:
        raise not_found("Extraction")
    case = case_sql.require_case(s, row.case_id)
    names = user_names(s, {row.reviewed_by} if row.reviewed_by else set())
    return to_extraction(row, case["reference"], names.get(row.reviewed_by) if row.reviewed_by else None)
