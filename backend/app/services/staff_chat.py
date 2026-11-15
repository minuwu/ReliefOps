"""Staff side of the case assistant (owner: Anim; API_SPEC §3.6 and §6.8).

Staff read the same thread the victim sees (Asif's ``victim_chat.get_thread``) and
answer escalated questions with a ``staff`` message. Row-level security only lets a
staff session insert ``role = 'staff'`` rows under its own ``author_id``, so a reply
can never be passed off as the assistant or as another person. Replying clears the
case's ``victim_question_pending`` flag in the same transaction as the audit entry.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import insert, update
from sqlmodel import Session

from app.models.chat import ChatMessage
from app.security import Principal
from app.services import audit, case_sql
from app.services.case_edits import CaseKey
from app.services.victim_chat import _message, messages


def reply(s: Session, who: Principal, case_id: UUID, body: str) -> ChatMessage:
    """``POST /api/cases/{id}/chat/reply`` → 201. Allowed on a closed case too (staff may still answer)."""
    case = case_sql.require_case(s, case_id)  # 404 if not visible
    row = (
        s.exec(  # type: ignore[call-overload]
            insert(messages)
            .values(
                case_id=case_id,
                bank_id=case["bank_id"],
                role="staff",
                body=body,
                language=case["preferred_language"],
                author_id=who.user_id,
                author_name=who.name,
            )
            .returning(*messages.c)
        )
        .mappings()
        .one()
    )
    if case["victim_question_pending"]:
        s.exec(  # type: ignore[call-overload]
            update(case_sql.cases).where(case_sql.cases.c.id == case_id).values(victim_question_pending=False)
        )
    audit.record(
        s,
        action="chat.staff_replied",
        actor=who.actor(),
        summary="Staff replied in the case chat",
        case=CaseKey(case_id, case["bank_id"]),
        metadata={"message_id": row["id"], "cleared_pending_question": bool(case["victim_question_pending"])},
    )
    message = _message(row)
    s.commit()
    return message
