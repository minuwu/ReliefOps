"""Change a case's status, or its owner (owner: Anim; API_SPEC §3.2, §6.3; XREQ-001).

``transition`` applies the rules in ``case_workflow`` and then Asif's atomic
``case_sql.update_case`` (``WHERE version = :expected``), so a stale or concurrent
change gets ``409 STALE_CASE``. ``assign`` has no ``expected_version`` in the contract,
so it bumps the version without checking it, the way a counter would.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import text
from sqlmodel import Session

from app.errors import ApiError
from app.models.cases import AssignRequest, Case, TransitionRequest
from app.security import Principal
from app.services import audit, case_sql, case_workflow
from app.services.case_edits import CaseKey, check_assignee
from app.services.cases import load_case

STATUS_LABELS = {
    "received": "Received",
    "verified": "Verified",
    "account_check": "Account Check",
    "notice_published": "Notice Published",
    "payout_review": "Payout Review",
    "closed": "Closed",
}


def transition(s: Session, who: Principal, case_id: UUID, data: TransitionRequest, now: datetime) -> Case:
    """``POST /api/cases/{id}/transition``."""
    case = case_sql.require_case(s, case_id)  # 404 if not visible
    case_sql.require_open(case)
    case_sql.check_version(case, data.expected_version)
    req = case_workflow.Transition(
        to_status=data.to_status,
        note=data.note,
        closure_reason=data.closure_reason,
        payout_amount=data.payout_amount,
    )
    case_workflow.check_transition(case, who, req)
    case_sql.update_case(s, case_id, data.expected_version, case_workflow.transition_values(req, now))

    changes: dict[str, dict[str, object]] = {"status": {"from": case["status"], "to": data.to_status}}
    if data.closure_reason is not None:
        changes["closure_reason"] = {"from": None, "to": data.closure_reason}
    if data.payout_amount is not None:
        changes["payout_amount"] = {"from": None, "to": data.payout_amount}
    summary = f"Status {STATUS_LABELS[case['status']]} → {STATUS_LABELS[data.to_status]}"
    if data.closure_reason:
        summary += f" ({data.closure_reason})"
    audit.record(
        s,
        action="case.status_changed",
        actor=who.actor(),
        summary=summary,
        case=CaseKey(case_id, case["bank_id"]),
        changes=changes,
        metadata={"note": data.note} if data.note else None,
    )
    s.commit()
    return load_case(s, who, case_id, now)


def _operator_name(s: Session, operator_id: UUID | None) -> str | None:
    if operator_id is None:
        return None
    return s.exec(text("select name from users where id = :id"), params={"id": operator_id}).scalar_one_or_none()  # type: ignore[call-overload]


def assign(s: Session, who: Principal, case_id: UUID, data: AssignRequest, now: datetime) -> Case:
    """``POST /api/cases/{id}/assign``: operators only themselves (or unassign their own case), supervisors anyone."""
    case = case_sql.require_case(s, case_id)
    case_sql.require_open(case)
    current, target = case["assigned_operator_id"], data.operator_id
    if who.role == "operator" and target is None and current not in (None, who.user_id):
        raise ApiError(403, "FORBIDDEN", "Operators can unassign only their own cases")
    check_assignee(s, who, target, "operator_id")
    if current == target:
        s.rollback()
        return load_case(s, who, case_id, now)

    s.exec(  # type: ignore[call-overload]
        text(
            "update cases set assigned_operator_id = :target, version = version + 1, updated_at = now() where id = :id"
        ),
        params={"target": target, "id": case_id},
    )
    before, after = _operator_name(s, current), _operator_name(s, target)
    audit.record(
        s,
        action="case.assigned",
        actor=who.actor(),
        summary=f"Assigned to {after}" if after else "Unassigned",
        case=CaseKey(case_id, case["bank_id"]),
        changes={"assigned_operator": {"from": before, "to": after}},
        metadata={"from_id": current, "to_id": target},
    )
    s.commit()
    return load_case(s, who, case_id, now)
