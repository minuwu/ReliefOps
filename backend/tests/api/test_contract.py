"""Every response my endpoints send matches docs/openapi.yaml (guide §9: matches the contract)."""

from __future__ import annotations

from collections.abc import Callable
from uuid import uuid4

from fastapi.testclient import TestClient

from app.seed import CASE_42_ID, DEMO_PASSWORD

from .contract import validate

Login = Callable[[str], dict[str, str]]


def test_reference_endpoints(client: TestClient) -> None:
    validate(client.get("/api/health").json(), "HealthResponse")
    validate(client.get("/api/banks").json(), "BankListResponse")


def test_auth_endpoints(client: TestClient, login_as: Login) -> None:
    login = client.post("/api/auth/login", json={"email": "viewer@bank-a.test", "password": DEMO_PASSWORD})
    validate(login.json(), "LoginResponse")
    headers = {"Authorization": f"Bearer {login.json()['data']['token']}"}
    validate(client.get("/api/auth/me", headers=headers).json(), "UserResponse")
    validate(client.post("/api/auth/logout", headers=headers).json(), "EmptyResponse")
    signup = {"email": f"c-{uuid4().hex[:8]}@mail.test", "password": "a-long-password", "name": "Contract Check"}
    validate(client.post("/api/auth/signup", json=signup).json(), "EmptyResponse")
    validate(client.post("/api/auth/forgot-password", json={"email": signup["email"]}).json(), "EmptyResponse")


def test_error_envelopes(client: TestClient, login_as: Login) -> None:
    validate(client.get("/api/auth/me").json(), "ErrorEnvelope")
    validate(client.post("/api/auth/login", json={"email": "a@b.test", "password": "x"}).json(), "ErrorEnvelope")
    validate(client.post("/api/auth/login", json={"email": "a@b.test"}).json(), "ErrorEnvelope")
    validate(client.get(f"/api/cases/{uuid4()}", headers=login_as("operator")).json(), "ErrorEnvelope")


def test_case_list_and_detail(client: TestClient, login_as: Login) -> None:
    for who in ("operator", "supervisor", "viewer_b"):
        headers = login_as(who)
        validate(client.get("/api/cases", headers=headers, params={"page_size": 100}).json(), "CaseSummaryPageResponse")
        validate(client.get(f"/api/cases/{CASE_42_ID}", headers=headers).json(), "CaseResponse")
    every = client.get("/api/cases", headers=login_as("operator"), params={"page_size": 100}).json()["data"]["items"]
    for case in every[:15]:  # cases in every status, with and without documents and extractions
        validate(client.get(f"/api/cases/{case['id']}", headers=login_as("operator")).json(), "CaseResponse")
