"""The AI review queue (owner: Asif; API_SPEC §6.5 ``GET /api/review-queue``).

Only ``pending_review`` extractions, ``low_confidence`` first, then oldest first,
so the riskiest AI output is looked at soonest. Staff only.
"""

from __future__ import annotations

from typing import Final, get_args

from sqlalchemy import ColumnElement, case, column, func, select, table
from sqlmodel import Session

from app.models.common import BankId, Page, PageParams, ReviewLane
from app.models.documents import DocumentRow, ExtractionRow, UserRef
from app.models.review import ReviewQueueItem
from app.services.caller import Caller, is_staff
from app.services.case_sql import banks, cases
from app.services.service_errors import forbidden, validation_error

LANES: Final = frozenset(get_args(ReviewLane))
BANKS: Final = frozenset(get_args(BankId))
ext = ExtractionRow.__table__  # type: ignore[attr-defined]
# A pending result without a lane is treated as low confidence: the safe side, reviewed first.
LANE = func.coalesce(ext.c.review_lane, "low_confidence")
docs = DocumentRow.__table__  # type: ignore[attr-defined]
_users = table("users", column("id"), column("name"))


def review_queue(s: Session, caller: Caller, *, lane: str | None = None, bank_id: str | None = None,
                 paging: PageParams | None = None) -> Page[ReviewQueueItem]:
    if not is_staff(caller):
        raise forbidden()
    if lane is not None and lane not in LANES:
        raise validation_error("lane", "Must be standard or low_confidence")
    if bank_id is not None and bank_id not in BANKS:
        raise validation_error("bank_id", "Unknown bank")
    paging = paging or PageParams()

    where: list[ColumnElement[bool]] = [ext.c.status == "pending_review"]
    if lane:
        where.append(LANE == lane)
    if bank_id:
        where.append(ext.c.bank_id == bank_id)

    total = s.exec(select(func.count()).select_from(ext).where(*where)).scalar_one()  # type: ignore[call-overload]
    rows = s.exec(  # type: ignore[call-overload]
        select(
            ext.c.id, ext.c.case_id, ext.c.bank_id, ext.c.document_id, ext.c.source, ext.c.overall_confidence,
            LANE.label("lane"), ext.c.created_at, cases.c.reference, cases.c.assigned_operator_id,
            banks.c.name.label("bank_name"), docs.c.filename, _users.c.name.label("operator_name"),
        )
        .select_from(
            ext.join(cases, cases.c.id == ext.c.case_id)
            .join(banks, banks.c.id == ext.c.bank_id)
            .join(docs, docs.c.id == ext.c.document_id)
            .outerjoin(_users, _users.c.id == cases.c.assigned_operator_id)
        )
        .where(*where)
        .order_by(case((LANE == "low_confidence", 0), else_=1), ext.c.created_at, ext.c.id)
        .limit(paging.page_size)
        .offset(paging.offset)
    ).mappings().all()
    items = [
        ReviewQueueItem(
            extraction_id=str(r["id"]), case_id=str(r["case_id"]), case_reference=r["reference"],
            bank_id=r["bank_id"], bank_name=r["bank_name"], document_id=str(r["document_id"]),
            document_filename=r["filename"], source=r["source"],
            overall_confidence=float(r["overall_confidence"]) if r["overall_confidence"] is not None else None,
            review_lane=r["lane"],
            assigned_operator=UserRef(id=str(r["assigned_operator_id"]), name=r["operator_name"] or "Unknown")
            if r["assigned_operator_id"] else None,
            created_at=r["created_at"],
        )
        for r in rows
    ]
    return Page[ReviewQueueItem](items=items, page=paging.page, page_size=paging.page_size, total=total)
