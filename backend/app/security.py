"""Passwords, session tokens and who is calling (owner: Anim; guide §4.3 and §5).

Sessions are opaque random tokens, not JWTs. Only their SHA-256 hash is stored.
Every request looks the token up in ``sessions`` joined to ``users`` (one indexed
read in the ``system`` scope, since the caller's scope is only known afterwards),
so logout, password reset and deactivation take effect on the very next request.

Routers declare who may call them with one parameter::

    def list_cases(who: AnyStaffUser, s: SessionDep): ...

``SessionDep`` is a session scoped to the caller (row-level security applies).
It closes right after the handler returns; services commit before returning.
"""

from __future__ import annotations

import hashlib
import secrets
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated, Final, Literal
from uuid import UUID

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from sqlalchemy import text
from sqlmodel import Session

from app import db
from app.errors import ApiError
from app.services.audit import Actor

Role = Literal["operator", "supervisor", "bank_viewer", "victim"]
STAFF_ROLES: Final[frozenset[str]] = frozenset({"operator", "supervisor"})
ANY_STAFF_ROLES: Final[frozenset[str]] = frozenset({"operator", "supervisor", "bank_viewer"})

PASSWORD_MIN: Final = 10
PASSWORD_MAX: Final = 128
_MAX_TOKEN_LENGTH: Final = 200

_hasher = PasswordHash((Argon2Hasher(),))
# Verified when the email is unknown, so a login takes as long whether or not the account exists.
_DUMMY_HASH: Final = _hasher.hash("timing-equaliser-not-a-password")

_bearer = HTTPBearer(scheme_name="bearerAuth", auto_error=False)


# ------------------------------------------------------------------ passwords and tokens


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    """Constant-time-ish: always runs one argon2 verification, even for an unknown account."""
    if not password_hash:
        _hasher.verify(password, _DUMMY_HASH)
        return False
    try:
        return _hasher.verify(password, password_hash)
    except Exception:  # a malformed stored hash counts as a wrong password, never a 500
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ------------------------------------------------------------------ who is calling


@dataclass(frozen=True, slots=True)
class Principal:
    """The logged-in account. Satisfies Asif's ``services.caller.Caller`` protocol."""

    user_id: UUID
    name: str
    email: str
    role: Role
    bank_id: str | None
    email_verified: bool
    session_id: UUID

    def scope(self) -> db.Scope:
        return db.Scope(
            role=self.role, user_id=self.user_id, bank_id=self.bank_id if self.role == "bank_viewer" else None
        )

    def actor(self) -> Actor:
        return Actor(
            type="victim" if self.role == "victim" else "user", id=self.user_id, name=self.name, role=self.role
        )


@dataclass(frozen=True, slots=True)
class IssuedSession:
    token: str
    expires_at: datetime


def issue_session(s: Session, user_id: UUID, hours: int) -> IssuedSession:
    """Insert a session row (call in ``system_session()``; the caller commits). Returns the plaintext token once."""
    token = new_token()
    expires_at = datetime.now(UTC) + timedelta(hours=hours)
    s.exec(  # type: ignore[call-overload]
        text("insert into sessions (user_id, token_hash, expires_at) values (:user_id, :token_hash, :expires_at)"),
        params={"user_id": user_id, "token_hash": hash_token(token), "expires_at": expires_at},
    )
    return IssuedSession(token=token, expires_at=expires_at)


_LOOKUP_SQL: Final = text(
    """
    select s.id as session_id, u.id as user_id, u.name, u.email, u.role, u.bank_id,
           u.email_verified_at is not null as email_verified
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = :token_hash and s.revoked_at is null and s.expires_at > now() and u.is_active
    """
)


def principal_for_token(token: str) -> Principal | None:
    """The account behind a live session token, or None (unknown, expired, revoked, or user deactivated)."""
    if not token or len(token) > _MAX_TOKEN_LENGTH:
        return None
    with db.system_session() as s:
        row = s.exec(_LOOKUP_SQL, params={"token_hash": hash_token(token)}).mappings().first()  # type: ignore[call-overload]
    if row is None:
        return None
    return Principal(
        user_id=row["user_id"],
        name=row["name"],
        email=row["email"],
        role=row["role"],
        bank_id=row["bank_id"],
        email_verified=row["email_verified"],
        session_id=row["session_id"],
    )


def unauthorized(message: str = "Log in to continue") -> ApiError:
    return ApiError(401, "UNAUTHORIZED", message)


def get_principal(
    request: Request, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> Principal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized()
    who = principal_for_token(credentials.credentials)
    if who is None:
        raise unauthorized("Your session has expired or is invalid; log in again")
    request.state.user_id = str(who.user_id)  # for the request log
    return who


CurrentPrincipal = Annotated[Principal, Depends(get_principal)]


def require_roles(*roles: Role) -> Callable[[Principal], Principal]:
    """A dependency that lets only these roles through (others get ``403 FORBIDDEN``)."""
    allowed = frozenset(roles)

    def dependency(who: CurrentPrincipal) -> Principal:
        if who.role not in allowed:
            raise ApiError(403, "FORBIDDEN", "Your role can't do this")
        return who

    return dependency


def _verified_victim(who: CurrentPrincipal) -> Principal:
    if who.role != "victim":
        raise ApiError(403, "FORBIDDEN", "A victim account is required")
    if not who.email_verified:
        raise ApiError(403, "EMAIL_NOT_VERIFIED", "Verify your email address first")
    return who


StaffUser = Annotated[Principal, Depends(require_roles("operator", "supervisor"))]
AnyStaffUser = Annotated[Principal, Depends(require_roles("operator", "supervisor", "bank_viewer"))]
SupervisorUser = Annotated[Principal, Depends(require_roles("supervisor"))]
VictimUser = Annotated[Principal, Depends(_verified_victim)]


# ------------------------------------------------------------------ database session for the caller


def get_session(who: CurrentPrincipal) -> Iterator[Session]:
    yield from db.session_for(who.scope())


# scope="function": the session closes as soon as the handler returns, before the response is sent.
SessionDep = Annotated[Session, Depends(get_session, scope="function")]
