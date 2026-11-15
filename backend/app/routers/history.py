"""Case history and the global audit log (owner: Asif; API_SPEC §6.4).

Read-only: no route edits or deletes audit entries, and the database refuses it too (D8).
Bank viewers see only their own bank; RLS enforces it, and another bank's case is a 404.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Query, Response

from app.models.common import Page, PageParams
from app.models.history import AuditEntry, AuditFilters
from app.responses import Envelope, error_responses, ok
from app.security import AnyStaffUser, SessionDep
from app.services import document_files, history

router = APIRouter(prefix="/api", tags=["audit"])

PageNumber = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=100)]


@router.get(
    "/cases/{case_id}/history",
    response_model=Envelope[Page[AuditEntry]],
    summary="A case's audit trail, newest first (format=csv downloads it, audited as export.generated)",
    responses={200: {"content": {"text/csv": {}}}, **error_responses(401, 403, 404, 422)},
)
def case_history(
    case_id: UUID,
    who: AnyStaffUser,
    s: SessionDep,
    format: Literal["json", "csv"] = "json",  # noqa: A002 - the contract's query name
    page: PageNumber = 1,
    page_size: PageSize = 20,
) -> dict | Response:
    if format == "csv":
        filename, body = history.case_history_csv(s, who, case_id)
        return Response(
            content=body.encode("utf-8"),
            media_type="text/csv; charset=utf-8",
            headers=document_files.download_headers(filename, "text/csv"),
        )
    return ok(history.case_history(s, who, case_id, PageParams(page=page, page_size=page_size)))


@router.get(
    "/audit-logs",
    response_model=Envelope[Page[AuditEntry]],
    summary="The global audit log, newest first (bank viewers: own bank only)",
    responses=error_responses(401, 403, 422),
)
def audit_logs(
    who: AnyStaffUser,
    s: SessionDep,
    case_id: UUID | None = None,
    actor_id: UUID | None = None,
    action: Annotated[str | None, Query(max_length=40)] = None,
    from_: Annotated[datetime | None, Query(alias="from", description="ISO timestamp, inclusive")] = None,
    to: Annotated[datetime | None, Query(description="ISO timestamp, inclusive")] = None,
    page: PageNumber = 1,
    page_size: PageSize = 20,
) -> dict:
    filters = AuditFilters(case_id=case_id, actor_id=actor_id, action=action, from_=from_, to=to)
    return ok(history.audit_logs(s, who, filters, PageParams(page=page, page_size=page_size)))
