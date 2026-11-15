"""One log line per request, a request ID, and the 500 envelope (owner: Anim; guide §4.4 rule 10).

Pure ASGI (not ``BaseHTTPMiddleware``) so streaming responses and background
tasks behave normally. The log line holds the request ID, method, route
template, status, duration and user ID. Never the query string, headers or
body, so tokens, email links and personal data stay out of the logs.

The auth dependency stores the caller's ID with ``request.state.user_id = ...``.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Final

from starlette.types import ASGIApp, Message, Receive, Scope, Send

log = logging.getLogger("app.request")

REQUEST_ID_HEADER: Final = b"x-request-id"
_SAFE_ID_CHARS: Final = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_")
_INTERNAL_ERROR: Final = json.dumps(
    {"success": False, "error": {"code": "INTERNAL_ERROR", "message": "Unexpected server error", "details": {}}}
).encode()


def _request_id(scope: Scope) -> str:
    """Reuse a well-formed incoming ID (from a proxy), otherwise make one."""
    for name, value in scope.get("headers", []):
        if name == REQUEST_ID_HEADER:
            candidate = value.decode("latin-1")
            if 8 <= len(candidate) <= 64 and set(candidate) <= _SAFE_ID_CHARS:
                return candidate
    return uuid.uuid4().hex


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _request_id(scope)
        state = scope.setdefault("state", {})
        state["request_id"] = request_id
        started = time.perf_counter()
        status = 500
        response_started = False

        async def send_with_id(message: Message) -> None:
            nonlocal status, response_started
            if message["type"] == "http.response.start":
                status = message["status"]
                response_started = True
                message["headers"] = [*message.get("headers", []), (REQUEST_ID_HEADER, request_id.encode())]
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception:
            log.exception("unhandled error request_id=%s", request_id)
            if response_started:
                raise
            await send_with_id(
                {
                    "type": "http.response.start",
                    "status": 500,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"content-length", str(len(_INTERNAL_ERROR)).encode()),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": _INTERNAL_ERROR})
        finally:
            route = scope.get("route")
            path = getattr(route, "path", None) or "<unmatched>"
            log.info(
                "request id=%s method=%s route=%s status=%s duration_ms=%.1f user_id=%s",
                request_id,
                scope["method"],
                path,
                status,
                (time.perf_counter() - started) * 1000,
                state.get("user_id") or "-",
            )
