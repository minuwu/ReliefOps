"""N2: passwords, session tokens, Principal, role dependencies and the caller-scoped session."""

from __future__ import annotations

import logging
from collections.abc import Iterator
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app import db, security
from app.config import Settings
from app.main import create_app
from app.security import AnyStaffUser, CurrentPrincipal, SessionDep, StaffUser, SupervisorUser, VictimUser

from .conftest import _test_url, insert_case, set_scope

PASSWORD = "a-long-test-password"


def _settings() -> Settings:
    return Settings(  # type: ignore[call-arg]
        _env_file=None, app_env="test", database_url=_test_url("TEST_DATABASE_URL"), email_mode="outbox"
    )


def _add_probe_routes(app: FastAPI) -> None:
    @app.get("/probe/me")
    def me(who: CurrentPrincipal) -> dict:
        return {"role": who.role, "bank_id": who.bank_id}

    @app.get("/probe/staff")
    def staff(who: StaffUser) -> dict:
        return {"role": who.role}

    @app.get("/probe/any-staff")
    def any_staff(who: AnyStaffUser) -> dict:
        return {"role": who.role}

    @app.get("/probe/supervisor")
    def supervisor(who: SupervisorUser) -> dict:
        return {"role": who.role}

    @app.get("/probe/victim")
    def victim(who: VictimUser) -> dict:
        return {"role": who.role}

    @app.get("/probe/visible-banks")
    def visible_banks(who: AnyStaffUser, s: SessionDep) -> dict:
        rows = s.exec(text("select distinct bank_id from cases order by bank_id")).all()  # type: ignore[call-overload]
        return {"banks": [row[0] for row in rows]}


@pytest.fixture(scope="module")
def client(migrated: object, world: dict[str, str]) -> Iterator[TestClient]:
    app = create_app(_settings())
    _add_probe_routes(app)
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def accounts(owner_engine: Engine, client: TestClient) -> dict[str, dict[str, str]]:
    """Real accounts with real argon2 hashes, one per role, plus edge cases."""
    password_hash = security.hash_password(PASSWORD)
    specs = {
        "operator": ("operator", None, True, True),
        "supervisor": ("supervisor", None, True, True),
        "viewer_a": ("bank_viewer", "bank_a", True, True),
        "victim": ("victim", None, True, True),
        "unverified_victim": ("victim", None, False, True),
        "inactive_operator": ("operator", None, True, False),
    }
    made: dict[str, dict[str, str]] = {}
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        for key, (role, bank, verified, active) in specs.items():
            email = f"{key}-{uuid4().hex[:8]}@sec.test"
            user_id = conn.exec_driver_sql(
                "insert into users (email, name, password_hash, role, bank_id, email_verified_at, is_active) "
                "values (%s, %s, %s, %s, %s, case when %s then now() end, %s) returning id::text",
                (email, key.replace("_", " ").title(), password_hash, role, bank, verified, active),
            ).scalar_one()
            made[key] = {"id": user_id, "email": email}
    with db.system_session() as s:
        for account in made.values():
            account["token"] = security.issue_session(s, UUID(account["id"]), hours=1).token
        s.commit()
    return made


def _auth(accounts: dict[str, dict[str, str]], key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {accounts[key]['token']}"}


# ------------------------------------------------------------------ passwords and tokens


def test_password_hash_round_trip_and_rejects_wrong_or_malformed() -> None:
    hashed = security.hash_password(PASSWORD)
    assert hashed.startswith("$argon2id$")
    assert security.verify_password(PASSWORD, hashed)
    assert not security.verify_password("wrong-password!", hashed)
    assert not security.verify_password(PASSWORD, "not-a-real-hash")
    assert not security.verify_password(PASSWORD, None)


def test_tokens_are_random_and_stored_only_as_sha256() -> None:
    first, second = security.new_token(), security.new_token()
    assert first != second and len(first) >= 43
    assert len(security.hash_token(first)) == 64
    assert security.hash_token(first) == security.hash_token(first)


def test_principal_scope_and_actor_match_the_role() -> None:
    base = {"name": "X", "email": "x@sec.test", "email_verified": True, "session_id": uuid4(), "user_id": uuid4()}
    viewer = security.Principal(role="bank_viewer", bank_id="bank_b", **base)
    assert viewer.scope() == db.Scope(role="bank_viewer", user_id=base["user_id"], bank_id="bank_b")
    victim = security.Principal(role="victim", bank_id=None, **base)
    assert victim.actor().type == "victim"
    assert security.Principal(role="operator", bank_id=None, **base).actor().type == "user"


# ------------------------------------------------------------------ session lookup


def test_live_session_resolves_to_the_account(accounts: dict[str, dict[str, str]]) -> None:
    who = security.principal_for_token(accounts["viewer_a"]["token"])
    assert who is not None
    assert (str(who.user_id), who.role, who.bank_id) == (accounts["viewer_a"]["id"], "bank_viewer", "bank_a")


def test_unknown_oversized_expired_and_revoked_tokens_resolve_to_nobody(
    accounts: dict[str, dict[str, str]], owner_engine: Engine
) -> None:
    assert security.principal_for_token("made-up-token") is None
    assert security.principal_for_token("x" * 500) is None
    with db.system_session() as s:
        expired = security.issue_session(s, UUID(accounts["operator"]["id"]), hours=1).token
        revoked = security.issue_session(s, UUID(accounts["operator"]["id"]), hours=1).token
        s.commit()
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        conn.exec_driver_sql(
            "update sessions set created_at = now() - interval '2 hours', expires_at = now() - interval '1 minute' "
            "where token_hash = %s",
            (security.hash_token(expired),),
        )
        conn.exec_driver_sql(
            "update sessions set revoked_at = now() where token_hash = %s", (security.hash_token(revoked),)
        )
    assert security.principal_for_token(expired) is None
    assert security.principal_for_token(revoked) is None


def test_deactivated_account_resolves_to_nobody(accounts: dict[str, dict[str, str]]) -> None:
    assert security.principal_for_token(accounts["inactive_operator"]["token"]) is None


# ------------------------------------------------------------------ HTTP dependencies


def test_no_token_or_a_bad_token_is_401(client: TestClient) -> None:
    for headers in ({}, {"Authorization": "Bearer nope"}, {"Authorization": "Basic abc"}):
        r = client.get("/probe/me", headers=headers)
        assert r.status_code == 401, headers
        assert r.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.parametrize(
    ("route", "who", "status"),
    [
        ("/probe/staff", "operator", 200),
        ("/probe/staff", "supervisor", 200),
        ("/probe/staff", "viewer_a", 403),
        ("/probe/staff", "victim", 403),
        ("/probe/any-staff", "viewer_a", 200),
        ("/probe/any-staff", "victim", 403),
        ("/probe/supervisor", "operator", 403),
        ("/probe/supervisor", "supervisor", 200),
        ("/probe/victim", "victim", 200),
        ("/probe/victim", "operator", 403),
        ("/probe/victim", "inactive_operator", 401),
    ],
)
def test_role_dependencies(
    client: TestClient, accounts: dict[str, dict[str, str]], route: str, who: str, status: int
) -> None:
    r = client.get(route, headers=_auth(accounts, who))
    assert r.status_code == status, r.text
    if status == 403:
        assert r.json()["error"]["code"] == "FORBIDDEN"


def test_unverified_victim_gets_email_not_verified(client: TestClient, accounts: dict[str, dict[str, str]]) -> None:
    r = client.get("/probe/victim", headers=_auth(accounts, "unverified_victim"))
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "EMAIL_NOT_VERIFIED"


def test_session_dependency_applies_the_callers_bank_scope(
    client: TestClient, accounts: dict[str, dict[str, str]], owner_engine: Engine
) -> None:
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        insert_case(conn, "bank_c")
    assert client.get("/probe/visible-banks", headers=_auth(accounts, "viewer_a")).json()["banks"] == ["bank_a"]
    operator_banks = client.get("/probe/visible-banks", headers=_auth(accounts, "operator")).json()["banks"]
    assert {"bank_a", "bank_b", "bank_c"} <= set(operator_banks)


def test_request_log_records_the_user_id(
    client: TestClient, accounts: dict[str, dict[str, str]], caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="app.request"):
        client.get("/probe/me", headers=_auth(accounts, "operator"))
    lines = [rec.getMessage() for rec in caplog.records if rec.name == "app.request"]
    assert any(f"user_id={accounts['operator']['id']}" in line for line in lines)
    assert all(accounts["operator"]["token"] not in line for line in lines)


def test_victim_chat_routes_are_mounted_behind_real_auth(
    client: TestClient, accounts: dict[str, dict[str, str]]
) -> None:
    case_id = uuid4()
    assert client.get(f"/api/victim/cases/{case_id}/chat").status_code == 401
    assert client.get(f"/api/victim/cases/{case_id}/chat", headers=_auth(accounts, "operator")).status_code == 403
    assert client.get(f"/api/victim/cases/{case_id}/chat", headers=_auth(accounts, "victim")).status_code == 404
