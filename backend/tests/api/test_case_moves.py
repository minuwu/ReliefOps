"""N11: POST /api/cases/{id}/transition and /assign over HTTP (finishes XREQ-001)."""

from __future__ import annotations

import hashlib
from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text

from app.config import Settings
from app.seed import OPERATOR1_ID, user_id

from .contract import validate

Login = Callable[[str], dict[str, str]]
OPERATOR2_ID = user_id("operator2@opscenter.test")
FULL_CASE = {
    "bank_id": "bank_b",
    "channel": "phone",
    "victim": {"name": "Lifecycle Victim", "phone": "+81-90-0000-4242"},
    "amount": 250000,
    "transfer_date": "2026-10-28",
    "account_number": "0099887",
    "scam_type": "impersonation",
}


@pytest.fixture(scope="module")
def owner(settings: Settings) -> Iterator[Engine]:
    engine = create_engine(settings.migrations_database_url)
    yield engine
    engine.dispose()


def _system(conn: Any) -> None:
    conn.execute(text("select set_config('app.role', 'system', true)"))


def attach_document(owner: Engine, case: dict[str, Any]) -> None:
    """Stand-in for Asif's upload route: one document row, with document_count kept exact."""
    content = b"Transfer receipt 250000 JPY"
    with owner.begin() as conn:
        _system(conn)
        doc = conn.execute(
            text(
                "insert into documents (case_id, bank_id, filename, doc_type, mime_type, size_bytes, sha256, uploaded_by) "
                "values (:case, :bank, 'receipt.txt', 'transfer_receipt', 'text/plain', :size, :sha, :by) returning id"
            ),
            {
                "case": case["id"],
                "bank": case["bank_id"],
                "size": len(content),
                "sha": hashlib.sha256(content).hexdigest(),
                "by": OPERATOR1_ID,
            },
        ).scalar_one()
        conn.execute(
            text("insert into document_contents (document_id, bank_id, content) values (:d, :b, :c)"),
            {"d": doc, "b": case["bank_id"], "c": content},
        )
        conn.execute(text("update cases set document_count = document_count + 1 where id = :id"), {"id": case["id"]})


def audit_actions(owner: Engine, case_id: str) -> list[dict[str, Any]]:
    with owner.begin() as conn:
        _system(conn)
        rows = conn.execute(
            text("select action, summary, changes, metadata from audit_log where case_id = :id order by at"),
            {"id": case_id},
        ).mappings()
        return [dict(r) for r in rows]


def new_case(
    client: TestClient, login_as: Login, owner: Engine, *, document: bool = True, **body: Any
) -> dict[str, Any]:
    r = client.post("/api/cases", headers=login_as("operator"), json=FULL_CASE | body)
    assert r.status_code == 201, r.text
    case = r.json()["data"]
    if document:
        attach_document(owner, case)
    return client.get(f"/api/cases/{case['id']}", headers=login_as("operator")).json()["data"]


def move(client: TestClient, headers: dict[str, str], case: dict[str, Any], to: str, **body: Any):  # noqa: ANN201
    payload = {"expected_version": case["version"], "to_status": to, **body}
    return client.post(f"/api/cases/{case['id']}/transition", headers=headers, json=payload)


def step(client: TestClient, headers: dict[str, str], case: dict[str, Any], to: str, **body: Any) -> dict[str, Any]:
    r = move(client, headers, case, to, **body)
    assert r.status_code == 200, r.text
    validate(r.json(), "CaseResponse")
    return r.json()["data"]


# ------------------------------------------------------------------ transition


def test_full_lifecycle_to_paid_out(client: TestClient, login_as: Login, owner: Engine) -> None:
    op, sup = login_as("operator"), login_as("supervisor")
    case = new_case(client, login_as, owner)
    assert case["flags"]["missing_fields"] == []

    verified = step(client, op, case, "verified")
    assert verified["status"] == "verified" and verified["version"] == case["version"] + 1
    deadline = datetime.fromisoformat(verified["deadline"].replace("Z", "+00:00"))
    entered = datetime.fromisoformat(verified["updated_at"].replace("Z", "+00:00"))
    assert abs(deadline - entered - timedelta(days=14)) < timedelta(minutes=1)
    assert verified["allowed_transitions"] == ["account_check", "received", "closed"]

    current = verified
    for status in ("account_check", "notice_published", "payout_review"):
        current = step(client, op, current, status)
    assert client.get(f"/api/cases/{case['id']}", headers=sup).json()["data"]["allowed_closure_reasons"] == [
        "paid_out",
        "rejected",
        "withdrawn",
    ]
    closed = step(client, sup, current, "closed", closure_reason="paid_out", payout_amount=200000, note="Paid in full")
    assert (closed["status"], closed["closure_reason"], closed["payout_amount"]) == ("closed", "paid_out", 200000)
    assert closed["deadline"] is None and closed["deadline_state"] == "none" and closed["closed_at"]
    assert closed["allowed_transitions"] == [] and closed["allowed_closure_reasons"] == []

    moves = [a for a in audit_actions(owner, case["id"]) if a["action"] == "case.status_changed"]
    assert [m["summary"] for m in moves][0] == "Status Received → Verified"
    assert moves[-1]["changes"]["closure_reason"] == {"from": None, "to": "paid_out"}
    assert moves[-1]["metadata"] == {"note": "Paid in full"}

    again = move(client, sup, closed, "payout_review", note="Undo")
    assert (again.status_code, again.json()["error"]["code"]) == (409, "CASE_CLOSED")


def test_leaving_received_without_a_document_lists_what_is_missing(
    client: TestClient, login_as: Login, owner: Engine
) -> None:
    case = new_case(client, login_as, owner, document=False)
    r = move(client, login_as("operator"), case, "verified")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "MISSING_REQUIRED_INFO"
    assert r.json()["error"]["details"] == {"missing_fields": ["document"]}
    validate(r.json(), "ErrorEnvelope")


def test_skipping_a_step_and_moving_back_without_a_note(client: TestClient, login_as: Login, owner: Engine) -> None:
    op = login_as("operator")
    case = new_case(client, login_as, owner)
    skip = move(client, op, case, "notice_published")
    assert skip.status_code == 409
    assert skip.json()["error"]["details"] == {
        "from": "received",
        "to": "notice_published",
        "allowed": ["verified", "closed"],
    }
    verified = step(client, op, case, "verified")
    no_note = move(client, op, verified, "received")
    assert no_note.status_code == 422 and no_note.json()["error"]["details"]["fields"][0]["field"] == "note"
    back = step(client, op, verified, "received", note="Receipt amount didn't match")
    assert back["status"] == "received"


def test_money_closures_are_supervisor_only_and_paid_out_only_from_payout_review(
    client: TestClient, login_as: Login, owner: Engine
) -> None:
    case = new_case(client, login_as, owner)
    op_try = move(client, login_as("operator"), case, "closed", closure_reason="rejected", note="x")
    assert (op_try.status_code, op_try.json()["error"]["code"]) == (403, "FORBIDDEN")
    early = move(client, login_as("supervisor"), case, "closed", closure_reason="paid_out", payout_amount=1, note="x")
    assert (early.status_code, early.json()["error"]["code"]) == (409, "INVALID_STATUS_TRANSITION")
    withdrawn = step(client, login_as("operator"), case, "closed", closure_reason="withdrawn", note="Victim withdrew")
    assert withdrawn["closure_reason"] == "withdrawn" and withdrawn["payout_amount"] is None


def test_stale_and_concurrent_transitions(client: TestClient, login_as: Login, owner: Engine) -> None:
    op = login_as("operator")
    case = new_case(client, login_as, owner)
    with ThreadPoolExecutor(2) as pool:
        codes = sorted(pool.map(lambda _: move(client, op, case, "verified").status_code, range(2)))
    assert codes == [200, 409]
    stale = move(client, op, case, "verified")
    assert stale.json()["error"] == {
        "code": "STALE_CASE",
        "message": "This case changed; reload it",
        "details": {"current_version": case["version"] + 1},
    }
    changed = [a for a in audit_actions(owner, case["id"]) if a["action"] == "case.status_changed"]
    assert len(changed) == 1


def test_who_may_transition(client: TestClient, login_as: Login, owner: Engine) -> None:
    case = new_case(client, login_as, owner)
    for who in ("viewer_b", "viewer_a", "victim1"):
        assert move(client, login_as(who), case, "verified").status_code == 403
    assert move(client, {}, case, "verified").status_code == 401
    ghost = {"id": "00000000-0000-4000-8000-000000000000", "version": 1}
    assert move(client, login_as("operator"), ghost, "verified").status_code == 404
    bad = client.post(
        f"/api/cases/{case['id']}/transition", headers=login_as("operator"), json={"to_status": "verified"}
    )
    assert bad.status_code == 422  # expected_version is required


# ------------------------------------------------------------------ assign


def assign(client: TestClient, headers: dict[str, str], case: dict[str, Any], operator_id: object):  # noqa: ANN201
    return client.post(f"/api/cases/{case['id']}/assign", headers=headers, json={"operator_id": operator_id})


def test_operator_assigns_only_themselves(client: TestClient, login_as: Login, owner: Engine) -> None:
    op = login_as("operator")
    case = new_case(client, login_as, owner)
    r = assign(client, op, case, str(OPERATOR1_ID))
    assert r.status_code == 200
    validate(r.json(), "CaseResponse")
    mine = r.json()["data"]
    assert mine["assigned_operator"] == {"id": str(OPERATOR1_ID), "name": "Operator One"}
    assert mine["version"] == case["version"] + 1
    assert assign(client, op, case, str(OPERATOR2_ID)).status_code == 403
    assert assign(client, op, case, None).json()["data"]["assigned_operator"] is None
    entries = [a for a in audit_actions(owner, case["id"]) if a["action"] == "case.assigned"]
    assert [e["summary"] for e in entries] == ["Assigned to Operator One", "Unassigned"]


def test_supervisor_assigns_anyone_active_and_operators_cant_unassign_others(
    client: TestClient, login_as: Login, owner: Engine
) -> None:
    case = new_case(client, login_as, owner)
    given = assign(client, login_as("supervisor"), case, str(OPERATOR2_ID)).json()["data"]
    assert given["assigned_operator"]["name"] == "Operator Two"
    assert assign(client, login_as("operator"), case, None).status_code == 403
    victim = assign(client, login_as("supervisor"), case, str(user_id("victim1@mail.test")))
    assert victim.status_code == 422 and victim.json()["error"]["details"]["fields"][0]["field"] == "operator_id"
    assert client.post(f"/api/cases/{case['id']}/assign", headers=login_as("supervisor"), json={}).status_code == 422
    assert assign(client, login_as("viewer_b"), case, None).status_code == 403


def test_assigning_a_closed_case_is_409(client: TestClient, login_as: Login, owner: Engine) -> None:
    case = new_case(client, login_as, owner)
    closed = step(client, login_as("operator"), case, "closed", closure_reason="withdrawn", note="Withdrawn")
    r = assign(client, login_as("supervisor"), closed, str(OPERATOR2_ID))
    assert (r.status_code, r.json()["error"]["code"]) == (409, "CASE_CLOSED")
