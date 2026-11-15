"""Supervisor views (owner: Anim; API_SPEC §4 DashboardStats / SharedAccountAlert, §6.6)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.models.common import BankId, CaseStatus, Money
from app.models.documents import UserRef


class DashboardScope(BaseModel):
    bank_id: BankId | None  # None = all banks
    label: str


class Workload(BaseModel):
    operator: UserRef
    open_cases: int
    overdue_cases: int


class DashboardStats(BaseModel):
    scope: DashboardScope
    open_cases: int
    overdue_cases: int
    due_soon_cases: int
    unassigned_cases: int
    avg_handling_days: float | None
    ai_review_pending: int
    ai_low_confidence_pending: int
    cases_by_status: dict[CaseStatus, int]
    workload: list[Workload]
    generated_at: datetime


class AlertCase(BaseModel):
    id: str
    reference: str
    status: CaseStatus


class SharedAccountAlert(BaseModel):
    bank_id: BankId
    bank_name: str
    account_number: str
    case_count: int
    total_amount: Money
    currency: str
    cases: list[AlertCase]
