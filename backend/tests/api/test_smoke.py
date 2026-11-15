"""The guide §8.8 checks that work today, on the seeded demo data (N6)."""

from __future__ import annotations

from collections.abc import Callable

from fastapi.testclient import TestClient

from app.seed import DEMO_PASSWORD

Login = Callable[[str], dict[str, str]]


def test_health_reports_the_database_up_and_ai_off(client: TestClient) -> None:
    data = client.get("/api/health").json()["data"]
    assert (data["status"], data["db"], data["ai"]) == ("healthy", "ok", "disabled")


def test_banks_are_the_five_demo_banks(client: TestClient) -> None:
    banks = client.get("/api/banks").json()["data"]
    assert [b["id"] for b in banks] == ["bank_a", "bank_b", "bank_c", "bank_d", "bank_e"]
    assert banks[1]["name"] == "Birch Regional Bank"


def test_every_seeded_account_logs_in_as_its_role(client: TestClient, login_as: Login) -> None:
    expected = {
        "operator": ("operator", None),
        "supervisor": ("supervisor", None),
        "viewer_a": ("bank_viewer", "bank_a"),
        "viewer_b": ("bank_viewer", "bank_b"),
        "victim1": ("victim", None),
    }
    for who, (role, bank_id) in expected.items():
        me = client.get("/api/auth/me", headers=login_as(who)).json()["data"]
        assert (me["role"], me["bank_id"], me["is_active"]) == (role, bank_id, True), who


def test_unverified_demo_victim_gets_email_not_verified(client: TestClient) -> None:
    r = client.post("/api/auth/login", json={"email": "victim3@mail.test", "password": DEMO_PASSWORD})
    assert (r.status_code, r.json()["error"]["code"]) == (403, "EMAIL_NOT_VERIFIED")


def test_no_token_is_401(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401


def test_logout_then_the_same_token_is_401(client: TestClient) -> None:
    token = client.post("/api/auth/login", json={"email": "victim2@mail.test", "password": DEMO_PASSWORD}).json()
    headers = {"Authorization": f"Bearer {token['data']['token']}"}
    assert client.post("/api/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_five_wrong_passwords_then_429(client: TestClient) -> None:
    body = {"email": "operator2@opscenter.test", "password": "wrong"}
    assert [client.post("/api/auth/login", json=body).status_code for _ in range(6)] == [401] * 5 + [429]


def test_victim_chat_on_a_seeded_case_needs_the_owner(client: TestClient, login_as: Login) -> None:
    case_42 = "7f3c2a9e-5b1d-4c8e-9a10-2d6f8b4e1c33"  # owned by victim1
    assert client.get(f"/api/victim/cases/{case_42}/chat", headers=login_as("victim1")).status_code == 200
    assert client.get(f"/api/victim/cases/{case_42}/chat", headers=login_as("victim2")).status_code == 404
    assert client.get(f"/api/victim/cases/{case_42}/chat", headers=login_as("operator")).status_code == 403
