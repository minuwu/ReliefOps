"""Public chat types, matching API_SPEC v0.4.2 (owner: Asif)."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.models.common import Language
from app.models.documents import UserRef

AnswerType = Literal["grounded", "passages_only", "no_answer", "refused"]


class ChatQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
    language: Language | None = Field(default=None, json_schema_extra=lambda schema: schema.update(
        type="string", enum=["en", "ja", "bn"], description="Omit to use the victim's preferred language."))

    @model_validator(mode="before")
    @classmethod
    def no_explicit_null_language(cls, value):
        if isinstance(value, dict) and "language" in value and value["language"] is None:
            raise ValueError("Omit language to use the account preference; null is not a language")
        return value


class ChatFeedback(BaseModel):
    model_config = ConfigDict(extra="forbid")
    feedback: Literal["helpful", "not_helpful"]


class Citation(BaseModel):
    document_id: str
    document_title: str
    version: str
    section: str | None
    page: int | None = Field(ge=1)
    quote: str


class ChatMessage(BaseModel):
    id: str
    role: Literal["victim", "assistant", "staff"]
    body: str
    language: Language
    created_at: datetime
    author: UserRef | None
    answer_type: AnswerType | None
    citations: list[Citation]
    confidence: float | None = Field(ge=0, le=1)
    needs_staff: bool
    feedback: Literal["helpful", "not_helpful"] | None


class ChatThread(BaseModel):
    case_reference: str
    messages: list[ChatMessage]
    victim_question_pending: bool
    assistant_available: bool


class ChatExchange(BaseModel):
    question: ChatMessage
    answer: ChatMessage
