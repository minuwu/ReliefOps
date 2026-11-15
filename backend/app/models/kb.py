"""Bluebook (knowledge base) schemas (owner: Anim; API_SPEC §4 KbDocument, §6.8)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models.common import BankId, Language
from app.models.documents import UserRef

KbDocumentStatus = Literal["processing", "ready", "published", "archived", "failed"]
KbAudience = Literal["victim_facing", "staff_only"]


class KbDocument(BaseModel):
    id: str
    bank_id: BankId
    bank_name: str
    title: str
    version: str
    language: Language
    status: KbDocumentStatus
    audience: KbAudience
    passage_count: int | None
    error: str | None
    uploaded_by: UserRef
    uploaded_at: datetime
    published_at: datetime | None
