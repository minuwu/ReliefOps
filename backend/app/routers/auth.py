"""Auth routes (owner: Anim; API_SPEC §6.1). HTTP only; the rules are in ``services.auth``."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.models.auth import (
    EmailRequest,
    LoginRequest,
    LoginResult,
    ResetPasswordRequest,
    SignupRequest,
    TokenRequest,
    User,
)
from app.responses import Envelope, error_responses, ok
from app.security import CurrentPrincipal
from app.services import accounts, auth

router = APIRouter(prefix="/api/auth", tags=["auth"])

CHECK_EMAIL = "If the details are right, we've sent an email. Check your inbox."


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def links(request: Request) -> accounts.Links:
    return accounts.Links(frontend_base_url=request.app.state.settings.frontend_base_url)


@router.post(
    "/signup",
    status_code=202,
    response_model=Envelope[None],
    summary="Victim sign-up (always the same 202)",
    responses=error_responses(422, 429),
)
def signup(data: SignupRequest, request: Request) -> dict:
    accounts.signup(data, client_ip=client_ip(request), links=links(request))
    return ok(None, CHECK_EMAIL)


@router.post(
    "/verify-email",
    response_model=Envelope[None],
    summary="Verify an email address with the emailed token",
    responses=error_responses(400, 422),
)
def verify_email(data: TokenRequest) -> dict:
    accounts.verify_email(data)
    return ok(None, "Email verified; you can log in now")


@router.post(
    "/resend-verification",
    status_code=202,
    response_model=Envelope[None],
    summary="Send a new verification link (always 202)",
    responses=error_responses(422, 429),
)
def resend_verification(data: EmailRequest, request: Request) -> dict:
    accounts.resend_verification(data, client_ip=client_ip(request), links=links(request))
    return ok(None, CHECK_EMAIL)


@router.post(
    "/forgot-password",
    status_code=202,
    response_model=Envelope[None],
    summary="Email a password reset link (always 202)",
    responses=error_responses(422, 429),
)
def forgot_password(data: EmailRequest, request: Request) -> dict:
    accounts.forgot_password(data, client_ip=client_ip(request), links=links(request))
    return ok(None, CHECK_EMAIL)


@router.post(
    "/reset-password",
    response_model=Envelope[None],
    summary="Set a new password with the emailed token; ends all sessions",
    responses=error_responses(400, 422),
)
def reset_password(data: ResetPasswordRequest) -> dict:
    accounts.reset_password(data)
    return ok(None, "Password changed; log in with your new password")


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
