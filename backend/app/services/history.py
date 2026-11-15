"""Case history, CSV export and the audit log (owner: Asif; API_SPEC §6.4).

Reads run in the caller's scope, so RLS limits a bank viewer to their own bank's
entries even if a filter were missing here. The audit log itself can't be
changed by anyone (migration 002).
"""

from __future__ import annotations

import csv
import io
from typing import Any, Final
from uuid import UUID

from sqlalchemy import ColumnElement, RowMapping, func, select
from sqlmodel import Session

from app.models.audit import AUDIT_ACTIONS, AuditLogRow
from app.models.common import Page, PageParams
from app.models.history import AuditActor, AuditEntry, AuditFilters
from app.services import audit, case_sql
from app.services.caller import Caller
from app.services.case_sql import cases
from app.services.service_errors import forbidden, validation_error

HISTORY_ROLES: Final = frozenset({"operator", "supervisor", "bank_viewer"})
AUDIT_LOG_ROLES: Final = frozenset({"supervisor", "bank_viewer"})
CSV_COLUMNS: Final = ("at", "actor_name", "actor_role", "action", "summary")
_DEFAULT_ACTOR_NAMES: Final = {"system": "System", "ai": "AI extractor", "public": "Web intake form"}
_FORMULA_PREFIXES: Final = ("=", "+", "-", "@", "\t", "\r")

log = AuditLogRow.__table__  # type: ignore[attr-defined]


def _require(caller: Caller, roles: frozenset[str]) -> None:
    if caller.role not in roles:
        raise forbidden()


def _entries(where: list[ColumnElement[bool]]):  # noqa: ANN202
    return (
        select(log, cases.c.reference.label("case_reference"))
        .select_from(log.outerjoin(cases, cases.c.id == log.c.case_id))
        .where(*where)
    )


def _to_entry(row: RowMapping) -> AuditEntry:
    return AuditEntry(
        id=str(row["id"]), at=row["at"],
        actor=AuditActor(
            type=row["actor_type"], id=str(row["actor_id"]) if row["actor_id"] else None,
            name=row["actor_name"] or _DEFAULT_ACTOR_NAMES.get(row["actor_type"], "Unknown"),
            role=row["actor_role"],
        ),
        action=row["action"], case_id=str(row["case_id"]) if row["case_id"] else None,
        case_reference=row["case_reference"], bank_id=row["bank_id"], summary=row["summary"],
        changes=row["changes"], metadata=row["metadata"],
    )


def _page(s: Session, where: list[ColumnElement[bool]], paging: PageParams) -> Page[AuditEntry]:
    total = s.exec(select(func.count()).select_from(log).where(*where)).scalar_one()  # type: ignore[call-overload]
    rows = s.exec(  # type: ignore[call-overload]
        _entries(where).order_by(log.c.at.desc(), log.c.id.desc()).limit(paging.page_size).offset(paging.offset)
    ).mappings().all()
    return Page[AuditEntry](items=[_to_entry(r) for r in rows], page=paging.page, page_size=paging.page_size, total=total)


def case_history(s: Session, caller: Caller, case_id: UUID, paging: PageParams | None = None) -> Page[AuditEntry]:
    """``GET /api/cases/{id}/history``: the case's entries, newest first."""
    _require(caller, HISTORY_ROLES)
    case_sql.require_case(s, case_id)  # 404 for another bank's case
    return _page(s, [log.c.case_id == case_id], paging or PageParams())


def _csv_cell(value: Any) -> str:
    text = "" if value is None else str(value)
    return "'" + text if text.startswith(_FORMULA_PREFIXES) else text  # no spreadsheet formulas


def case_history_csv(s: Session, caller: Caller, case_id: UUID) -> tuple[str, str]:
    """``GET /api/cases/{id}/history?format=csv``: (filename, csv text). The export is audited."""
    _require(caller, HISTORY_ROLES)
    case = case_sql.require_case(s, case_id)
    rows = s.exec(_entries([log.c.case_id == case_id]).order_by(log.c.at.desc())).mappings().all()  # type: ignore[call-overload]
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(CSV_COLUMNS)
    for row in rows:
        entry = _to_entry(row)
        writer.writerow([_csv_cell(v) for v in (entry.at.isoformat(), entry.actor.name, entry.actor.role,
                                                 entry.action, entry.summary)])
    audit.record(s, action="export.generated", actor=caller.actor(), case=case,
                 summary="Case history exported as CSV", metadata={"format": "csv", "rows": len(rows)})
    s.commit()
    return f"{case['reference']}-history.csv", buffer.getvalue()


def audit_logs(s: Session, caller: Caller, filters: AuditFilters | None = None,
               paging: PageParams | None = None) -> Page[AuditEntry]:
    """``GET /api/audit-logs``: supervisors see all banks, bank viewers their own (RLS)."""
    _require(caller, AUDIT_LOG_ROLES)
    filters = filters or AuditFilters()
    if filters.action is not None and filters.action not in AUDIT_ACTIONS:
        raise validation_error("action", "Unknown audit action")
    if filters.from_ and filters.to and filters.from_ > filters.to:
        raise validation_error("from", "'from' must be before 'to'")
    where: list[ColumnElement[bool]] = []
    if filters.case_id:
        where.append(log.c.case_id == filters.case_id)
    if filters.actor_id:
        where.append(log.c.actor_id == filters.actor_id)
    if filters.action:
        where.append(log.c.action == filters.action)
    if filters.from_:
        where.append(log.c.at >= filters.from_)
    if filters.to:
        where.append(log.c.at <= filters.to)
    return _page(s, where, paging or PageParams())
