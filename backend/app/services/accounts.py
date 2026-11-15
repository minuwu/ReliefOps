"""Victim sign-up, email verification and password reset (owner: Anim; guide §5.3, API_SPEC §6.1).

Nothing here tells a caller whether an email has an account:
- sign-up, resend and forgot-password always answer ``202`` with the same message;
- an existing account gets an "you already have an account" email instead of a new one.

Tokens are random, stored only as SHA-256 in ``auth_tokens``, and single-use: one
atomic ``UPDATE … WHERE used_at IS NULL AND expires_at > now() RETURNING`` consumes a
token, so two requests with the same token can't both succeed. Emails are sent after
the commit (no network call inside a transaction).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Final, Literal
from uuid import UUID

from sqlalchemy import text
from sqlmodel import Session

from app import db, email, rate_limit
from app.errors import ApiError
from app.models.auth import EmailRequest, ResetPasswordRequest, SignupRequest, TokenRequest
from app.security import hash_password, hash_token, new_token
from app.services import audit
from app.services.auth import revoke_all_sessions

Purpose = Literal["verify_email", "reset_password"]
LIFETIME: Final[dict[str, timedelta]] = {"verify_email": timedelta(hours=24), "reset_password": timedelta(hours=1)}


@dataclass(frozen=True, slots=True)
class Links:
    """Where links in emails point (``FRONTEND_BASE_URL``)."""

    frontend_base_url: str

    def to(self, path: str, token: str) -> str:
        return f"{self.frontend_base_url.rstrip('/')}/{path}?token={token}"


def invalid_token() -> ApiError:
    return ApiError(400, "INVALID_TOKEN", "This link is invalid or has expired; request a new one")


def _limit(action: str, client_ip: str, address: str) -> None:
    keys = (f"{action}:ip:{client_ip}", f"{action}:email:{address}")
    rate_limit.enforce(rate_limit.email_requests, keys)
    for key in keys:
        rate_limit.email_requests.hit(key)


def _issue_token(s: Session, purpose: Purpose, user_id: UUID) -> str:
    """A new token for this user and purpose; any older unused one stops working."""
    s.exec(  # type: ignore[call-overload]
        text(
            "update auth_tokens set expires_at = now() "
            "where user_id = :user_id and purpose = :purpose and used_at is null and expires_at > now()"
        ),
        params={"user_id": user_id, "purpose": purpose},
    )
    token = new_token()
    s.exec(  # type: ignore[call-overload]
        text(
            "insert into auth_tokens (purpose, user_id, token_hash, expires_at) "
            "values (:purpose, :user_id, :token_hash, now() + :lifetime)"
        ),
        params={"purpose": purpose, "user_id": user_id, "token_hash": hash_token(token), "lifetime": LIFETIME[purpose]},
    )
    return token


def _consume_token(s: Session, purpose: Purpose, token: str) -> UUID:
    """Mark the token used and return its user, or raise ``400 INVALID_TOKEN``."""
    user_id = s.exec(  # type: ignore[call-overload]
        text(
            "update auth_tokens set used_at = now() "
            "where token_hash = :token_hash and purpose = :purpose and used_at is null and expires_at > now() "
            "returning user_id"
        ),
        params={"token_hash": hash_token(token), "purpose": purpose},
    ).scalar_one_or_none()
    if user_id is None:
        raise invalid_token()
    return user_id


def _victim_actor(user_id: UUID, name: str) -> audit.Actor:
    return audit.Actor(type="victim", id=user_id, name=name, role="victim")


def signup(data: SignupRequest, *, client_ip: str, links: Links) -> None:
    _limit("signup", client_ip, data.email)
    with db.system_session() as s:
        new_id = s.exec(  # type: ignore[call-overload]
            text(
                "insert into users (email, name, password_hash, role) values (:email, :name, :password_hash, 'victim') "
                "on conflict (email) do nothing returning id"
            ),
            params={"email": data.email, "name": data.name, "password_hash": hash_password(data.password)},
        ).scalar_one_or_none()
        token = None
        if new_id is not None:
            token = _issue_token(s, "verify_email", new_id)
            audit.record(s, action="auth.signup", actor=_victim_actor(new_id, data.name), summary="Victim signed up")
        s.commit()

    if token is None:
        email.send(
            data.email,
            "You already have an account",
            "Someone tried to sign up with this email address, which already has an account.\n"
            f"If it was you, log in, or reset your password here:\n{links.frontend_base_url.rstrip('/')}"
            "/forgot-password\nIf it wasn't you, you can ignore this email.\n",
        )
        return
    email.send(
        data.email,
        "Verify your email address",
        f"Welcome, {data.name}.\nOpen this link within 24 hours to verify your email address:\n"
        f"{links.to('verify-email', token)}\n",
    )


def verify_email(data: TokenRequest) -> None:
    with db.system_session() as s:
        user_id = _consume_token(s, "verify_email", data.token)
        row = (
            s.exec(  # type: ignore[call-overload]
                text(
                    "update users set email_verified_at = coalesce(email_verified_at, now()), updated_at = now() "
                    "where id = :id returning name"
                ),
                params={"id": user_id},
            )
            .mappings()
            .one()
        )
        audit.record(
            s, action="auth.email_verified", actor=_victim_actor(user_id, row["name"]), summary="Email verified"
        )
        s.commit()


def resend_verification(data: EmailRequest, *, client_ip: str, links: Links) -> None:
    _limit("resend", client_ip, data.email)
    with db.system_session() as s:
        row = (
            s.exec(  # type: ignore[call-overload]
                text(
                    "select id, name from users where email = :email and role = 'victim' "
                    "and email_verified_at is null and is_active"
                ),
                params={"email": data.email},
            )
            .mappings()
            .first()
        )
        token = _issue_token(s, "verify_email", row["id"]) if row is not None else None
        s.commit()
    if token is not None:
        email.send(
            data.email,
            "Verify your email address",
            f"Open this link within 24 hours to verify your email address:\n{links.to('verify-email', token)}\n",
        )


def forgot_password(data: EmailRequest, *, client_ip: str, links: Links) -> None:
    _limit("forgot", client_ip, data.email)
    with db.system_session() as s:
        row = (
            s.exec(  # type: ignore[call-overload]
                text("select id from users where email = :email and is_active"), params={"email": data.email}
            )
            .mappings()
            .first()
        )
        token = _issue_token(s, "reset_password", row["id"]) if row is not None else None
        s.commit()
    if token is not None:
        email.send(
            data.email,
            "Reset your password",
            "Open this link within 1 hour to choose a new password:\n"
            f"{links.to('reset-password', token)}\n"
            "If you didn't ask for this, you can ignore this email; your password stays the same.\n",
        )


def reset_password(data: ResetPasswordRequest) -> None:
    with db.system_session() as s:
        user_id = _consume_token(s, "reset_password", data.token)
        # The link proves the person reads this mailbox, so it also counts as verifying the email.
        row = (
            s.exec(  # type: ignore[call-overload]
                text(
                    "update users set password_hash = :password_hash, updated_at = now(), "
                    "email_verified_at = coalesce(email_verified_at, now()) "
                    "where id = :id and is_active returning id, name, role, bank_id"
                ),
                params={"id": user_id, "password_hash": hash_password(data.new_password)},
            )
            .mappings()
            .first()
        )
        if row is None:  # deactivated since the link was sent; the rollback keeps the token unused
            raise invalid_token()
        revoke_all_sessions(s, user_id)
        actor = audit.Actor(
            type="victim" if row["role"] == "victim" else "user", id=user_id, name=row["name"], role=row["role"]
        )
        audit.record(s, action="auth.password_reset", actor=actor, summary="Password reset", bank_id=row["bank_id"])
        s.commit()
