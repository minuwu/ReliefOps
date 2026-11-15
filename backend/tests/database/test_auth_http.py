"""N3: login, logout, me and the login rate limit, over real HTTP on the test database."""

from __future__ import annotations

from collections.abc import Iterator
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app import rate_limit
from app.main import create_app

from .accounts import PASSWORD, app_settings, make_account
from .conftest import set_scope


@pytest.fixture(scope="module")
def client(migrated: object, world: dict[str, str]) -> Iterator[TestClient]:
    with TestClient(create_app(app_settings())) as c:
        yield c


@pytest.fixture(autouse=True)
def _fresh_limits() -> None:
    rate_limit.reset_rate_limits()


def _login(client: TestClient, email: str, password: str = PASSWORD):  # noqa: ANN202
    return client.post("/api/auth/login", json={"email": email, "password": password})


def _audit_actions(owner_engine: Engine, user_id: str) -> list[str]:
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        rows = conn.exec_driver_sql(
            "select action from audit_log where actor_id = %s order by at", (user_id,)
        ).fetchall()
    return [row[0] for row in rows]


def test_login_returns_token_expiry_and_user(client: TestClient, owner_engine: Engine) -> None:
    viewer = make_account(owner_engine, "bank_viewer", bank_id="bank_b")
    r = _login(client, viewer["email"].upper())  # emails are case-insensitive
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True and body["message"] == "Login successful"
    data = body["data"]
    assert len(data["token"]) >= 43
    assert data["expires_at"].endswith("Z")
    assert data["user"] == {
        "id": viewer["id"],
        "name": "Bank Viewer",
        "email": viewer["email"],
        "role": "bank_viewer",
        "bank_id": "bank_b",
        "email_verified": True,
        "is_active": True,
    }
    assert "password_hash" not in r.text
    assert _audit_actions(owner_engine, viewer["id"])[-1] == "auth.login"


def test_wrong_password_unknown_email_and_deactivated_all_look_the_same(
    client: TestClient, owner_engine: Engine
) -> None:
    operator = make_account(owner_engine, "operator")
    inactive = make_account(owner_engine, "operator", active=False, label="inactive")
    responses = [
        _login(client, operator["email"], "wrong-password"),
        _login(client, "nobody-here@acct.test"),
        _login(client, inactive["email"]),
    ]
    for r in responses:
        assert r.status_code == 401
        assert r.json()["error"] == {"code": "INVALID_CREDENTIALS", "message": "Wrong email or password", "details": {}}
    assert _audit_actions(owner_engine, operator["id"])[-1] == "auth.login_failed"
    assert _audit_actions(owner_engine, inactive["id"])[-1] == "auth.login_failed"


def test_unverified_victim_with_the_right_password_gets_email_not_verified(
    client: TestClient, owner_engine: Engine
) -> None:
    victim = make_account(owner_engine, "victim", verified=False)
    r = _login(client, victim["email"])
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "EMAIL_NOT_VERIFIED"
    assert _login(client, victim["email"], "wrong-password").status_code == 401  # no hint without the password


def test_me_returns_the_account_and_logout_ends_only_that_session(client: TestClient, owner_engine: Engine) -> None:
    victim = make_account(owner_engine, "victim")
    first = _login(client, victim["email"]).json()["data"]["token"]
    second = _login(client, victim["email"]).json()["data"]["token"]
    h1, h2 = {"Authorization": f"Bearer {first}"}, {"Authorization": f"Bearer {second}"}

    me = client.get("/api/auth/me", headers=h1)
    assert me.status_code == 200
    assert me.json()["data"]["id"] == victim["id"] and me.json()["data"]["role"] == "victim"

    out = client.post("/api/auth/logout", headers=h1)
    assert out.status_code == 200 and out.json() == {"success": True, "data": None, "message": "Logged out"}
    assert client.get("/api/auth/me", headers=h1).status_code == 401
    assert client.post("/api/auth/logout", headers=h1).status_code == 401
    assert client.get("/api/auth/me", headers=h2).status_code == 200
    assert "auth.logout" in _audit_actions(owner_engine, victim["id"])


def test_five_failures_then_429_with_retry_after_even_for_the_right_password(
    client: TestClient, owner_engine: Engine
) -> None:
    operator = make_account(owner_engine, "operator")
    codes = [_login(client, operator["email"], "wrong-password").status_code for _ in range(5)]
    assert codes == [401] * 5
    blocked = _login(client, operator["email"])
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "RATE_LIMITED"
    assert 1 <= int(blocked.headers["Retry-After"]) <= 15 * 60


def test_a_successful_login_clears_that_emails_failures(client: TestClient, owner_engine: Engine) -> None:
    operator = make_account(owner_engine, "operator")
    for _ in range(3):
        _login(client, operator["email"], "wrong-password")
    assert _login(client, operator["email"]).status_code == 200
    rate_limit.login_failures.reset("ip:testclient")  # keep the per-IP counter out of this check
    assert [_login(client, operator["email"], "wrong-password").status_code for _ in range(4)] == [401] * 4


def test_login_body_validation(client: TestClient) -> None:
    r = client.post("/api/auth/login", json={"email": "a@b.test", "password": "x", "role": "supervisor"})
    assert r.status_code == 422 and r.json()["error"]["details"]["fields"][0]["field"] == "role"
    assert client.post("/api/auth/login", json={"email": "a@b.test"}).status_code == 422


def test_session_expiry_follows_settings(owner_engine: Engine) -> None:
    operator = make_account(owner_engine, "operator")
    with TestClient(create_app(app_settings(session_hours=2))) as c:
        data = _login(c, operator["email"]).json()["data"]
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        hours = conn.exec_driver_sql(
            "select extract(epoch from expires_at - created_at) / 3600 from sessions where user_id = %s",
            (UUID(operator["id"]),),
        ).scalar_one()
    assert round(float(hours)) == 2 and data["token"]
