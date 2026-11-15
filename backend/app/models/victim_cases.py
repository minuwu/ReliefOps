"""Request and response schemas for victim self-service (owner: Asif; API_SPEC §4 VictimCase, §6.7).

Requests forbid unknown fields, so ``status``, ``bank_id`` or ``role`` in a
victim's PATCH is a 422, never silently ignored. In a PATCH, a field that is
left out stays unchanged and ``null`` clears it (guide §4.4 rule 6); fields a
victim can't clear (name, language, amount, ...) don't accept ``null``.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Final, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.common import (
    AccountNumber,
    BankId,
    CaseStatus,
    ClosureReason,
    Currency,
    Email,
    Language,
    LongText,
    MissingField,
    Money,
    Name,
    Phone,
    ScamType,
    ShortText,
)

# API_SPEC §3.5, in the contract's VictimEditableField order.
CONTACT_FIELDS: Final = ("victim.phone", "victim.email", "victim.address", "victim.preferred_language")
ALL_EDITABLE_FIELDS: Final = (
    "victim.name", *CONTACT_FIELDS,
    "amount", "currency", "transfer_date", "account_number", "account_holder_name", "scam_type", "description",
)
VictimEditableField = Literal[
    "victim.name", "victim.phone", "victim.email", "victim.address", "victim.preferred_language",
    "amount", "currency", "transfer_date", "account_number", "account_holder_name", "scam_type", "description",
]


class _Request(BaseModel):
    model_config = ConfigDict(extra="forbid")


class VictimIn(_Request):
    name: Name
    phone: Phone | None = None
    email: Email | None = None
    address: ShortText | None = None
    preferred_language: Language = "en"


class VictimReport(_Request):
    """``POST /api/victim/cases``: the online report form."""

    bank_id: BankId
    victim: VictimIn
    amount: Money
    currency: Currency = "JPY"
    transfer_date: date
    account_number: AccountNumber | None = None
    account_holder_name: Name | None = None
    scam_type: ScamType
    description: LongText | None = None
    consent: Literal[True]


class VictimPatch(_Request):
    name: Name = Field(default=None, validate_default=False)  # type: ignore[assignment]
    phone: Phone | None = None
    email: Email | None = None
    address: ShortText | None = None
    preferred_language: Language = Field(default=None, validate_default=False)  # type: ignore[assignment]


class VictimCaseUpdate(_Request):
    """``PATCH /api/victim/cases/{case_id}``: only the fields that changed, plus ``expected_version``."""

    expected_version: int = Field(ge=1)
    victim: VictimPatch | None = None
    amount: Money = Field(default=None, validate_default=False)  # type: ignore[assignment]
    currency: Currency = Field(default=None, validate_default=False)  # type: ignore[assignment]
    transfer_date: date = Field(default=None, validate_default=False)  # type: ignore[assignment]
    account_number: AccountNumber | None = None
    account_holder_name: Name | None = None
    scam_type: ScamType = Field(default=None, validate_default=False)  # type: ignore[assignment]
    description: LongText | None = None

    def requested(self) -> dict[str, object]:
        """The fields the victim sent, by their API name (``victim.phone``, ``amount``, ...)."""
        sent: dict[str, object] = {}
        for name in self.model_fields_set - {"expected_version", "victim"}:
            sent[name] = getattr(self, name)
        if "victim" in self.model_fields_set and self.victim is not None:
            for name in self.victim.model_fields_set:
                sent[f"victim.{name}"] = getattr(self.victim, name)
        return sent


class ClaimRequest(_Request):
    """``POST /api/victim/claims``: the token from the case invite email."""

    token: str = Field(min_length=1, max_length=200)


class VictimOut(BaseModel):
    name: str
    phone: str | None
    email: str | None
    address: str | None
    preferred_language: Language


class VictimCase(BaseModel):
    """What a victim sees about their own case. No owner, deadline, notes, documents or AI data."""

    id: str
    version: int
    reference: str
    bank_name: str
    status: CaseStatus
    closure_reason: ClosureReason | None
    victim: VictimOut
    amount: Money | None
    currency: str
    transfer_date: date | None
    account_number: str | None
    account_holder_name: str | None
    scam_type: ScamType | None
    description: str | None
    missing_fields: list[MissingField]
    editable_fields: list[VictimEditableField]
    submitted_at: datetime
    updated_at: datetime
