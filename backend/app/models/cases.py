"""Staff-side case schemas (owner: Anim; API_SPEC §4 CaseSummary / Case / Note, §6.3).

Reuses Asif's ``UserRef``, ``DocumentMeta`` and ``VictimOut`` so a document or a victim
looks the same in every response.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.common import (
    BankId,
    CaseStatus,
    ClosureReason,
    IntakeChannel,
    MissingField,
    Money,
    ScamType,
)
from app.models.documents import DocumentMeta, UserRef
from app.models.victim_cases import VictimOut

DeadlineState = Literal["on_track", "due_soon", "overdue", "none"]
DeadlineFilter = Literal["on_track", "due_soon", "overdue"]
SortField = Literal["deadline", "reported_date", "amount", "updated_at"]
SortOrder = Literal["asc", "desc"]


class CaseFlags(BaseModel):
    missing_fields: list[MissingField]
    ai_review_pending: bool
    shared_account_case_count: int
    victim_question_pending: bool
    possible_duplicate: bool


class CaseSummary(BaseModel):
    id: str
    reference: str
    bank_id: BankId
    bank_name: str
    victim_name: str
    amount: Money | None
    currency: str
    scam_type: ScamType | None
    status: CaseStatus
    deadline: datetime | None
    deadline_state: DeadlineState
    assigned_operator: UserRef | None
    reported_date: date
    updated_at: datetime
    flags: CaseFlags


class Note(BaseModel):
    id: str
    body: str
    author: UserRef
    created_at: datetime


class Case(CaseSummary):
    version: int
    payout_amount: Money | None
    victim: VictimOut
    transfer_date: date | None
    account_number: str | None
    account_holder_name: str | None
    description: str | None
    channel: IntakeChannel
    closure_reason: ClosureReason | None
    created_at: datetime
    closed_at: datetime | None
    allowed_transitions: list[CaseStatus]
    allowed_closure_reasons: list[ClosureReason]
    documents: list[DocumentMeta]
    notes: list[Note] = Field(description="Newest first")
