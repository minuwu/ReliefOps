"""Login, logout and the current account (owner: Anim; guide §5, API_SPEC §6.1).

Auth tables are readable only in the ``system`` scope (migration 002), so these
functions open ``db.system_session()`` themselves; the caller's scope isn't
known until the session token has been checked.

Login rules:
- a wrong password, an unknown email and a deactivated account all get the same
  ``401 INVALID_CREDENTIALS`` (and take about as long), so nobody can test which
  emails exist or are active;
- an unverified victim with the right password gets ``403 EMAIL_NOT_VERIFIED``;
- 5 failures per IP or per email within 15 minutes → ``429`` with ``Retry-After``;
- successful and failed logins are both audited, never with the password.
"""

from __future__ import annotations

from typing import Final
from uuid import UUID

from sqlalchemy import text
from sqlmodel import Session

from app import db, rate_limit
from app.errors import ApiError
from app.models.auth import LoginRequest, LoginResult, User
from app.security import Principal, issue_session, verify_password
from app.services import audit

_USER_COLUMNS: Final = "id, name, email, password_hash, role, bank_id, email_verified_at, is_active"
_UNKNOWN_ACCOUNT: Final = audit.Actor(type="public", name="Unknown account")


def invalid_credentials() -> ApiError:
    return ApiError(401, "INVALID_CREDENTIALS", "Wrong email or password")


def _user_by_email(s: Session, email: str):  # noqa: ANN202 - a RowMapping or None
    return (
        s.exec(text(f"select {_USER_COLUMNS} from users where email = :email"), params={"email": email})  # type: ignore[call-overload]
        .mappings()
        .first()
    )


def _user_by_id(s: Session, user_id: UUID):  # noqa: ANN202
    return (
        s.exec(text(f"select {_USER_COLUMNS} from users where id = :id"), params={"id": user_id})  # type: ignore[call-overload]
        .mappings()
        .first()
    )


def _actor(row) -> audit.Actor:  # noqa: ANN001
    actor_type = "victim" if row["role"] == "victim" else "user"
    return audit.Actor(type=actor_type, id=row["id"], name=row["name"], role=row["role"])


def _record_failure(s: Session, row, reason: str, keys: tuple[str, ...]) -> None:  # noqa: ANN001
    for key in keys:
        rate_limit.login_failures.hit(key)
    audit.record(
        s,
        action="auth.login_failed",
        actor=_actor(row) if row is not None else _UNKNOWN_ACCOUNT,
        summary="Failed login",
        bank_id=row["bank_id"] if row is not None else None,
        metadata={"reason": reason},
    )
    s.commit()


def login(data: LoginRequest, *, client_ip: str, session_hours: int) -> LoginResult:
    keys = (f"ip:{client_ip}", f"email:{data.email}")
    rate_limit.enforce(rate_limit.login_failures, keys)

    with db.system_session() as s:
        row = _user_by_email(s, data.email)
        password_ok = verify_password(data.password, row["password_hash"] if row is not None else None)
        if row is None or not password_ok:
            _record_failure(s, row, "unknown_email" if row is None else "wrong_password", keys)
            raise invalid_credentials()
        if not row["is_active"]:
            _record_failure(s, row, "deactivated", keys)
            raise invalid_credentials()
        if row["role"] == "victim" and row["email_verified_at"] is None:
            raise ApiError(403, "EMAIL_NOT_VERIFIED", "Verify your email address before logging in")

        issued = issue_session(s, row["id"], session_hours)
        audit.record(s, action="auth.login", actor=_actor(row), summary="Logged in", bank_id=row["bank_id"])
        s.commit()

    rate_limit.login_failures.reset(f"email:{data.email}")
    return LoginResult(token=issued.token, expires_at=issued.expires_at, user=User.from_row(row))


def logout(who: Principal) -> None:
    with db.system_session() as s:
        s.exec(  # type: ignore[call-overload]
            text("update sessions set revoked_at = now() where id = :id and revoked_at is null"),
            params={"id": who.session_id},
        )
        audit.record(s, action="auth.logout", actor=who.actor(), summary="Logged out", bank_id=who.bank_id)
        s.commit()


def revoke_all_sessions(s: Session, user_id: UUID) -> None:
    """End every live session of a user (password reset, deactivation). The caller commits."""
    s.exec(  # type: ignore[call-overload]
        text("update sessions set revoked_at = now() where user_id = :user_id and revoked_at is null"),
        params={"user_id": user_id},
    )


def current_user(who: Principal) -> User:
    with db.system_session() as s:
        row = _user_by_id(s, who.user_id)
    if row is None:  # deleted between the token check and now; we never delete, so practically unreachable
        raise invalid_credentials()
    return User.from_row(row)
