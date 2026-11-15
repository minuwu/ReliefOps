"""Staff-side case schemas (owner: Anim; API_SPEC §4 CaseSummary / Case / Note, §6.3).

Reuses Asif's ``UserRef``, ``DocumentMeta`` and ``VictimOut`` so a document or a victim
looks the same in every response.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.models.common import (
    AccountNumber,
    BankId,
    CaseStatus,
    ClosureReason,
    Currency,
    IntakeChannel,
    MissingField,
    Money,
    Name,
    ScamType,
)
from app.models.documents import DocumentMeta, UserRef
from app.models.victim_cases import VictimIn, VictimOut, VictimPatch

Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)]
Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class CaseCreate(BaseModel):
    """``POST /api/cases``: a phone or paper report. Only ``bank_id``, ``channel`` and ``victim.name`` are required."""

    model_config = ConfigDict(extra="forbid")

    bank_id: BankId
    channel: IntakeChannel
    victim: VictimIn
    amount: Money | None = None
    currency: Currency = "JPY"
    transfer_date: date | None = None
    account_number: AccountNumber | None = None
    account_holder_name: Name | None = None
    scam_type: ScamType | None = None
    description: Description | None = None
    reported_date: date | None = None
    assigned_operator_id: UUID | None = None


class CaseUpdate(BaseModel):
    """``PATCH /api/cases/{id}``: a missing field stays unchanged, ``null`` clears it, ``victim`` merges."""

    model_config = ConfigDict(extra="forbid")

    expected_version: int = Field(ge=1)
    victim: VictimPatch | None = None
    amount: Money | None = None
    currency: Currency = Field(default=None, validate_default=False)  # type: ignore[assignment]
    transfer_date: date | None = None
    account_number: AccountNumber | None = None
    account_holder_name: Name | None = None
    scam_type: ScamType | None = None
    description: Description | None = None
    deadline: datetime | None = None
    deadline_reason: Reason | None = None

    @model_validator(mode="after")
    def _deadline_needs_a_reason(self) -> CaseUpdate:
        if self.deadline is not None and not self.deadline_reason:
            raise ValueError("deadline_reason is required when changing the deadline")
        if "currency" in self.model_fields_set and self.currency is None:
            raise ValueError("currency can't be cleared")
        return self


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
