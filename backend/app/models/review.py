"""Review of an AI extraction, and the review queue (owner: Asif; API_SPEC §6.5)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Final, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter
from sqlalchemy import RowMapping

from app.models.common import (
    AccountNumber,
    BankId,
    Currency,
    Email,
    ExtractableField,
    Money,
    Name,
    Phone,
    ReviewLane,
    ScamType,
)
from app.models.documents import Extraction, UserRef

# How a person's approved value is checked before it is written to the case.
FIELD_TYPES: Final[dict[str, TypeAdapter[Any]]] = {
    "victim_name": TypeAdapter(Name), "victim_phone": TypeAdapter(Phone), "victim_email": TypeAdapter(Email),
    "amount": TypeAdapter(Money), "currency": TypeAdapter(Currency), "transfer_date": TypeAdapter(date),
    "account_number": TypeAdapter(AccountNumber), "account_holder_name": TypeAdapter(Name),
    "scam_type": TypeAdapter(ScamType),
}


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: Literal["accept", "reject"]
    expected_version: int = Field(ge=1)
    fields: dict[ExtractableField, str | int | float] | None = None
    note: str | None = Field(default=None, max_length=4000)


@dataclass(frozen=True, slots=True)
class ReviewResult:
    """``data`` of the review response: the extraction and the (possibly updated) case row."""

    extraction: Extraction
    case: RowMapping


class ReviewQueueItem(BaseModel):
    extraction_id: str
    case_id: str
    case_reference: str
    bank_id: BankId
    bank_name: str
    document_id: str
    document_filename: str
    source: str
    overall_confidence: float | None
    review_lane: ReviewLane
    assigned_operator: UserRef | None
    created_at: datetime
