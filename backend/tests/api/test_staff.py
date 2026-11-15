"""N12: invitations, accepting them, the staff list and deactivation over HTTP."""

from __future__ import annotations

from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text

from app import email
from app.config import Settings
from app.security import hash_token
from app.seed import user_id

from .contract import validate

Login = Callable[[str], dict[str, str]]
PASSWORD = "an-invited-password"


@pytest.fixture(scope="module")
def owner(settings: Settings) -> Iterator[Engine]:
    engine = create_engine(settings.migrations_database_url)
    yield engine
    engine.dispose()


def _address(label: str) -> str:
    return f"{label}-{uuid4().hex[:8]}@staff.test"


def invite(client: TestClient, login_as: Login, **body: Any):  # noqa: ANN201
    payload = {"email": _address("invitee"), "name": "New Staff", "role": "operator"} | body
    return client.post("/api/invitations", headers=login_as("supervisor"), json=payload)


def accept(client: TestClient, address: str, password: str = PASSWORD):  # noqa: ANN201
    token = email.outbox.last_token(address)
    return client.post("/api/auth/accept-invitation", json={"token": token, "password": password})


def login(client: TestClient, address: str, password: str = PASSWORD):  # noqa: ANN201
    return client.post("/api/auth/login", json={"email": address, "password": password})


# ------------------------------------------------------------------ invite and accept


def test_invited_bank_viewer_joins_and_sees_only_their_bank(client: TestClient, login_as: Login) -> None:
    address = _address("viewer-c")
    r = invite(client, login_as, email=address, name="Cobalt Viewer", role="bank_viewer", bank_id="bank_c")
    assert r.status_code == 201, r.text
    validate(r.json(), "InvitationResponse")
    invitation = r.json()["data"]
    assert (invitation["status"], invitation["role"], invitation["bank_id"]) == ("pending", "bank_viewer", "bank_c")
    assert invitation["invited_by"]["name"] == "Supervisor Sato"
    assert "http://frontend.test/accept-invitation?token=" in email.outbox.last(address).body

    assert accept(client, address).status_code == 200
    user = login(client, address).json()["data"]["user"]
    assert (user["role"], user["bank_id"], user["email_verified"]) == ("bank_viewer", "bank_c", True)
    headers = {"Authorization": f"Bearer {login(client, address).json()['data']['token']}"}
    cases = client.get("/api/cases", headers=headers, params={"page_size": 100}).json()["data"]["items"]
    assert cases and {c["bank_id"] for c in cases} == {"bank_c"}

    again = client.post(
        "/api/auth/accept-invitation", json={"token": email.outbox.last_token(address), "password": PASSWORD}
    )
    assert again.json()["error"]["code"] == "INVALID_TOKEN"
    listed = client.get("/api/invitations", headers=login_as("supervisor")).json()["data"]
    assert next(i for i in listed if i["id"] == invitation["id"])["status"] == "accepted"


def test_bank_rules_and_conflicts(client: TestClient, login_as: Login) -> None:
    no_bank = invite(client, login_as, role="bank_viewer")
    assert no_bank.status_code == 422 and no_bank.json()["error"]["details"]["fields"][0]["field"] == "bank_id"
    assert invite(client, login_as, role="operator", bank_id="bank_a").status_code == 422
    existing = invite(client, login_as, email="operator1@opscenter.test")
    assert (existing.status_code, existing.json()["error"]["code"]) == (409, "BAD_REQUEST")
    address = _address("twice")
    assert invite(client, login_as, email=address).status_code == 201
    assert invite(client, login_as, email=address).status_code == 409
    assert invite(client, login_as, role="victim").status_code == 422
    assert invite(client, login_as, password="x").status_code == 422


def test_only_supervisors_manage_invitations(client: TestClient, login_as: Login) -> None:
    body = {"email": _address("x"), "name": "X", "role": "operator"}
    for who in ("operator", "viewer_a", "victim1"):
        assert client.post("/api/invitations", headers=login_as(who), json=body).status_code == 403
        assert client.get("/api/invitations", headers=login_as(who)).status_code == 403


def test_revoke_only_pending_and_a_revoked_link_stops_working(client: TestClient, login_as: Login) -> None:
    address = _address("revoke")
    invitation = invite(client, login_as, email=address).json()["data"]
    url = f"/api/invitations/{invitation['id']}/revoke"
    r = client.post(url, headers=login_as("supervisor"))
    assert r.status_code == 200 and r.json()["data"]["status"] == "revoked"
    validate(r.json(), "InvitationResponse")
    again = client.post(url, headers=login_as("supervisor"))
    assert again.status_code == 409
    assert again.json()["error"]["details"] == {"from": "revoked", "to": "revoked", "allowed": []}
    assert accept(client, address).json()["error"]["code"] == "INVALID_TOKEN"
    assert client.post(f"/api/invitations/{uuid4()}/revoke", headers=login_as("supervisor")).status_code == 404


def test_an_expired_invitation_reads_expired_and_frees_the_email(
    client: TestClient, login_as: Login, owner: Engine
) -> None:
    address = _address("expired")
    with owner.begin() as conn:
        conn.execute(text("select set_config('app.role', 'system', true)"))
        old_id = conn.execute(
            text(
                "insert into invitations (email, name, role, token_hash, invited_by, created_at, expires_at) "
                "values (:email, 'Late Person', 'operator', :hash, :by, :created, :expires) returning id"
            ),
            {
                "email": address,
                "hash": hash_token(uuid4().hex),
                "by": user_id("supervisor@opscenter.test"),
                "created": datetime.now(UTC) - timedelta(days=4),
                "expires": datetime.now(UTC) - timedelta(days=1),
            },
        ).scalar_one()
    listed = client.get("/api/invitations", headers=login_as("supervisor")).json()["data"]
    assert next(i for i in listed if i["id"] == str(old_id))["status"] == "expired"
    late = client.post(f"/api/invitations/{old_id}/revoke", headers=login_as("supervisor"))
    assert late.status_code == 409 and late.json()["error"]["details"]["from"] == "expired"
    assert invite(client, login_as, email=address).status_code == 201


# ------------------------------------------------------------------ users


def test_users_list_for_the_assign_dropdown(client: TestClient, login_as: Login) -> None:
    r = client.get("/api/users", headers=login_as("operator"), params={"role": "operator"})
    assert r.status_code == 200
    validate(r.json(), "UserListResponse")
    users = r.json()["data"]
    assert {"Operator One", "Operator Two"} <= {u["name"] for u in users}
    assert {u["role"] for u in users} == {"operator"} and all(u["is_active"] for u in users)
    assert client.get("/api/users", headers=login_as("victim1")).status_code == 403
    assert client.get("/api/users", headers=login_as("viewer_a")).status_code == 403


def test_deactivation_ends_sessions_and_blocks_login_until_reactivated(client: TestClient, login_as: Login) -> None:
    address = _address("leaver")
    invite(client, login_as, email=address)
    accept(client, address)
    token = login(client, address).json()["data"]["token"]
    target = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["data"]["id"]

    off = client.patch(f"/api/users/{target}", headers=login_as("supervisor"), json={"is_active": False})
    assert off.status_code == 200 and off.json()["data"]["is_active"] is False
    validate(off.json(), "UserResponse")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    assert login(client, address).json()["error"]["code"] == "INVALID_CREDENTIALS"

    operator_view = client.get("/api/users", headers=login_as("operator"), params={"include_inactive": True})
    assert target not in {u["id"] for u in operator_view.json()["data"]}  # ignored for operators
    supervisor_view = client.get("/api/users", headers=login_as("supervisor"), params={"include_inactive": True})
    assert target in {u["id"] for u in supervisor_view.json()["data"]}

    on = client.patch(f"/api/users/{target}", headers=login_as("supervisor"), json={"is_active": True})
    assert on.json()["data"]["is_active"] is True
    assert login(client, address).status_code == 200


def test_who_may_deactivate(client: TestClient, login_as: Login) -> None:
    me = client.get("/api/auth/me", headers=login_as("supervisor")).json()["data"]["id"]
    own = client.patch(f"/api/users/{me}", headers=login_as("supervisor"), json={"is_active": False})
    assert own.status_code == 422
    other = str(user_id("operator2@opscenter.test"))
    assert (
        client.patch(f"/api/users/{other}", headers=login_as("operator"), json={"is_active": False}).status_code == 403
    )
    assert (
        client.patch(f"/api/users/{uuid4()}", headers=login_as("supervisor"), json={"is_active": False}).status_code
        == 404
    )
    assert (
        client.patch(f"/api/users/{other}", headers=login_as("supervisor"), json={"role": "supervisor"}).status_code
        == 422
    )
