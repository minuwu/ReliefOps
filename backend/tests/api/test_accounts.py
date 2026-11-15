"""N7: sign-up, email verification, resend, forgot and reset password over HTTP."""

from __future__ import annotations

from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from fastapi.testclient import TestClient

from app import email, rate_limit
from app.seed import DEMO_PASSWORD

Login = Callable[[str], dict[str, str]]
PASSWORD = "a-long-password"


def _new_email() -> str:
    return f"new-{uuid4().hex[:10]}@mail.test"


def _signup(client: TestClient, address: str, **extra: object):  # noqa: ANN202
    return client.post("/api/auth/signup", json={"email": address, "password": PASSWORD, "name": "New Victim", **extra})


def _login(client: TestClient, address: str, password: str = PASSWORD):  # noqa: ANN202
    return client.post("/api/auth/login", json={"email": address, "password": password})


def test_signup_verify_login(client: TestClient) -> None:
    address = _new_email()
    r = _signup(client, address.upper(), preferred_language="ja")
    assert r.status_code == 202 and r.json()["data"] is None
    assert _login(client, address).json()["error"]["code"] == "EMAIL_NOT_VERIFIED"

    sent = email.outbox.last(address)
    assert sent.subject == "Verify your email address"
    assert "http://frontend.test/verify-email?token=" in sent.body
    token = email.outbox.last_token(address)
    assert client.post("/api/auth/verify-email", json={"token": token}).status_code == 200

    user = _login(client, address).json()["data"]["user"]
    assert (user["role"], user["email"], user["email_verified"]) == ("victim", address, True)
    assert client.post("/api/auth/verify-email", json={"token": token}).json()["error"]["code"] == "INVALID_TOKEN"


def test_signup_cannot_choose_a_role_and_checks_the_password_length(client: TestClient) -> None:
    r = _signup(client, _new_email(), role="supervisor")
    assert r.status_code == 422 and r.json()["error"]["details"]["fields"][0]["field"] == "role"
    short = client.post("/api/auth/signup", json={"email": _new_email(), "password": "short", "name": "X"})
    assert short.status_code == 422 and short.json()["error"]["details"]["fields"][0]["field"] == "password"
    assert _signup(client, "not-an-email").status_code == 422


def test_signup_with_an_existing_email_looks_the_same_and_changes_nothing(client: TestClient) -> None:
    r = _signup(client, "victim1@mail.test")
    assert r.status_code == 202 and r.json()["message"] == _signup(client, _new_email()).json()["message"]
    assert email.outbox.last("victim1@mail.test").subject == "You already have an account"
    assert "token=" not in email.outbox.last("victim1@mail.test").body
    assert _login(client, "victim1@mail.test", DEMO_PASSWORD).status_code == 200  # password unchanged


def test_resend_gives_a_new_link_and_the_old_one_stops_working(client: TestClient) -> None:
    address = _new_email()
    _signup(client, address)
    old = email.outbox.last_token(address)
    assert client.post("/api/auth/resend-verification", json={"email": address}).status_code == 202
    new = email.outbox.last_token(address)
    assert new != old
    assert client.post("/api/auth/verify-email", json={"token": old}).status_code == 400
    assert client.post("/api/auth/verify-email", json={"token": new}).status_code == 200


def test_resend_and_forgot_for_unknown_emails_still_answer_202_and_send_nothing(client: TestClient) -> None:
    ghost = _new_email()
    assert client.post("/api/auth/resend-verification", json={"email": ghost}).status_code == 202
    assert client.post("/api/auth/forgot-password", json={"email": ghost}).status_code == 202
    assert email.outbox.to(ghost) == []
    assert client.post("/api/auth/resend-verification", json={"email": "victim1@mail.test"}).status_code == 202
    assert email.outbox.to("victim1@mail.test") == []  # already verified: nothing to resend


def test_reset_password_changes_it_and_ends_every_session(client: TestClient) -> None:
    address = _new_email()
    _signup(client, address)
    client.post("/api/auth/verify-email", json={"token": email.outbox.last_token(address)})
    sessions = [_login(client, address).json()["data"]["token"] for _ in range(2)]

    assert client.post("/api/auth/forgot-password", json={"email": address}).status_code == 202
    token = email.outbox.last_token(address)
    assert "http://frontend.test/reset-password?token=" in email.outbox.last(address).body
    r = client.post("/api/auth/reset-password", json={"token": token, "new_password": "a-brand-new-password"})
    assert r.status_code == 200

    for session in sessions:
        assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {session}"}).status_code == 401
    assert _login(client, address).status_code == 401
    assert _login(client, address, "a-brand-new-password").status_code == 200
    reuse = client.post("/api/auth/reset-password", json={"token": token, "new_password": "another-password!"})
    assert reuse.json()["error"]["code"] == "INVALID_TOKEN"


def test_a_newer_reset_link_cancels_the_older_one(client: TestClient) -> None:
    address = _new_email()
    _signup(client, address)
    client.post("/api/auth/forgot-password", json={"email": address})
    old = email.outbox.last_token(address)
    client.post("/api/auth/forgot-password", json={"email": address})
    body = {"token": old, "new_password": "a-brand-new-password"}
    assert client.post("/api/auth/reset-password", json=body).json()["error"]["code"] == "INVALID_TOKEN"


def test_reset_link_also_verifies_an_unverified_victim(client: TestClient) -> None:
    address = _new_email()
    _signup(client, address)
    client.post("/api/auth/forgot-password", json={"email": address})
    token = email.outbox.last_token(address)
    client.post("/api/auth/reset-password", json={"token": token, "new_password": "a-brand-new-password"})
    assert _login(client, address, "a-brand-new-password").status_code == 200


def test_a_token_can_be_used_only_once_even_at_the_same_time(client: TestClient) -> None:
    address = _new_email()
    _signup(client, address)
    token = email.outbox.last_token(address)

    def verify(_: int) -> int:
        return client.post("/api/auth/verify-email", json={"token": token}).status_code

    with ThreadPoolExecutor(4) as pool:
        assert sorted(pool.map(verify, range(4))) == [200, 400, 400, 400]


def test_made_up_tokens_are_400_invalid_token(client: TestClient) -> None:
    r = client.post("/api/auth/verify-email", json={"token": "x" * 43})
    assert (r.status_code, r.json()["error"]["code"]) == (400, "INVALID_TOKEN")
    assert client.post("/api/auth/verify-email", json={"token": "short"}).status_code == 422


def test_signup_is_limited_to_five_an_hour(client: TestClient) -> None:
    address = _new_email()
    codes = [_signup(client, address).status_code for _ in range(6)]
    assert codes == [202] * 5 + [429]
    rate_limit.reset_rate_limits()
    forgot = [client.post("/api/auth/forgot-password", json={"email": address}).status_code for _ in range(6)]
    assert forgot[-1] == 429
