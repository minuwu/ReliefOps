"""Dashboard numbers and shared-account alerts (owner: Anim; API_SPEC §6.6).

Both run in the caller's scoped session, so row-level security decides the banks:
a bank viewer always gets their own bank, whatever ``bank_id`` they send. The
``overdue``/``due_soon`` definitions are the same SQL as the case list's filters,
so the dashboard and the list always agree.

Alerts match on ``(bank_id, account_number)`` only: the same digits at two banks are
never compared (that cross-bank question is XREQ-004, still a team decision).
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Final, get_args

from sqlalchemy import text
from sqlmodel import Session

from app.models.common import CaseStatus
from app.models.dashboard import AlertCase, DashboardScope, DashboardStats, SharedAccountAlert, Workload
from app.models.documents import UserRef
from app.security import Principal
from app.services.cases import _DEADLINE_SQL

STATUSES: Final = get_args(CaseStatus)


def _bank_filter(who: Principal, bank_id: str | None, column: str = "c.bank_id") -> tuple[str, dict[str, Any]]:
    if bank_id and who.role != "bank_viewer":  # a viewer's bank comes from RLS
        return f"and {column} = :bank_id", {"bank_id": bank_id}
    return "", {}


def _scope(s: Session, who: Principal, bank_id: str | None) -> DashboardScope:
    scope_bank = who.bank_id if who.role == "bank_viewer" else bank_id
    if scope_bank is None:
        return DashboardScope(bank_id=None, label="All banks")
    name = s.exec(text("select name from banks where id = :id"), params={"id": scope_bank}).scalar_one_or_none()  # type: ignore[call-overload]
    return DashboardScope(bank_id=scope_bank, label=name or scope_bank)  # type: ignore[arg-type]


def stats(s: Session, who: Principal, bank_id: str | None, now: datetime) -> DashboardStats:
    where, params = _bank_filter(who, bank_id)
    params["now"] = now
    totals = (
        s.exec(  # type: ignore[call-overload]
            text(
                "select "
                "count(*) filter (where c.status <> 'closed') as open_cases, "
                f"count(*) filter (where {_DEADLINE_SQL['overdue']}) as overdue_cases, "
                f"count(*) filter (where {_DEADLINE_SQL['due_soon']}) as due_soon_cases, "
                "count(*) filter (where c.status <> 'closed' and c.assigned_operator_id is null) as unassigned_cases, "
                "avg(extract(epoch from c.closed_at - (c.reported_date::timestamp at time zone 'UTC')) / 86400) "
                "  filter (where c.status = 'closed') as avg_handling_days "
                f"from cases c where true {where}"
            ),
            params=params,
        )
        .mappings()
        .one()
    )
    by_status = dict.fromkeys(STATUSES, 0)
    for row in s.exec(  # type: ignore[call-overload]
        text(f"select c.status, count(*) as n from cases c where true {where} group by c.status"), params=params
    ):
        by_status[row.status] = row.n

    ai_where, ai_params = _bank_filter(who, bank_id, "e.bank_id")
    ai = (
        s.exec(  # type: ignore[call-overload]
            text(
                "select count(*) as pending, "
                "count(*) filter (where e.review_lane is distinct from 'standard') as low_confidence "
                f"from ai_extractions e where e.status = 'pending_review' {ai_where}"
            ),
            params=ai_params,
        )
        .mappings()
        .one()
    )

    workload: list[Workload] = []
    if who.role != "bank_viewer":
        rows = s.exec(  # type: ignore[call-overload]
            text(
                "select u.id, u.name, "
                "count(c.id) filter (where c.status <> 'closed') as open_cases, "
                f"count(c.id) filter (where {_DEADLINE_SQL['overdue']}) as overdue_cases "
                f"from users u left join cases c on c.assigned_operator_id = u.id {where} "
                "where u.role = 'operator' and u.is_active "
                "group by u.id, u.name order by open_cases desc, u.name"
            ),
            params=params,
        ).mappings()
        workload = [
            Workload(
                operator=UserRef(id=str(r["id"]), name=r["name"]),
                open_cases=r["open_cases"],
                overdue_cases=r["overdue_cases"],
            )
            for r in rows
        ]
    scope = _scope(s, who, bank_id)
    s.rollback()  # read-only

    avg = totals["avg_handling_days"]
    return DashboardStats(
        scope=scope,
        open_cases=totals["open_cases"],
        overdue_cases=totals["overdue_cases"],
        due_soon_cases=totals["due_soon_cases"],
        unassigned_cases=totals["unassigned_cases"],
        avg_handling_days=round(float(avg), 1) if avg is not None else None,
        ai_review_pending=ai["pending"],
        ai_low_confidence_pending=ai["low_confidence"],
        cases_by_status=by_status,  # type: ignore[arg-type]
        workload=workload,
        generated_at=now,
    )


def shared_accounts(s: Session, min_cases: int) -> list[SharedAccountAlert]:
    rows = (
        s.exec(  # type: ignore[call-overload]
            text(
                "select c.bank_id, b.name as bank_name, c.account_number, count(*) as case_count, "
                "coalesce(sum(c.amount), 0) as total_amount, min(c.currency) as currency, "
                "json_agg(json_build_object('id', c.id, 'reference', c.reference, 'status', c.status) "
                "  order by c.reference) as cases "
                "from cases c join banks b on b.id = c.bank_id "
                "where c.account_number is not null "
                "group by c.bank_id, b.name, c.account_number having count(*) >= :min_cases "
                "order by case_count desc, total_amount desc, c.bank_id, c.account_number"
            ),
            params={"min_cases": min_cases},
        )
        .mappings()
        .all()
    )
    s.rollback()
    return [
        SharedAccountAlert(
            bank_id=r["bank_id"],
            bank_name=r["bank_name"],
            account_number=r["account_number"],
            case_count=r["case_count"],
            total_amount=Decimal(r["total_amount"]),
            currency=r["currency"],
            cases=[AlertCase(**case) for case in r["cases"]],
        )
        for r in rows
    ]
