"""Link a phone or paper case to a victim's account (owner: Asif; API_SPEC §6.3 victim-invite, §6.7 claims).

1. Staff invite: the case's victim gets an email link (valid 7 days).
2. The victim, logged in with that same verified email, claims the case.

Tokens are random (``secrets.token_urlsafe(32)``); only their SHA-256 hash is
stored, and neither the token nor the link is ever logged or audited.
``auth_tokens`` is only writable in the ``system`` scope (RLS), so checks run in
the caller's session and the token write runs with its audit entry in one
system transaction.
"""

from __future__ import annotations

import hashlib
import secrets
from collections.abc import Callable
from datetime import timedelta
from typing import Final
from uuid import UUID

from sqlalchemy import column, func, insert, select, table, update
from sqlmodel import Session

from app import db
from app.models.victim_cases import VictimCase
from app.services import audit, case_sql
from app.services.caller import Caller, is_staff
from app.services.case_sql import cases
from app.services.documents import CaseRef
from app.services.service_errors import ServiceError, forbidden, validation_error
from app.services.victim_cases import get_case as get_victim_case

CLAIM_LIFETIME: Final = timedelta(days=7)
SendEmail = Callable[[str, str, str], None]

auth_tokens = table(
    "auth_tokens", column("id"), column("purpose"), column("user_id"), column("email"), column("case_id"),
    column("token_hash"), column("created_at"), column("expires_at"), column("used_at"),
)
_users = table("users", column("id"), column("email"), column("email_verified_at"))


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def invalid_token() -> ServiceError:
    return ServiceError(400, "INVALID_TOKEN", "This link is invalid or has expired")


def invite_victim(s: Session, caller: Caller, case_id: UUID, *, send_email: SendEmail,
                  frontend_base_url: str) -> None:
    """``POST /api/cases/{id}/victim-invite`` → 200 ``data: null``. Emails a 7-day claim link."""
    if not is_staff(caller):
        raise forbidden()
    case = case_sql.require_case(s, case_id)  # 404 for a case the caller can't see
    case_sql.require_open(case)
    if not case["victim_email"]:
        raise validation_error("victim.email", "The case has no email to send the invite to")
    if case["victim_user_id"] is not None:
        raise validation_error("case", "This case is already linked to an account")
    email, reference, bank_id = case["victim_email"].strip().lower(), case["reference"], case["bank_id"]
    s.rollback()  # done reading as the caller

    token = secrets.token_urlsafe(32)
    now = case_sql.now()
    with db.system_session() as sys:
        sys.exec(update(auth_tokens)  # type: ignore[call-overload]
                 .where(auth_tokens.c.case_id == case_id, auth_tokens.c.purpose == "claim_case",
                        auth_tokens.c.used_at.is_(None), auth_tokens.c.expires_at > now)
                 .values(expires_at=now))  # an older link stops working
        sys.exec(insert(auth_tokens).values(  # type: ignore[call-overload]
            purpose="claim_case", email=email, case_id=case_id, token_hash=hash_token(token),
            created_at=now, expires_at=now + CLAIM_LIFETIME,
        ))
        audit.record(sys, action="case.victim_invited", actor=caller.actor(), case=CaseRef(case_id, bank_id),
                     summary="Victim invited to link the case to their account",
                     metadata={"sent_to_case_email": True})
        sys.commit()
    link = f"{frontend_base_url.rstrip('/')}/claim-case?token={token}"
    send_email(email, f"Your fraud relief case {reference}",
               "The operations center created a case for you.\n"
               f"Open this link within 7 days to see it in your account:\n{link}\n")


def claim_case(s: Session, caller: Caller, token: str) -> VictimCase:
    """``POST /api/victim/claims`` → 200, the linked ``VictimCase``."""
    if caller.role != "victim":
        raise forbidden("Only victims can claim a case")
    account = s.exec(  # type: ignore[call-overload]
        select(_users.c.email, _users.c.email_verified_at).where(_users.c.id == caller.user_id)
    ).first()
    if account is None or account.email_verified_at is None:
        raise ServiceError(403, "EMAIL_NOT_VERIFIED", "Verify your email first")
    s.rollback()

    now = case_sql.now()
    with db.system_session() as sys:
        row = sys.exec(  # type: ignore[call-overload]
            select(auth_tokens.c.id, auth_tokens.c.email, auth_tokens.c.case_id)
            .where(auth_tokens.c.token_hash == hash_token(token), auth_tokens.c.purpose == "claim_case",
                   auth_tokens.c.used_at.is_(None), auth_tokens.c.expires_at > now)
            .with_for_update()
        ).first()
        if row is None:
            raise invalid_token()
        if row.email != account.email:
            raise forbidden("This invite was sent to a different email address")
        case = case_sql.require_case(sys, row.case_id)
        if case["victim_user_id"] is not None and case["victim_user_id"] != caller.user_id:
            raise invalid_token()
        sys.exec(update(cases).where(cases.c.id == row.case_id)  # type: ignore[call-overload]
                 .values(victim_user_id=caller.user_id, updated_at=func.now()))
        sys.exec(update(auth_tokens).where(auth_tokens.c.id == row.id).values(used_at=now))  # type: ignore[call-overload]
        audit.record(sys, action="case.claimed", actor=caller.actor(), case=CaseRef(row.case_id, case["bank_id"]),
                     summary="Victim linked the case to their account")
        sys.commit()
        case_id = row.case_id
    return get_victim_case(s, caller, case_id)
