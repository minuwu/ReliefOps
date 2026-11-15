"""The success envelope and shared response types (owner: Anim; API_SPEC §1.1, guide §4.3).

Routers return ``ok(data, message)`` and declare ``response_model=Envelope[T]`` so
Swagger shows the real shape. Errors never go through here: raise ``ApiError``.
"""

from __future__ import annotations

from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, Field

from app.models.common import Money, Page, PageParams

__all__ = ["Envelope", "ErrorBody", "ErrorEnvelope", "Money", "Page", "PageParams", "error_responses", "ok"]

T = TypeVar("T")


class Envelope(BaseModel, Generic[T]):
    success: Literal[True] = True
    data: T
    message: str = "ok"


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorEnvelope(BaseModel):
    success: Literal[False] = False
    error: ErrorBody


def ok(data: Any, message: str = "ok") -> dict[str, Any]:
    """``{"success": true, "data": data, "message": message}``."""
    return {"success": True, "data": data, "message": message}


_ERROR_DESCRIPTIONS = {
    400: "Malformed body or invalid token",
    401: "Missing, invalid or expired token",
    403: "Your role can't do this",
    404: "Not found, or it belongs to another bank or victim",
    409: "Conflicts with the current state",
    413: "File too large",
    422: "Validation error",
    429: "Too many attempts; see Retry-After",
}


def error_responses(*statuses: int) -> dict[int | str, dict[str, Any]]:
    """OpenAPI ``responses=`` entries for these error statuses, all using the error envelope."""
    return {status: {"model": ErrorEnvelope, "description": _ERROR_DESCRIPTIONS[status]} for status in statuses}
