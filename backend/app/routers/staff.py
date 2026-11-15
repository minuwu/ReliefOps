"""Invitations, accepting them, the staff list and deactivation (owner: Anim; API_SPEC §6.1–6.2)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Request

from app.models.auth import User
from app.models.staff import AcceptInvitationRequest, Invitation, InvitationCreate, UserUpdate
from app.responses import Envelope, error_responses, ok
from app.security import Role, SessionDep, StaffUser, SupervisorUser
from app.services import staff
from app.services.accounts import Links

router = APIRouter(prefix="/api", tags=["staff"])


@router.post(
    "/invitations",
    status_code=201,
    response_model=Envelope[Invitation],
    summary="Invite a staff member or bank viewer (sets role and bank)",
    responses=error_responses(401, 403, 409, 422),
)
def create_invitation(data: InvitationCreate, request: Request, who: SupervisorUser, s: SessionDep) -> dict:
    links = Links(frontend_base_url=request.app.state.settings.frontend_base_url)
    return ok(staff.invite(s, who, data, links=links, now=datetime.now(UTC)), "Invitation sent")


@router.get(
    "/invitations",
    response_model=Envelope[list[Invitation]],
    summary="All invitations, newest first",
    responses=error_responses(401, 403),
)
def list_invitations(who: SupervisorUser, s: SessionDep) -> dict:
    return ok(staff.list_invitations(s, datetime.now(UTC)))


@router.post(
    "/invitations/{invitation_id}/revoke",
    response_model=Envelope[Invitation],
    summary="Revoke a pending invitation",
    responses=error_responses(401, 403, 404, 409, 422),
)
def revoke_invitation(invitation_id: UUID, who: SupervisorUser, s: SessionDep) -> dict:
    return ok(staff.revoke(s, who, invitation_id, datetime.now(UTC)), "Invitation revoked")


@router.post(
    "/auth/accept-invitation",
    response_model=Envelope[None],
    tags=["auth"],
    summary="Set a password from an invitation link; creates the account",
    responses=error_responses(400, 422),
)
def accept_invitation(data: AcceptInvitationRequest) -> dict:
    staff.accept(data)
    return ok(None, "Account created; you can log in now")


@router.get(
    "/users",
    response_model=Envelope[list[User]],
    summary="Staff list (assign-owner dropdown, user management)",
    responses=error_responses(401, 403, 422),
)
def list_users(who: StaffUser, s: SessionDep, role: Role | None = None, include_inactive: bool = False) -> dict:
    return ok(staff.list_users(s, who, role=role, include_inactive=include_inactive))


@router.patch(
    "/users/{user_id}",
    response_model=Envelope[User],
    summary="Deactivate (ends all sessions) or reactivate a user",
    responses=error_responses(401, 403, 404, 422),
)
def update_user(user_id: UUID, data: UserUpdate, who: SupervisorUser) -> dict:
    user = staff.set_active(who, user_id, data)
    return ok(user, "User deactivated" if not data.is_active else "User reactivated")
