"""Staff invitations, accepting them, the staff list and deactivation (owner: Anim; guide §5.3, API_SPEC §6.1–6.2).

Staff and bank viewers never sign up: a supervisor invites them and sets their role
(and bank). The invitee sets a password through the emailed 72-hour link, which also
counts as verifying the email. Deactivating a user ends all their sessions at once.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Final
from uuid import UUID

from sqlalchemy import RowMapping, text
from sqlmodel import Session

from app import db, email
from app.errors import ApiError
from app.models.auth import User
from app.models.documents import UserRef
from app.models.staff import AcceptInvitationRequest, Invitation, InvitationCreate, UserUpdate
from app.security import Principal, hash_password, hash_token, new_token
from app.services import audit
from app.services.accounts import Links, invalid_token
from app.services.auth import revoke_all_sessions

INVITATION_LIFETIME: Final = timedelta(hours=72)
_SELECT: Final = "select i.*, u.name as invited_by_name from invitations i left join users u on u.id = i.invited_by"


def _field_error(field: str, message: str) -> ApiError:
    return ApiError(
        422, "VALIDATION_ERROR", "Request has invalid fields", {"fields": [{"field": field, "message": message}]}
    )


def _status(row: RowMapping, now: datetime) -> str:
    return "expired" if row["status"] == "pending" and row["expires_at"] <= now else row["status"]


def _invitation(row: RowMapping, now: datetime) -> Invitation:
    return Invitation(
        id=str(row["id"]),
        email=row["email"],
        name=row["name"],
        role=row["role"],
        bank_id=row["bank_id"],
        status=_status(row, now),  # type: ignore[arg-type]
        invited_by=UserRef(id=str(row["invited_by"]), name=row["invited_by_name"] or "Unknown"),
        created_at=row["created_at"],
        expires_at=row["expires_at"],
    )


def invite(s: Session, who: Principal, data: InvitationCreate, *, links: Links, now: datetime) -> Invitation:
    """``POST /api/invitations`` → 201. The caller is a supervisor (checked by the route)."""
    if data.role == "bank_viewer" and data.bank_id is None:
        raise _field_error("bank_id", "Required for a bank_viewer")
    if data.role != "bank_viewer" and data.bank_id is not None:
        raise _field_error("bank_id", "Must be empty for operators and supervisors")

    taken = s.exec(  # type: ignore[call-overload]
        text(
            "select 1 from users where email = :email "
            "union all select 1 from invitations where email = :email and status = 'pending' and expires_at > :now"
        ),
        params={"email": data.email, "now": now},
    ).first()
    if taken is not None:
        raise ApiError(409, "BAD_REQUEST", "This email already has an account or a pending invitation")
    # A pending invitation that ran out frees the email (one pending invitation per email in the database).
    s.exec(  # type: ignore[call-overload]
        text("update invitations set status = 'expired' where email = :email and status = 'pending'"),
        params={"email": data.email},
    )
    token = new_token()
    invitation_id = s.exec(  # type: ignore[call-overload]
        text(
            "insert into invitations (email, name, role, bank_id, token_hash, invited_by, created_at, expires_at) "
            "values (:email, :name, :role, :bank_id, :token_hash, :invited_by, :now, :expires_at) returning id"
        ),
        params={
            "email": data.email,
            "name": data.name,
            "role": data.role,
            "bank_id": data.bank_id,
            "token_hash": hash_token(token),
            "invited_by": who.user_id,
            "now": now,
            "expires_at": now + INVITATION_LIFETIME,
        },
    ).scalar_one()
    audit.record(
        s,
        action="user.invited",
        actor=who.actor(),
        summary=f"Invited {data.name} as {data.role}",
        bank_id=data.bank_id,
        metadata={"invitation_id": invitation_id, "role": data.role},
    )
    s.commit()
    row = s.exec(text(f"{_SELECT} where i.id = :id"), params={"id": invitation_id}).mappings().one()  # type: ignore[call-overload]
    s.rollback()

    email.send(
        data.email,
        "You're invited to the fraud relief operations center",
        f"Hello {data.name},\n{who.name} invited you to join as {data.role.replace('_', ' ')}.\n"
        f"Open this link within 72 hours to set your password:\n{links.to('accept-invitation', token)}\n",
    )
    return _invitation(row, now)


def list_invitations(s: Session, now: datetime) -> list[Invitation]:
    rows = s.exec(text(f"{_SELECT} order by i.created_at desc, i.id")).mappings().all()  # type: ignore[call-overload]
    s.rollback()
    return [_invitation(row, now) for row in rows]


def revoke(s: Session, who: Principal, invitation_id: UUID, now: datetime) -> Invitation:
    row = (
        s.exec(  # type: ignore[call-overload]
            text(f"{_SELECT} where i.id = :id for update of i"), params={"id": invitation_id}
        )
        .mappings()
        .first()
    )
    if row is None:
        raise ApiError(404, "RESOURCE_NOT_FOUND", "Invitation not found")
    current = _status(row, now)
    if current != "pending":
        raise ApiError(
            409,
            "INVALID_STATUS_TRANSITION",
            f"Only a pending invitation can be revoked; this one is {current}",
            {"from": current, "to": "revoked", "allowed": []},
        )
    s.exec(  # type: ignore[call-overload]
        text("update invitations set status = 'revoked', revoked_at = :now where id = :id"),
        params={"id": invitation_id, "now": now},
    )
    audit.record(
        s,
        action="user.invitation_revoked",
        actor=who.actor(),
        summary=f"Invitation for {row['name']} revoked",
        bank_id=row["bank_id"],
        metadata={"invitation_id": invitation_id},
    )
    s.commit()
    updated = s.exec(text(f"{_SELECT} where i.id = :id"), params={"id": invitation_id}).mappings().one()  # type: ignore[call-overload]
    s.rollback()
    return _invitation(updated, now)


def accept(data: AcceptInvitationRequest) -> None:
    """``POST /api/auth/accept-invitation``: create the account with the invited role and bank (email verified)."""
    with db.system_session() as s:
        row = (
            s.exec(  # type: ignore[call-overload]
                text(
                    "select * from invitations where token_hash = :token_hash and status = 'pending' "
                    "and expires_at > now() for update"
                ),
                params={"token_hash": hash_token(data.token)},
            )
            .mappings()
            .first()
        )
        if row is None:
            raise invalid_token()
        user_id = s.exec(  # type: ignore[call-overload]
            text(
                "insert into users (email, name, password_hash, role, bank_id, email_verified_at) "
                "values (:email, :name, :password_hash, :role, :bank_id, now()) "
                "on conflict (email) do nothing returning id"
            ),
            params={
                "email": row["email"],
                "name": row["name"],
                "password_hash": hash_password(data.password),
                "role": row["role"],
                "bank_id": row["bank_id"],
            },
        ).scalar_one_or_none()
        if user_id is None:  # the email got an account some other way since the invitation
            raise invalid_token()
        s.exec(  # type: ignore[call-overload]
            text(
                "update invitations set status = 'accepted', accepted_at = now(), accepted_user_id = :user_id "
                "where id = :id"
            ),
            params={"id": row["id"], "user_id": user_id},
        )
        audit.record(
            s,
            action="user.joined",
            actor=audit.Actor(type="user", id=user_id, name=row["name"], role=row["role"]),
            summary=f"{row['name']} joined as {row['role']}",
            bank_id=row["bank_id"],
            metadata={"invitation_id": row["id"]},
        )
        s.commit()


_USER_COLUMNS: Final = "id, name, email, role, bank_id, email_verified_at, is_active"


def list_users(s: Session, who: Principal, *, role: str | None, include_inactive: bool) -> list[User]:
    """``GET /api/users``: active users (supervisors may add deactivated ones), ordered by name."""
    clauses, params = [], {}
    if role:
        clauses.append("role = :role")
        params["role"] = role
    if not (include_inactive and who.role == "supervisor"):
        clauses.append("is_active")
    where = f"where {' and '.join(clauses)}" if clauses else ""
    rows = (
        s.exec(  # type: ignore[call-overload]
            text(f"select {_USER_COLUMNS} from users {where} order by name, id"), params=params
        )
        .mappings()
        .all()
    )
    s.rollback()
    return [User.from_row(row) for row in rows]


def set_active(who: Principal, user_id: UUID, data: UserUpdate) -> User:
    """``PATCH /api/users/{id}``: deactivate (ending every session at once) or reactivate. Supervisor only."""
    if user_id == who.user_id and not data.is_active:
        raise _field_error("is_active", "You can't deactivate your own account")
    with db.system_session() as s:  # sessions are system-only; the route already checked the supervisor role
        row = (
            s.exec(  # type: ignore[call-overload]
                text(f"select {_USER_COLUMNS} from users where id = :id for update"), params={"id": user_id}
            )
            .mappings()
            .first()
        )
        if row is None:
            raise ApiError(404, "RESOURCE_NOT_FOUND", "User not found")
        if row["is_active"] == data.is_active:
            return User.from_row(row)
        updated = (
            s.exec(  # type: ignore[call-overload]
                text(
                    f"update users set is_active = :active, updated_at = now() where id = :id returning {_USER_COLUMNS}"
                ),
                params={"id": user_id, "active": data.is_active},
            )
            .mappings()
            .one()
        )
        if not data.is_active:
            revoke_all_sessions(s, user_id)
        # The contract's audit actions have no "user.reactivated"; the change itself shows the direction.
        audit.record(
            s,
            action="user.deactivated",
            actor=who.actor(),
            summary=f"{row['name']} {'deactivated' if not data.is_active else 'reactivated'}",
            bank_id=row["bank_id"],
            changes={"is_active": {"from": row["is_active"], "to": data.is_active}},
            metadata={"user_id": user_id},
        )
        s.commit()
    return User.from_row(updated)
