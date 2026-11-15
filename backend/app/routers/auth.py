"""Auth routes (owner: Anim; API_SPEC §6.1). HTTP only; the rules are in ``services.auth``."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.models.auth import LoginRequest, LoginResult, User
from app.responses import Envelope, error_responses, ok
from app.security import CurrentPrincipal
from app.services import auth

router = APIRouter(prefix="/api/auth", tags=["auth"])


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.post(
    "/login",
    response_model=Envelope[LoginResult],
    summary="Log in (staff and victims)",
    responses=error_responses(401, 403, 422, 429),
)
def login(data: LoginRequest, request: Request) -> dict:
    settings = request.app.state.settings
    result = auth.login(data, client_ip=client_ip(request), session_hours=settings.session_hours)
    return ok(result, "Login successful")


@router.get("/me", response_model=Envelope[User], summary="The logged-in account", responses=error_responses(401))
def me(who: CurrentPrincipal) -> dict:
    return ok(auth.current_user(who))


@router.post(
    "/logout", response_model=Envelope[None], summary="End the current session", responses=error_responses(401)
)
def logout(who: CurrentPrincipal) -> dict:
    auth.logout(who)
    return ok(None, "Logged out")
