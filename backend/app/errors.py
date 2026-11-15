"""Turn every error into the contract's error envelope (owner: Anim; API_SPEC §1.1–1.2).

``ApiError`` is Asif's ``ServiceError``: routers and services raise the same type,
``ApiError(status, code, message, details)``. One handler per error family:

- ``ApiError``                → its status and code; ``429`` adds ``Retry-After``
- request validation          → ``422 VALIDATION_ERROR`` with ``details.fields``, or
                                ``400 BAD_REQUEST`` when the body isn't valid JSON
- Starlette ``HTTPException`` → the status with a contract code (unknown route → 404)

Unexpected exceptions become ``500 INTERNAL_ERROR`` in ``app.middleware``, so the
response still passes through CORS and the request log.
"""

from __future__ import annotations

from typing import Any, Final

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.services.service_errors import ServiceError

ApiError = ServiceError

_HTTP_CODES: Final[dict[int, str]] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "RESOURCE_NOT_FOUND",
    405: "BAD_REQUEST",
    413: "FILE_TOO_LARGE",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
}
_LOCATION_PREFIXES: Final = frozenset({"body", "query", "path", "header", "cookie"})


def error_response(
    status: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    body = {"success": False, "error": {"code": code, "message": message, "details": details or {}}}
    return JSONResponse(status_code=status, content=body, headers=headers)


def _field_name(loc: tuple[Any, ...]) -> str:
    parts = list(loc[1:] if loc and loc[0] in _LOCATION_PREFIXES else loc)
    return ".".join(str(part) for part in parts) or "body"


def _message(error: dict[str, Any]) -> str:
    if error.get("type") == "extra_forbidden":
        return "Unknown field"
    if error.get("type") == "missing":
        return "Field required"
    return str(error.get("msg", "Invalid value")).removeprefix("Value error, ")


async def _api_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ServiceError)
    headers = None
    if exc.status == 429 and "retry_after" in exc.details:
        headers = {"Retry-After": str(max(1, int(exc.details["retry_after"])))}
    return error_response(exc.status, exc.code, exc.message, exc.details, headers)


async def _validation_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    errors = list(exc.errors())
    if any(error.get("type") == "json_invalid" for error in errors):
        return error_response(400, "BAD_REQUEST", "Request body is not valid JSON")
    fields = [{"field": _field_name(tuple(error.get("loc", ()))), "message": _message(error)} for error in errors]
    return error_response(422, "VALIDATION_ERROR", "Request has invalid fields", {"fields": fields})


async def _http_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code = _HTTP_CODES.get(exc.status_code, "INTERNAL_ERROR" if exc.status_code >= 500 else "BAD_REQUEST")
    message = "Not found" if exc.status_code == 404 else str(exc.detail)
    return error_response(exc.status_code, code, message, headers=getattr(exc, "headers", None))


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ServiceError, _api_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
