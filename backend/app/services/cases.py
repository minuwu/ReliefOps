"""Staff case list and case detail (owner: Anim; API_SPEC §6.3, XREQ-001).

Bank separation is the database's job: every query runs in the caller's scoped
session, so a bank viewer's rows are only their bank's, and another bank's case is
simply not found (``404``, never ``403``). The list is one SQL query (joins, a
correlated count for shared accounts, and ``count(*) over ()`` for the total).
``deadline_state`` is filtered in SQL with the same ``now`` used to compute it in
the response, so the filter and the field always agree.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Final
from uuid import UUID

from sqlalchemy import RowMapping, text
from sqlmodel import Session

from app.errors import ApiError
from app.models.cases import Case, CaseFlags, CaseSummary, DeadlineFilter, Note, SortField, SortOrder
from app.models.common import Page, PageParams
from app.models.documents import UserRef
from app.models.victim_cases import VictimOut
from app.security import Principal
from app.services import audit, case_workflow, documents
from app.services.service_errors import not_found

_SELECT: Final = """
select c.*, b.name as bank_name, op.name as operator_name,
       (select count(*) from cases other
         where other.bank_id = c.bank_id and other.account_number = c.account_number
           and other.id <> c.id) as shared_account_case_count
from cases c
join banks b on b.id = c.bank_id
left join users op on op.id = c.assigned_operator_id
"""
_SORT_COLUMNS: Final = {
    "deadline": "c.deadline",
    "reported_date": "c.reported_date",
    "amount": "c.amount",
    "updated_at": "c.updated_at",
}
_OPEN: Final = "c.status <> 'closed'"
_WARNING: Final = "greatest((c.deadline - c.status_changed_at) * 0.2, interval '1 day')"
_DEADLINE_SQL: Final = {
    "overdue": f"{_OPEN} and c.deadline <= :now",
    "due_soon": f"{_OPEN} and c.deadline > :now and c.deadline - :now <= {_WARNING}",
    "on_track": f"{_OPEN} and (c.deadline is null or c.deadline - :now > {_WARNING})",
}


@dataclass(frozen=True, slots=True)
class CaseFilters:
    statuses: tuple[str, ...] = ()
    bank_id: str | None = None
    assigned_to: str | None = None  # a user id, "me" or "unassigned"
    deadline_state: DeadlineFilter | None = None
    scam_type: str | None = None
    q: str | None = None
    sort: SortField = "deadline"
    order: SortOrder = "asc"


@dataclass(frozen=True, slots=True)
class _Ref:
    id: UUID
    bank_id: str


def _like(term: str) -> str:
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _assigned_clause(value: str, who: Principal, params: dict[str, Any]) -> str:
    if value == "unassigned":
        return "c.assigned_operator_id is null"
    if value == "me":
        params["assigned_to"] = who.user_id
        return "c.assigned_operator_id = :assigned_to"
    try:
        params["assigned_to"] = UUID(value)
    except ValueError:
        raise ApiError(
            422,
            "VALIDATION_ERROR",
            "Request has invalid fields",
            {"fields": [{"field": "assigned_to", "message": "Use a user id, 'me' or 'unassigned'"}]},
        ) from None
    return "c.assigned_operator_id = :assigned_to"


def _where(filters: CaseFilters, who: Principal, now: datetime) -> tuple[list[str], dict[str, Any]]:
    clauses: list[str] = []
    params: dict[str, Any] = {"now": now}
    if filters.statuses:
        clauses.append("c.status = any(:statuses)")
        params["statuses"] = list(filters.statuses)
    if filters.bank_id and who.role != "bank_viewer":  # a viewer always gets their own bank (RLS)
        clauses.append("c.bank_id = :bank_id")
        params["bank_id"] = filters.bank_id
    if filters.assigned_to:
        clauses.append(_assigned_clause(filters.assigned_to, who, params))
    if filters.deadline_state:
        clauses.append(_DEADLINE_SQL[filters.deadline_state])
    if filters.scam_type:
        clauses.append("c.scam_type = :scam_type")
        params["scam_type"] = filters.scam_type
    if filters.q and filters.q.strip():
        clauses.append(
            "(c.reference ilike :q escape '\\' or c.victim_name ilike :q escape '\\' "
            "or c.account_number ilike :q escape '\\')"
        )
        params["q"] = _like(filters.q.strip())
    return clauses, params


def _user_ref(user_id: UUID | None, name: str | None) -> UserRef | None:
    return UserRef(id=str(user_id), name=name or "Unknown") if user_id is not None else None


def _flags(row: RowMapping) -> CaseFlags:
    return CaseFlags(
        missing_fields=case_workflow.missing_fields(row),
        ai_review_pending=row["pending_extraction_count"] > 0,
        shared_account_case_count=row["shared_account_case_count"] if row["account_number"] else 0,
        victim_question_pending=row["victim_question_pending"],
        possible_duplicate=row["possible_duplicate"],
    )


def _summary_fields(row: RowMapping, now: datetime) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "reference": row["reference"],
        "bank_id": row["bank_id"],
        "bank_name": row["bank_name"],
        "victim_name": row["victim_name"],
        "amount": row["amount"],
        "currency": row["currency"],
        "scam_type": row["scam_type"],
        "status": row["status"],
        "deadline": row["deadline"],
        "deadline_state": case_workflow.deadline_state(row, now),
        "assigned_operator": _user_ref(row["assigned_operator_id"], row["operator_name"]),
        "reported_date": row["reported_date"],
        "updated_at": row["updated_at"],
        "flags": _flags(row),
    }


def list_cases(
    s: Session, who: Principal, filters: CaseFilters, paging: PageParams, now: datetime
) -> Page[CaseSummary]:
    clauses, params = _where(filters, who, now)
    where = f"where {' and '.join(clauses)}" if clauses else ""
    direction = "desc" if filters.order == "desc" else "asc"
    order_by = f"{_SORT_COLUMNS[filters.sort]} {direction} nulls last, c.reference asc"
    sql = (
        f"select *, count(*) over () as total_count from ({_SELECT} {where}) c "
        f"order by {order_by} limit :limit offset :offset"
    )
    params |= {"limit": paging.page_size, "offset": paging.offset}
    rows = s.exec(text(sql), params=params).mappings().all()  # type: ignore[call-overload]
    if rows:
        total = rows[0]["total_count"]
    else:
        count_sql = f"select count(*) from ({_SELECT} {where}) c"
        total = s.exec(text(count_sql), params=params).scalar_one()  # type: ignore[call-overload]
    s.rollback()  # read-only: end the transaction now
    items = [CaseSummary(**_summary_fields(row, now)) for row in rows]
    return Page[CaseSummary](items=items, page=paging.page, page_size=paging.page_size, total=total)


def _load(s: Session, case_id: UUID) -> RowMapping:
    row = s.exec(text(f"{_SELECT} where c.id = :id"), params={"id": case_id}).mappings().first()  # type: ignore[call-overload]
    if row is None:
        raise not_found("Case")
    return row


def _notes(s: Session, case_id: UUID) -> list[Note]:
    rows = s.exec(  # type: ignore[call-overload]
        text(
            "select n.id, n.body, n.created_at, n.author_id, u.name as author_name "
            "from notes n left join users u on u.id = n.author_id where n.case_id = :id "
            "order by n.created_at desc, n.id"
        ),
        params={"id": case_id},
    ).mappings()
    return [
        Note(
            id=str(r["id"]),
            body=r["body"],
            author=UserRef(id=str(r["author_id"]), name=r["author_name"] or "Unknown"),
            created_at=r["created_at"],
        )
        for r in rows
    ]


def build_case(s: Session, who: Principal, row: RowMapping, now: datetime) -> Case:
    """The full ``Case`` for a row loaded with ``_SELECT`` (used by get, create, edit, transition, assign)."""
    return Case(
        **_summary_fields(row, now),
        version=row["version"],
        payout_amount=row["payout_amount"],
        victim=VictimOut(
            name=row["victim_name"],
            phone=row["victim_phone"],
            email=row["victim_email"],
            address=row["victim_address"],
            preferred_language=row["preferred_language"],
        ),
        transfer_date=row["transfer_date"],
        account_number=row["account_number"],
        account_holder_name=row["account_holder_name"],
        description=row["description"],
        channel=row["channel"],
        closure_reason=row["closure_reason"],
        created_at=row["created_at"],
        closed_at=row["closed_at"],
        allowed_transitions=case_workflow.allowed_transitions(row, who),
        allowed_closure_reasons=case_workflow.allowed_closure_reasons(row, who),
        documents=documents.case_documents(s, row["id"]),
        notes=_notes(s, row["id"]),
    )


def load_case(s: Session, who: Principal, case_id: UUID, now: datetime) -> Case:
    """The full case, without the view audit (after a write)."""
    return build_case(s, who, _load(s, case_id), now)


def get_case(s: Session, who: Principal, case_id: UUID, now: datetime) -> Case:
    """``GET /api/cases/{id}``: the full case, and a ``case.viewed`` audit at most every 10 minutes."""
    row = _load(s, case_id)
    case = build_case(s, who, row, now)
    audit.record_case_view(s, actor=who.actor(), case=_Ref(row["id"], row["bank_id"]), now=now)
    s.commit()
    return case
