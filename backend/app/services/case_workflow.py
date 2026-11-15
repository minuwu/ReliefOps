"""The case lifecycle rules (owner: Anim; API_SPEC §3.1–3.3, guide §4.3).

Pure functions over a case row (a ``RowMapping`` or a dict with the ``cases`` columns)
and the caller (anything with a ``role``), so they need no database and are reused by
the cases service, Asif's review and victim edits, and the tests.

    received → verified → account_check → notice_published → payout_review → closed

- **Forward** one step from any open status.
- **Back** one step, with a ``note``.
- **Close** from any open status, with a ``note`` and a ``closure_reason``:
  ``withdrawn`` (operator or supervisor), ``rejected`` (supervisor), ``paid_out``
  (supervisor, only from ``payout_review``, with ``payout_amount``).
- Leaving ``received`` forward needs every §3.3 field (``422 MISSING_REQUIRED_INFO``).
- ``closed`` is final: every change returns ``409 CASE_CLOSED``.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Final, Protocol

from app.errors import ApiError
from app.services import case_sql

OPEN_FLOW: Final = ("received", "verified", "account_check", "notice_published", "payout_review")
CLOSURE_REASONS: Final = ("paid_out", "rejected", "withdrawn")
SUPERVISOR_ONLY_REASONS: Final = frozenset({"paid_out", "rejected"})
STAFF_ROLES: Final = frozenset({"operator", "supervisor"})
DUE_SOON_FRACTION: Final = 0.2
DUE_SOON_MINIMUM: Final = timedelta(days=1)


class HasRole(Protocol):
    @property
    def role(self) -> str: ...


@dataclass(frozen=True, slots=True)
class Transition:
    to_status: str
    note: str | None = None
    closure_reason: str | None = None
    payout_amount: Decimal | None = None


def _neighbours(status: str) -> tuple[str | None, str | None]:
    index = OPEN_FLOW.index(status)
    forward = OPEN_FLOW[index + 1] if index + 1 < len(OPEN_FLOW) else None
    back = OPEN_FLOW[index - 1] if index > 0 else None
    return forward, back


def allowed_transitions(case: Mapping[str, Any], who: HasRole) -> list[str]:
    """What this user may move the case to right now, in button order: forward, back, closed."""
    if case["status"] == "closed" or who.role not in STAFF_ROLES:
        return []
    forward, back = _neighbours(case["status"])
    return [status for status in (forward, back) if status is not None] + ["closed"]


def allowed_closure_reasons(case: Mapping[str, Any], who: HasRole) -> list[str]:
    """Closure reasons this user may pick now; empty unless ``closed`` is allowed."""
    if "closed" not in allowed_transitions(case, who):
        return []
    if who.role != "supervisor":
        return ["withdrawn"]
    return [r for r in CLOSURE_REASONS if r != "paid_out" or case["status"] == "payout_review"]


def missing_fields(case: Mapping[str, Any]) -> list[str]:
    return case_sql.missing_fields(dict(case))


def deadline_state(case: Mapping[str, Any], now: datetime) -> str:
    """``none`` when closed; ``overdue`` past the deadline; ``due_soon`` in the stage's last 20% (≥ 1 day)."""
    if case["status"] == "closed":
        return "none"
    deadline = case.get("deadline")
    if deadline is None:
        return "on_track"
    if now >= deadline:
        return "overdue"
    stage = deadline - (case.get("status_changed_at") or deadline)
    warning = max(stage * DUE_SOON_FRACTION, DUE_SOON_MINIMUM)
    return "due_soon" if deadline - now <= warning else "on_track"


def _invalid(case: Mapping[str, Any], to_status: str, who: HasRole) -> ApiError:
    return ApiError(
        409,
        "INVALID_STATUS_TRANSITION",
        f"A case can't move from {case['status']} to {to_status}",
        {"from": case["status"], "to": to_status, "allowed": allowed_transitions(case, who)},
    )


def _field_error(field: str, message: str) -> ApiError:
    return ApiError(
        422, "VALIDATION_ERROR", "Request has invalid fields", {"fields": [{"field": field, "message": message}]}
    )


def _check_closure(case: Mapping[str, Any], who: HasRole, req: Transition) -> None:
    if req.closure_reason is None:
        raise _field_error("closure_reason", "Required when closing a case")
    if req.closure_reason in SUPERVISOR_ONLY_REASONS and who.role != "supervisor":
        raise ApiError(403, "FORBIDDEN", "Only a supervisor can close a case as paid_out or rejected")
    if req.closure_reason == "paid_out":
        if case["status"] != "payout_review":
            raise _invalid(case, "closed", who)
        if req.payout_amount is None:
            raise _field_error("payout_amount", "Required with closure_reason paid_out")
    elif req.payout_amount is not None:
        raise _field_error("payout_amount", "Only allowed with closure_reason paid_out")


def check_transition(case: Mapping[str, Any], who: HasRole, req: Transition) -> None:
    """Raise the contract's error if this change isn't allowed; return quietly if it is."""
    if case["status"] == "closed":
        raise ApiError(409, "CASE_CLOSED", "This case is closed and can't be changed")
    if who.role not in STAFF_ROLES:
        raise ApiError(403, "FORBIDDEN", "Your role can't change a case's status")
    forward, back = _neighbours(case["status"])
    if req.to_status not in (forward, back, "closed"):
        raise _invalid(case, req.to_status, who)

    needs_note = req.to_status in (back, "closed")
    if needs_note and not (req.note and req.note.strip()):
        reason = "closing a case" if req.to_status == "closed" else "moving a case back a step"
        raise _field_error("note", f"Required when {reason}")
    if req.to_status == "closed":
        _check_closure(case, who, req)
        return
    if req.closure_reason is not None or req.payout_amount is not None:
        field = "closure_reason" if req.closure_reason is not None else "payout_amount"
        raise _field_error(field, "Only allowed when closing a case")
    if case["status"] == "received" and req.to_status == forward and (missing := missing_fields(case)):
        raise ApiError(
            422,
            "MISSING_REQUIRED_INFO",
            "This case needs more information before it can leave Received",
            {"missing_fields": missing},
        )


def transition_values(req: Transition, now: datetime) -> dict[str, Any]:
    """The column changes for an allowed transition (the version bump is ``case_sql.update_case``'s job)."""
    closing = req.to_status == "closed"
    return {
        "status": req.to_status,
        "status_changed_at": now,
        "deadline": None if closing else case_sql.deadline_for(req.to_status, now),
        "closure_reason": req.closure_reason if closing else None,
        "payout_amount": req.payout_amount if closing else None,
        "closed_at": now if closing else None,
    }
