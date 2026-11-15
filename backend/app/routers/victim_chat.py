"""Mount these routes with Anim's authenticated-user dependency; no standalone auth/server."""

from collections.abc import Callable
from typing import Annotated, Any, Generic, Literal, TypeVar
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.models.chat import ChatExchange, ChatFeedback, ChatMessage, ChatQuestion, ChatThread
from app.services import victim_chat
from app.services.service_errors import ServiceError, forbidden

T = TypeVar("T")


class ChatResponse(BaseModel, Generic[T]):
    success: Literal[True] = True
    data: T
    message: str = "ok"


def create_router(authenticate: Callable, settings: victim_chat.ChatSettings = victim_chat.ChatSettings()) -> APIRouter:
    """authenticate must return the active, verified Principal (Caller protocol).

    The app registers its existing ServiceError and request-validation envelope
    handlers. No session dependency here: ask owns its short DB transactions.
    """
    router = APIRouter(prefix="/api/victim/cases", tags=["Victim chat"], responses={
        401: {"description": "Authentication required"},
        403: {"description": "Victim account required"},
        404: {"description": "Case or message not found, including another victim's case"},
        422: {"description": "Invalid request"},
    })

    def victim(who: Annotated[Any, Depends(authenticate)]):
        if who.role != "victim":
            raise forbidden("A victim account is required")
        return who

    Victim = Annotated[Any, Depends(victim)]

    @router.get("/{case_id}/chat", response_model=ChatResponse[ChatThread])
    def get_chat(case_id: UUID, who: Victim):
        return ChatResponse(data=victim_chat.get_thread(who, case_id, ai_enabled=settings.ai_enabled))

    @router.post("/{case_id}/chat/messages", status_code=201, response_model=ChatResponse[ChatExchange],
                 responses={429: {"description": "20 questions per case per hour",
                                  "headers": {"Retry-After": {"schema": {"type": "integer", "minimum": 1}}}}})
    def post_question(case_id: UUID, data: ChatQuestion, who: Victim):
        try:
            return ChatResponse(data=victim_chat.ask(who, case_id, data, settings))
        except ServiceError as exc:
            if exc.status != 429:
                raise
            return JSONResponse(status_code=429, headers={"Retry-After": str(exc.details["retry_after"])},
                                content={"success": False, "error": {"code": exc.code,
                                         "message": exc.message, "details": exc.details}})

    @router.post("/{case_id}/chat/messages/{message_id}/feedback", response_model=ChatResponse[ChatMessage])
    def post_feedback(case_id: UUID, message_id: UUID, data: ChatFeedback, who: Victim):
        return ChatResponse(data=victim_chat.feedback(who, case_id, message_id, data))

    return router
