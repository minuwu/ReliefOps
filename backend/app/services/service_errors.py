"""The one error type services raise (owner: Asif).

A service raises ``ServiceError(status, code, message, details)`` with the
contract's status and error code (API_SPEC §1.2). The HTTP layer turns it into
the error envelope ``{success: false, error: {code, message, details}}``, so
Anim's ``errors.py`` can alias it as ``ApiError`` or register one handler.
"""

from __future__ import annotations

from typing import Any


class ServiceError(Exception):
    def __init__(self, status: int, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details or {}

    def __repr__(self) -> str:
        return f"ServiceError({self.status}, {self.code!r}, {self.message!r})"


def not_found(what: str = "Case") -> ServiceError:
    """Doesn't exist and not yours look the same (D5): always 404."""
    return ServiceError(404, "RESOURCE_NOT_FOUND", f"{what} not found")


def forbidden(message: str = "Your role can't do this") -> ServiceError:
    return ServiceError(403, "FORBIDDEN", message)


def validation_error(field: str, message: str) -> ServiceError:
    return ServiceError(422, "VALIDATION_ERROR", "Request has invalid fields",
                        {"fields": [{"field": field, "message": message}]})
