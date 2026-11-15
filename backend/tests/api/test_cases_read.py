"""N9: GET /api/cases and GET /api/cases/{id} on the seeded demo data (XREQ-001)."""

from __future__ import annotations

from collections.abc import Callable
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.config import Settings
from app.seed import CASE_42_ID, OPERATOR1_ID

Login = Callable[[str], dict[str, str]]
CASE_42 = str(CASE_42_ID)


def _list(client: TestClient, headers: dict[str, str], **params: object) -> dict:
    r = client.get("/api/cases", headers=headers, params={"page_size": 100, **params})
    assert r.status_code == 200, r.text
    return r.json()["data"]


# ------------------------------------------------------------------ list


def test_list_is_a_page_of_case_summaries(client: TestClient, login_as: Login) -> None:
    page = _list(client, login_as("operator"))
    assert set(page) == {"items", "page", "page_size", "total"}
    assert page["total"] >= 42 and len(page["items"]) == min(page["total"], 100)
    item = page["items"][0]
    assert set(item) == {
        "id",
        "reference",
        "bank_id",
        "bank_name",
        "victim_name",
        "amount",
        "currency",
        "scam_type",
        "status",
        "deadline",
        "deadline_state",
        "assigned_operator",
        "reported_date",
        "updated_at",
        "flags",
    }
    assert set(item["flags"]) == {
        "missing_fields",
        "ai_review_pending",
        "shared_account_case_count",
        "victim_question_pending",
        "possible_duplicate",
    }


def test_bank_viewer_sees_only_their_bank_and_the_bank_filter_is_ignored(client: TestClient, login_as: Login) -> None:
    own = _list(client, login_as("viewer_b"))
    assert own["total"] > 0 and {c["bank_id"] for c in own["items"]} == {"bank_b"}
    asked_for_a = _list(client, login_as("viewer_b"), bank_id="bank_a")
    assert asked_for_a["total"] == own["total"] and {c["bank_id"] for c in asked_for_a["items"]} == {"bank_b"}
    operator_a = _list(client, login_as("operator"), bank_id="bank_a")
    assert {c["bank_id"] for c in operator_a["items"]} == {"bank_a"}


def test_victims_get_403_and_no_token_401(client: TestClient, login_as: Login) -> None:
    assert client.get("/api/cases", headers=login_as("victim1")).status_code == 403
    assert client.get("/api/cases").status_code == 401


def test_status_filter_accepts_a_comma_separated_list(client: TestClient, login_as: Login) -> None:
    page = _list(client, login_as("operator"), status="received,verified")
    assert page["total"] > 0 and {c["status"] for c in page["items"]} <= {"received", "verified"}
    bad = client.get("/api/cases", headers=login_as("operator"), params={"status": "received,lost"})
    assert bad.status_code == 422 and bad.json()["error"]["details"]["fields"][0]["field"] == "status"


def test_deadline_filter_and_field_agree(client: TestClient, login_as: Login) -> None:
    headers = login_as("operator")
    overdue = _list(client, headers, deadline_state="overdue")
    assert overdue["total"] >= 6 and {c["deadline_state"] for c in overdue["items"]} == {"overdue"}
    for state in ("on_track", "due_soon"):
        page = _list(client, headers, deadline_state=state)
        assert {c["deadline_state"] for c in page["items"]} <= {state}
    every = _list(client, headers)
    closed = [c for c in every["items"] if c["status"] == "closed"]
    assert closed and all(c["deadline_state"] == "none" and c["deadline"] is None for c in closed)


def test_assigned_to_me_unassigned_and_a_user_id(client: TestClient, login_as: Login) -> None:
    headers = login_as("operator")
    mine = _list(client, headers, assigned_to="me")
    assert mine["total"] > 0 and {c["assigned_operator"]["id"] for c in mine["items"]} == {str(OPERATOR1_ID)}
    assert _list(client, headers, assigned_to=str(OPERATOR1_ID))["total"] == mine["total"]
    nobody = _list(client, headers, assigned_to="unassigned")
    assert nobody["total"] > 0 and all(c["assigned_operator"] is None for c in nobody["items"])
    bad = client.get("/api/cases", headers=headers, params={"assigned_to": "someone"})
    assert bad.status_code == 422


def test_search_by_reference_account_or_name_and_wildcards_are_literal(client: TestClient, login_as: Login) -> None:
    headers = login_as("operator")
    assert [c["reference"] for c in _list(client, headers, q="00042")["items"]] == ["RFR-2026-00042"]
    ring = _list(client, headers, q="9876543210")
    assert ring["total"] >= 3
    assert _list(client, headers, q="rina exam")["items"][0]["reference"] == "RFR-2026-00042"
    assert _list(client, headers, q="%")["total"] == 0


def test_sorting_and_paging(client: TestClient, login_as: Login) -> None:
    headers = login_as("operator")
    amounts = [c["amount"] for c in _list(client, headers, sort="amount", order="desc")["items"] if c["amount"]]
    assert amounts == sorted(amounts, reverse=True)
    deadlines = [c["deadline"] for c in _list(client, headers)["items"]]
    present = [d for d in deadlines if d is not None]
    assert present == sorted(present) and deadlines[-1] is None  # default: deadline asc, closed cases last
    first = client.get("/api/cases", headers=headers, params={"page_size": 5}).json()["data"]
    second = client.get("/api/cases", headers=headers, params={"page_size": 5, "page": 2}).json()["data"]
    assert len(first["items"]) == 5 and first["total"] == second["total"]
    assert not {c["id"] for c in first["items"]} & {c["id"] for c in second["items"]}
    assert client.get("/api/cases", headers=headers, params={"page_size": 101}).status_code == 422
    far = client.get("/api/cases", headers=headers, params={"page": 999}).json()["data"]
    assert far["items"] == [] and far["total"] == first["total"]


def test_money_is_a_json_number(client: TestClient, login_as: Login) -> None:
    item = _list(client, login_as("operator"), q="00042")["items"][0]
    assert item["amount"] == 250000 and isinstance(item["amount"], (int, float))


# ------------------------------------------------------------------ detail


def test_case_detail_matches_the_contract_shape(client: TestClient, login_as: Login) -> None:
    r = client.get(f"/api/cases/{CASE_42}", headers=login_as("operator"))
    assert r.status_code == 200, r.text
    case = r.json()["data"]
    assert (case["reference"], case["status"], case["bank_name"]) == (
        "RFR-2026-00042",
        "verified",
        "Birch Regional Bank",
    )
    assert case["victim"] == {
        "name": "Rina Example",
        "phone": "+81-90-0000-0042",
        "email": "victim1@mail.test",
        "address": None,
        "preferred_language": "ja",
    }
    assert case["allowed_transitions"] == ["account_check", "received", "closed"]
    assert case["allowed_closure_reasons"] == ["withdrawn"]
    assert case["assigned_operator"] == {"id": str(OPERATOR1_ID), "name": "Operator One"}
    assert case["flags"]["missing_fields"] == [] and case["flags"]["shared_account_case_count"] == 1
    assert [d["filename"] for d in case["documents"]] == ["t02_netbank.pdf"]
    assert [n["body"] for n in case["notes"]] == ["Victim confirmed the transfer by phone."]
    assert case["version"] >= 1 and case["payout_amount"] is None and case["channel"] == "web_form"


def test_supervisor_and_viewer_get_their_own_buttons(client: TestClient, login_as: Login) -> None:
    supervisor = client.get(f"/api/cases/{CASE_42}", headers=login_as("supervisor")).json()["data"]
    assert supervisor["allowed_closure_reasons"] == ["rejected", "withdrawn"]
    viewer = client.get(f"/api/cases/{CASE_42}", headers=login_as("viewer_b")).json()["data"]
    assert viewer["allowed_transitions"] == [] and viewer["allowed_closure_reasons"] == []


def test_another_banks_case_is_404_not_403(client: TestClient, login_as: Login) -> None:
    r = client.get(f"/api/cases/{CASE_42}", headers=login_as("viewer_a"))
    assert r.status_code == 404
    assert r.json()["error"] == {"code": "RESOURCE_NOT_FOUND", "message": "Case not found", "details": {}}
    assert client.get(f"/api/cases/{uuid4()}", headers=login_as("operator")).status_code == 404
    assert client.get("/api/cases/not-a-uuid", headers=login_as("operator")).status_code == 422
    assert client.get(f"/api/cases/{CASE_42}", headers=login_as("victim1")).status_code == 403


def test_opening_a_case_is_audited_once_per_ten_minutes(
    client: TestClient, login_as: Login, settings: Settings
) -> None:
    engine = create_engine(settings.migrations_database_url)
    count_sql = text(
        "select count(*) from audit_log where action = 'case.viewed' and case_id = :case and actor_id = "
        "(select id from users where email = 'operator2@opscenter.test')"
    )

    def views() -> int:
        with engine.begin() as conn:
            conn.execute(text("select set_config('app.role', 'system', true)"))
            return conn.execute(count_sql, {"case": CASE_42_ID}).scalar_one()

    try:
        before = views()
        for _ in range(3):
            assert client.get(f"/api/cases/{CASE_42}", headers=login_as("operator2")).status_code == 200
        assert views() == before + 1
    finally:
        engine.dispose()
