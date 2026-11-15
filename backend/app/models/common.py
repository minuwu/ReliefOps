"""Types shared by request and response schemas, matching API_SPEC §3.4 and §1 (owner: Asif).

``Money`` is a ``Decimal`` in Python and a JSON **number** on the wire (never a
string), as the contract requires. Anim's ``responses.py`` can re-export it.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated, Literal

from pydantic import Field, PlainSerializer, StringConstraints

Money = Annotated[
    Decimal,
    Field(ge=0, max_digits=14, decimal_places=2),
    PlainSerializer(float, return_type=float, when_used="json"),
]

BankId = Literal["bank_a", "bank_b", "bank_c", "bank_d", "bank_e"]
Language = Literal["en", "ja", "bn"]
CaseStatus = Literal["received", "verified", "account_check", "notice_published", "payout_review", "closed"]
ClosureReason = Literal["paid_out", "rejected", "withdrawn"]
ScamType = Literal["phishing", "impersonation", "investment", "romance", "lottery_prize", "job_offer", "other"]
IntakeChannel = Literal["web_form", "phone", "paper"]
DocumentType = Literal["intake_form", "transfer_receipt", "bank_statement", "police_report", "id_document", "other"]
MissingField = Literal["victim_contact", "amount", "transfer_date", "account_number", "scam_type", "document"]
ExtractableField = Literal[
    "victim_name", "victim_phone", "victim_email", "amount", "currency",
    "transfer_date", "account_number", "account_holder_name", "scam_type",
]
ExtractionStatus = Literal["pending_review", "accepted", "rejected", "failed"]
ReviewLane = Literal["standard", "low_confidence"]

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Phone = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\+?[0-9][0-9 ()-]{5,30}$")]
Email = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_lower=True, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
]
Currency = Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")]
AccountNumber = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=34)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]
