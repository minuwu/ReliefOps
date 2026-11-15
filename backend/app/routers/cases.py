"""Staff case routes (owner: Anim; API_SPEC §6.3). HTTP only; the rules are in the services."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, get_args
from uuid import UUID

from fastapi import APIRouter, Query

from app.errors import ApiError
from app.models.cases import Case, CaseSummary, DeadlineFilter, SortField, SortOrder
from app.models.common import BankId, CaseStatus, Page, PageParams, ScamType
from app.responses import Envelope, error_responses, ok
from app.security import AnyStaffUser, SessionDep
from app.services import cases

router = APIRouter(prefix="/api/cases", tags=["cases"])

_STATUSES = frozenset(get_args(CaseStatus))


def _statuses(raw: str | None) -> tuple[str, ...]:
    if not raw:
        return ()
    values = tuple(part.strip() for part in raw.split(",") if part.strip())
    unknown = [v for v in values if v not in _STATUSES]
    if unknown:
        message = f"Unknown status {unknown[0]!r}; use {', '.join(sorted(_STATUSES))}"
        raise ApiError(
            422, "VALIDATION_ERROR", "Request has invalid fields", {"fields": [{"field": "status", "message": message}]}
        )
    return values


@router.get(
    "",
    response_model=Envelope[Page[CaseSummary]],
    summary="List cases (bank viewers: own bank only)",
    responses=error_responses(401, 403, 422),
)
def list_cases(
    who: AnyStaffUser,
    s: SessionDep,
    status: Annotated[str | None, Query(description="Comma-separated statuses, e.g. received,verified")] = None,
    bank_id: BankId | None = None,
    assigned_to: Annotated[str | None, Query(description="A user id, `me`, or `unassigned`")] = None,
    deadline_state: DeadlineFilter | None = None,
    scam_type: ScamType | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    sort: SortField = "deadline",
    order: SortOrder = "asc",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict:
    filters = cases.CaseFilters(
        statuses=_statuses(status),
        bank_id=bank_id,
        assigned_to=assigned_to,
        deadline_state=deadline_state,
        scam_type=scam_type,
        q=q,
        sort=sort,
        order=order,
    )
    result = cases.list_cases(s, who, filters, PageParams(page=page, page_size=page_size), datetime.now(UTC))
    return ok(result)


@router.get(
    "/{case_id}",
    response_model=Envelope[Case],
    summary="Open a case (audited as case.viewed)",
    responses=error_responses(401, 403, 404, 422),
)
def get_case(case_id: UUID, who: AnyStaffUser, s: SessionDep) -> dict:
    return ok(cases.get_case(s, who, case_id, datetime.now(UTC)))
