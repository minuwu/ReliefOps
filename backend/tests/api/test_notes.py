"""N13: POST /api/cases/{id}/notes."""

from __future__ import annotations

from collections.abc import Callable
from uuid import uuid4

from fastapi.testclient import TestClient

from app.seed import CASE_42_ID

from .contract import validate

Login = Callable[[str], dict[str, str]]


def _new_case(client: TestClient, login_as: Login) -> dict:
    body = {"bank_id": "bank_b", "channel": "phone", "victim": {"name": "Note Case"}}
    return client.post("/api/cases", headers=login_as("operator"), json=body).json()["data"]


def test_staff_add_notes_and_the_case_shows_them_newest_first(client: TestClient, login_as: Login) -> None:
    case = _new_case(client, login_as)
    first = client.post(f"/api/cases/{case['id']}/notes", headers=login_as("operator"), json={"body": " First call. "})
    assert first.status_code == 201
    validate(first.json(), "NoteResponse")
    assert first.json()["data"]["body"] == "First call." and first.json()["data"]["author"]["name"] == "Operator One"
    client.post(f"/api/cases/{case['id']}/notes", headers=login_as("supervisor"), json={"body": "Second."})
    detail = client.get(f"/api/cases/{case['id']}", headers=login_as("operator")).json()["data"]
    assert [n["body"] for n in detail["notes"]] == ["Second.", "First call."]
    assert detail["version"] == case["version"]  # a note isn't an edit of the case


def test_notes_are_allowed_on_a_closed_case(client: TestClient, login_as: Login) -> None:
    closed = client.get("/api/cases", headers=login_as("operator"), params={"status": "closed"}).json()["data"][
        "items"
    ][0]
    r = client.post(f"/api/cases/{closed['id']}/notes", headers=login_as("operator"), json={"body": "Called back."})
    assert r.status_code == 201


def test_who_may_add_notes_and_validation(client: TestClient, login_as: Login) -> None:
    url = f"/api/cases/{CASE_42_ID}/notes"
    assert client.post(url, headers=login_as("viewer_b"), json={"body": "x"}).status_code == 403
    assert client.post(url, headers=login_as("victim1"), json={"body": "x"}).status_code == 403
    assert client.post(url, json={"body": "x"}).status_code == 401
    assert client.post(url, headers=login_as("operator"), json={"body": "   "}).status_code == 422
    assert client.post(url, headers=login_as("operator"), json={"body": "x" * 4001}).status_code == 422
    missing = f"/api/cases/{uuid4()}/notes"
    assert client.post(missing, headers=login_as("operator"), json={"body": "x"}).status_code == 404
