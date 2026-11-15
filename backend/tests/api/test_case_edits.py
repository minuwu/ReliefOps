"""N10: POST /api/cases and PATCH /api/cases/{id} over HTTP (edit rules, versions, audit, permissions)."""

from __future__ import annotations

from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text

from app.config import Settings
from app.seed import OPERATOR1_ID, user_id

from .contract import validate

Login = Callable[[str], dict[str, str]]


@pytest.fixture(scope="module")
def owner(settings: Settings) -> Iterator[Engine]:
    engine = create_engine(settings.migrations_database_url)
    yield engine
    engine.dispose()


def audit_entries(owner: Engine, case_id: str) -> list[dict[str, Any]]:
    with owner.begin() as conn:
        conn.execute(text("select set_config('app.role', 'system', true)"))
        rows = conn.execute(
            text("select action, changes, metadata, actor_id from audit_log where case_id = :id order by at"),
            {"id": case_id},
        ).mappings()
        return [dict(r) for r in rows]


def create(client: TestClient, headers: dict[str, str], **body: Any) -> dict[str, Any]:
    payload = {"bank_id": "bank_b", "channel": "paper", "victim": {"name": "Paper Victim"}} | body
    r = client.post("/api/cases", headers=headers, json=payload)
    assert r.status_code == 201, r.text
    validate(r.json(), "CaseResponse")
    return r.json()["data"]


def patch(client: TestClient, headers: dict[str, str], case: dict[str, Any], **body: Any):  # noqa: ANN201
    return client.patch(f"/api/cases/{case['id']}", headers=headers, json={"expected_version": case["version"], **body})


# ------------------------------------------------------------------ create


def test_operator_creates_a_paper_case_with_only_a_name(client: TestClient, login_as: Login, owner: Engine) -> None:
    case = create(client, login_as("operator"))
    assert case["reference"].startswith("RFR-") and int(case["reference"][-5:]) >= 100
    assert (case["status"], case["channel"], case["version"], case["bank_name"]) == (
        "received",
        "paper",
        1,
        "Birch Regional Bank",
    )
    assert case["flags"]["missing_fields"] == [
        "victim_contact",
        "amount",
        "transfer_date",
        "account_number",
        "scam_type",
        "document",
    ]
    assert case["deadline_state"] == "on_track" and case["allowed_transitions"] == ["verified", "closed"]
    assert [e["action"] for e in audit_entries(owner, case["id"])] == ["case.created"]


def test_create_with_every_field_and_self_assignment(client: TestClient, login_as: Login) -> None:
    case = create(
        client,
        login_as("operator"),
        channel="phone",
        victim={"name": "Phone Victim", "phone": "+81-90-0000-7777", "email": "Phone.Victim@Mail.Test"},
        amount=120000,
        transfer_date="2026-11-01",
        account_number="5550001",
        account_holder_name="Sample Holder",
        scam_type="phishing",
        description="Called about a fake parcel fee.",
        reported_date="2026-11-10",
        assigned_operator_id=str(OPERATOR1_ID),
    )
    assert case["victim"]["email"] == "phone.victim@mail.test" and case["amount"] == 120000
    assert case["reported_date"] == "2026-11-10" and case["assigned_operator"]["name"] == "Operator One"
    assert case["flags"]["missing_fields"] == ["document"]


def test_a_repeat_report_is_flagged_as_a_possible_duplicate(client: TestClient, login_as: Login) -> None:
    body = {
        "victim": {"name": "Twice Reported", "phone": "+81-90-0000-8888"},
        "amount": 33000,
        "transfer_date": "2026-11-02",
        "account_number": "7770001",
    }
    first = create(client, login_as("operator"), **body)
    second = create(client, login_as("operator"), **body)
    assert first["flags"]["possible_duplicate"] is False and second["flags"]["possible_duplicate"] is True


def test_assignment_rules_on_create(client: TestClient, login_as: Login) -> None:
    other = str(user_id("operator2@opscenter.test"))
    body = {"bank_id": "bank_a", "channel": "phone", "victim": {"name": "X"}, "assigned_operator_id": other}
    assert client.post("/api/cases", headers=login_as("operator"), json=body).status_code == 403
    assert client.post("/api/cases", headers=login_as("supervisor"), json=body).status_code == 201
    victim = str(user_id("victim1@mail.test"))
    r = client.post("/api/cases", headers=login_as("supervisor"), json=body | {"assigned_operator_id": victim})
    assert r.status_code == 422 and r.json()["error"]["details"]["fields"][0]["field"] == "assigned_operator_id"


def test_create_refuses_web_form_unknown_fields_and_non_staff(client: TestClient, login_as: Login) -> None:
    body = {"bank_id": "bank_b", "channel": "web_form", "victim": {"name": "X"}}
    r = client.post("/api/cases", headers=login_as("operator"), json=body)
    assert r.status_code == 422 and r.json()["error"]["details"]["fields"][0]["field"] == "channel"
    paper = body | {"channel": "paper"}
    assert client.post("/api/cases", headers=login_as("operator"), json=paper | {"status": "closed"}).status_code == 422
    assert client.post("/api/cases", headers=login_as("operator"), json={"channel": "paper"}).status_code == 422
    assert client.post("/api/cases", headers=login_as("viewer_b"), json=paper).status_code == 403
    assert client.post("/api/cases", headers=login_as("victim1"), json=paper).status_code == 403


def test_a_new_case_is_visible_to_its_bank_only(client: TestClient, login_as: Login) -> None:
    case = create(client, login_as("operator"))
    assert client.get(f"/api/cases/{case['id']}", headers=login_as("viewer_b")).status_code == 200
    assert client.get(f"/api/cases/{case['id']}", headers=login_as("viewer_a")).status_code == 404


# ------------------------------------------------------------------ edit


def test_patch_merges_victim_fields_bumps_the_version_and_audits_each_change(
    client: TestClient, login_as: Login, owner: Engine
) -> None:
    headers = login_as("operator")
    case = create(client, headers, victim={"name": "Edit Me", "email": "edit.me@mail.test"}, amount=1000)
    r = patch(client, headers, case, amount=260000, victim={"phone": "+81-90-0000-0043"})
    assert r.status_code == 200, r.text
    validate(r.json(), "CaseResponse")
    updated = r.json()["data"]
    assert updated["version"] == 2 and updated["amount"] == 260000
    assert updated["victim"] == {
        "name": "Edit Me",
        "phone": "+81-90-0000-0043",
        "email": "edit.me@mail.test",
        "address": None,
        "preferred_language": "en",
    }
    entry = audit_entries(owner, case["id"])[-1]
    assert entry["action"] == "case.updated"
    assert entry["changes"] == {
        "amount": {"from": 1000.0, "to": 260000.0},
        "victim.phone": {"from": None, "to": "+81-90-0000-0043"},
    }


def test_null_clears_a_field_and_a_no_op_keeps_the_version(client: TestClient, login_as: Login) -> None:
    headers = login_as("operator")
    case = create(client, headers, account_number="1112223", amount=500)
    cleared = patch(client, headers, case, account_number=None).json()["data"]
    assert cleared["account_number"] is None and cleared["version"] == 2
    same = patch(client, headers, cleared, amount=500).json()["data"]
    assert same["version"] == 2
    assert patch(client, headers, cleared, victim={"name": None}).status_code == 422
    assert patch(client, headers, cleared, currency=None).status_code == 422
    assert patch(client, headers, cleared, status="closed").status_code == 422


def test_stale_version_is_409_with_the_current_version(client: TestClient, login_as: Login) -> None:
    headers = login_as("operator")
    case = create(client, headers)
    assert patch(client, headers, case, amount=1).status_code == 200
    r = patch(client, headers, case, amount=2)  # still sends version 1
    assert r.status_code == 409
    assert r.json()["error"] == {
        "code": "STALE_CASE",
        "message": "This case changed; reload it",
        "details": {"current_version": 2},
    }


def test_two_parallel_edits_one_wins_and_one_audit_entry(client: TestClient, login_as: Login, owner: Engine) -> None:
    headers = login_as("operator")
    case = create(client, headers)

    def edit(amount: int) -> int:
        return patch(client, headers, case, amount=amount).status_code

    with ThreadPoolExecutor(2) as pool:
        assert sorted(pool.map(edit, [1000, 2000])) == [200, 409]
    assert [e["action"] for e in audit_entries(owner, case["id"])].count("case.updated") == 1


def test_only_a_supervisor_changes_the_deadline_and_it_needs_a_reason(
    client: TestClient, login_as: Login, owner: Engine
) -> None:
    case = create(client, login_as("operator"))
    deadline = "2026-12-24T09:00:00Z"
    assert patch(client, login_as("operator"), case, deadline=deadline, deadline_reason="x").status_code == 403
    assert patch(client, login_as("supervisor"), case, deadline=deadline).status_code == 422
    r = patch(client, login_as("supervisor"), case, deadline=deadline, deadline_reason="Bank asked for more time")
    assert r.status_code == 200 and r.json()["data"]["deadline"] == deadline
    entry = audit_entries(owner, case["id"])[-1]
    assert entry["action"] == "case.deadline_changed"
    assert entry["metadata"] == {"reason": "Bank asked for more time"}


def test_viewers_victims_closed_and_unknown_cases(client: TestClient, login_as: Login) -> None:
    case = create(client, login_as("operator"))
    assert patch(client, login_as("viewer_b"), case, amount=1).status_code == 403
    assert patch(client, login_as("victim1"), case, amount=1).status_code == 403
    closed = client.get("/api/cases", headers=login_as("operator"), params={"status": "closed"}).json()["data"]
    target = client.get(f"/api/cases/{closed['items'][0]['id']}", headers=login_as("operator")).json()["data"]
    r = patch(client, login_as("operator"), target, amount=1)
    assert (r.status_code, r.json()["error"]["code"]) == (409, "CASE_CLOSED")
    ghost = {"id": "00000000-0000-4000-8000-000000000000", "version": 1}
    assert patch(client, login_as("operator"), ghost, amount=1).status_code == 404
