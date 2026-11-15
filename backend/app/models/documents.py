"""Documents and AI extractions: tables and API schemas (owner: Asif; API_SPEC §4, §6.5)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, LargeBinary, String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlmodel import Field, SQLModel

from app.models.common import DocumentType, ExtractableField, ExtractionStatus, ReviewLane

# ------------------------------------------------------------------ tables (migration 001)


class DocumentRow(SQLModel, table=True):
    __tablename__ = "documents"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    case_id: UUID
    bank_id: str
    filename: str
    doc_type: str
    mime_type: str
    size_bytes: int
    sha256: str
    uploaded_by: UUID
    uploaded_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))


class DocumentContentRow(SQLModel, table=True):
    """The file bytes, 1:1 with documents, loaded only for downloads and extraction (D10)."""

    __tablename__ = "document_contents"

    document_id: UUID = Field(primary_key=True)
    bank_id: str
    content: bytes = Field(sa_column=Column(LargeBinary, nullable=False))


class ExtractionRow(SQLModel, table=True):
    __tablename__ = "ai_extractions"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    document_id: UUID
    case_id: UUID
    bank_id: str
    status: str
    source: str
    model: str | None = None
    prompt_version: str | None = None
    overall_confidence: Decimal | None = None
    review_lane: str | None = None
    fields: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSONB, nullable=False))
    missing_fields: list[str] = Field(default_factory=list, sa_column=Column(ARRAY(String), nullable=False))
    error: dict[str, Any] | None = Field(default=None, sa_column=Column(JSONB))
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    review_note: str | None = None


# ------------------------------------------------------------------ API schemas


class UserRef(BaseModel):
    id: str
    name: str


class ExtractionBrief(BaseModel):
    id: str
    status: ExtractionStatus
    overall_confidence: float | None
    review_lane: ReviewLane | None


class DocumentMeta(BaseModel):
    id: str
    case_id: str
    filename: str
    doc_type: DocumentType
    mime_type: str
    size_bytes: int
    uploaded_by: UserRef
    uploaded_at: datetime
    latest_extraction: ExtractionBrief | None


class ExtractedField(BaseModel):
    name: ExtractableField
    value: str | float | int | None
    confidence: float
    evidence: str | None
    current_case_value: str | float | int | None
    final_value: str | float | int | None


class ExtractionError(BaseModel):
    reason: str
    message: str


class Extraction(BaseModel):
    id: str
    document_id: str
    case_id: str
    case_reference: str
    bank_id: str
    status: ExtractionStatus
    source: str
    model: str | None
    prompt_version: str | None
    overall_confidence: float | None
    review_lane: ReviewLane | None
    fields: list[ExtractedField]
    missing_fields: list[ExtractableField]
    error: ExtractionError | None
    created_at: datetime
    reviewed_by: UserRef | None
    reviewed_at: datetime | None
    review_note: str | None


class DownloadedFile(BaseModel):
    filename: str
    mime_type: str
    content: bytes
    headers: dict[str, str]
