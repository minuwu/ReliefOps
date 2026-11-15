"""Staff routes for the case chat (owner: Anim; API_SPEC §6.8)."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, StringConstraints

from app.models.chat import ChatMessage, ChatThread
from app.responses import Envelope, error_responses, ok
from app.security import AnyStaffUser, SessionDep, StaffUser
from app.services import staff_chat, victim_chat

router = APIRouter(prefix="/api/cases", tags=["Case chat (staff)"])


class StaffReplyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]


@router.get(
    "/{case_id}/chat",
    response_model=Envelope[ChatThread],
    summary="Read the victim's case chat (bank viewers: own bank)",
    responses=error_responses(401, 403, 404, 422),
)
def get_chat(case_id: UUID, request: Request, who: AnyStaffUser) -> dict:
    ai_enabled = request.app.state.settings.ai_configured
    return ok(victim_chat.get_thread(who, case_id, ai_enabled=ai_enabled))


@router.post(
    "/{case_id}/chat/reply",
    status_code=201,
    response_model=Envelope[ChatMessage],
    summary="Reply to the victim in the case chat; clears victim_question_pending",
    responses=error_responses(401, 403, 404, 422),
)
def reply(case_id: UUID, data: StaffReplyRequest, who: StaffUser, s: SessionDep) -> dict:
    return ok(staff_chat.reply(s, who, case_id, data.body), "Reply sent")
