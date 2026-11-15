"""Supervisor views: dashboard and shared-account alerts (owner: Anim; API_SPEC §6.6)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.models.common import BankId
from app.models.dashboard import DashboardStats, SharedAccountAlert
from app.responses import Envelope, error_responses, ok
from app.security import Principal, SessionDep, SupervisorUser, require_roles
from app.services import dashboard

router = APIRouter(prefix="/api", tags=["dashboard"])

DashboardReader = Annotated[Principal, Depends(require_roles("supervisor", "bank_viewer"))]


@router.get(
    "/dashboard/stats",
    response_model=Envelope[DashboardStats],
    summary="Dashboard numbers (supervisor: all banks or one; bank viewer: own bank)",
    responses=error_responses(401, 403, 422),
)
def get_stats(who: DashboardReader, s: SessionDep, bank_id: BankId | None = None) -> dict:
    return ok(dashboard.stats(s, who, bank_id, datetime.now(UTC)))


@router.get(
    "/alerts/shared-accounts",
    response_model=Envelope[list[SharedAccountAlert]],
    summary="Accounts that appear in several cases at the same bank (supervisor only)",
    responses=error_responses(401, 403, 422),
)
def shared_accounts(who: SupervisorUser, s: SessionDep, min_cases: Annotated[int, Query(ge=2, le=50)] = 2) -> dict:
    return ok(dashboard.shared_accounts(s, min_cases))
