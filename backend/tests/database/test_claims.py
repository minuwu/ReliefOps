"""app/services/claims.py: inviting a victim to claim a phone or paper case (API_SPEC §6.3, §6.7)."""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import Engine, text

from app import db
from app.services import case_sql, claims
from app.services.caller import StaticCaller
from app.services.service_errors import ServiceError

from .conftest import insert_case, insert_user, set_scope

BASE_URL = "https://app.example.test"


class Outbox:
    def __init__(self) -> None:
        self.sent: list[tuple[str, str, str]] = []

    def __call__(self, to: str, subject: str, body: str) -> None:
        self.sent.append((to, subject, body))

    def last_token(self) -> str:
        match = re.search(r"claim-case\?token=([A-Za-z0-9_-]+)", self.sent[-1][2])
        assert match, self.sent[-1][2]
        return match.group(1)


def fresh_victim(owner_engine: Engine) -> StaticCaller:
    """A new verified victim, so these tests never change the shared world victims."""
    email = f"claimer-{uuid4().hex[:10]}@test.test"
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        user_id = insert_user(conn, email, "victim")
    return StaticCaller(user_id=UUID(user_id), name=email, role="victim")


def phone_case(owner_engine: Engine, email: str | None = "nobody@test.test", **columns: object) -> UUID:
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        return UUID(insert_case(conn, "bank_c", victim_email=email, **columns))


def invite(caller, case_id: UUID, outbox: Outbox) -> None:  # noqa: ANN001
    with db.scoped_session(caller.scope()) as s:
        claims.invite_victim(s, caller, case_id, send_email=outbox, frontend_base_url=BASE_URL)


def claim(caller, token: str):  # noqa: ANN001, ANN201
    with db.scoped_session(caller.scope()) as s:
        return claims.claim_case(s, caller, token)


def test_invite_then_claim_links_the_case(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    victim = fresh_victim(owner_engine)
    case_id = phone_case(owner_engine, victim.name)
    outbox = Outbox()
    invite(callers["operator"], case_id, outbox)
    to, subject, body = outbox.sent[0]
    assert to == victim.name and "RFR-" in subject and body.count(BASE_URL + "/claim-case?token=") == 1
    token = outbox.last_token()
    with db.system_session() as s:
        stored = s.exec(text("select token_hash, expires_at - created_at as life from auth_tokens "
                             "where case_id = :id").bindparams(id=case_id)).mappings().one()
        audit_text = " ".join(str(r) for r in s.exec(text("select summary, metadata from audit_log "
                                                          "where case_id = :id").bindparams(id=case_id)).all())
    assert stored["token_hash"] == claims.hash_token(token) and token not in stored["token_hash"]
    assert stored["life"] == timedelta(days=7)
    assert token not in audit_text  # the link is never audited

    linked = claim(victim, token)
    assert linked.id == str(case_id) and linked.status == "received"
    with db.system_session() as s:
        case = case_sql.require_case(s, case_id)
        actions = s.exec(text("select action from audit_log where case_id = :id order by at")
                         .bindparams(id=case_id)).scalars().all()
    assert case["victim_user_id"] == victim.user_id
    # Claim and view can share a timestamp; SQL does not order equal timestamps.
    assert [action for action in actions if action != "case.viewed"] == ["case.victim_invited", "case.claimed"]


def test_a_link_works_once(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    victim, outbox = fresh_victim(owner_engine), Outbox()
    invite(callers["operator"], phone_case(owner_engine, victim.name), outbox)
    claim(victim, outbox.last_token())
    with pytest.raises(ServiceError) as caught:
        claim(victim, outbox.last_token())
    assert (caught.value.status, caught.value.code) == (400, "INVALID_TOKEN")


def test_a_new_invite_cancels_the_old_link(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    victim, outbox = fresh_victim(owner_engine), Outbox()
    case_id = phone_case(owner_engine, victim.name)
    invite(callers["operator"], case_id, outbox)
    old = outbox.last_token()
    invite(callers["supervisor"], case_id, outbox)
    with pytest.raises(ServiceError) as caught:
        claim(victim, old)
    assert caught.value.code == "INVALID_TOKEN"
    assert claim(victim, outbox.last_token()).id == str(case_id)


def test_expired_and_made_up_links_are_invalid(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    victim, outbox = fresh_victim(owner_engine), Outbox()
    case_id = phone_case(owner_engine, victim.name)
    invite(callers["operator"], case_id, outbox)
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        conn.exec_driver_sql("update auth_tokens set expires_at = %s, created_at = %s where case_id = %s",
                             (datetime.now(UTC) - timedelta(minutes=1), datetime.now(UTC) - timedelta(days=8), case_id))
    for token in (outbox.last_token(), "made-up-token"):
        with pytest.raises(ServiceError) as caught:
            claim(victim, token)
        assert caught.value.code == "INVALID_TOKEN"


def test_only_the_invited_email_can_claim(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    invited, other, outbox = fresh_victim(owner_engine), fresh_victim(owner_engine), Outbox()
    invite(callers["operator"], phone_case(owner_engine, invited.name), outbox)
    with pytest.raises(ServiceError) as caught:
        claim(other, outbox.last_token())  # logged in as someone else
    assert caught.value.status == 403


def test_unverified_victims_cannot_claim(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        user_id = insert_user(conn, "unverified@test.test", "victim")
        conn.exec_driver_sql("update users set email_verified_at = null where id = %s", (user_id,))
    caller = StaticCaller(user_id=UUID(user_id), name="unverified", role="victim")
    with pytest.raises(ServiceError) as caught:
        claim(caller, "anything")
    assert caught.value.code == "EMAIL_NOT_VERIFIED"


@pytest.mark.parametrize(
    ("who", "email", "columns", "status"),
    [
        ("viewer_a", "victim1@test.test", {}, 403),
        ("victim1", "victim1@test.test", {}, 403),
        ("operator", None, {}, 422),
        ("operator", "victim1@test.test", {"status": "closed", "closed_at": "2026-11-10T00:00:00Z",
                                           "closure_reason": "withdrawn"}, 409),
    ],
    ids=["viewer", "victim", "no_email", "closed"],
)
def test_invite_refusals(app_db: Engine, owner_engine: Engine, callers: dict, who: str, email: str | None,
                         columns: dict, status: int) -> None:
    case_id = phone_case(owner_engine, email, **columns)
    outbox = Outbox()
    with pytest.raises(ServiceError) as caught:
        invite(callers[who], case_id, outbox)
    assert caught.value.status == status and outbox.sent == []


def test_invite_for_a_linked_or_unknown_case(app_db: Engine, owner_engine: Engine, callers: dict,
                                             world: dict[str, str]) -> None:
    linked = phone_case(owner_engine, victim_user_id=str(fresh_victim(owner_engine).user_id))
    with pytest.raises(ServiceError) as caught:
        invite(callers["operator"], linked, Outbox())
    assert caught.value.status == 422
    with pytest.raises(ServiceError) as caught:
        invite(callers["operator"], uuid4(), Outbox())
    assert caught.value.status == 404


def test_staff_cannot_claim(app_db: Engine, callers: dict) -> None:
    with pytest.raises(ServiceError) as caught:
        claim(callers["operator"], "token")
    assert caught.value.status == 403
