"""N14: GET /api/dashboard/stats and GET /api/alerts/shared-accounts on the seeded data."""

from __future__ import annotations

from collections.abc import Callable

from fastapi.testclient import TestClient

from .contract import validate

Login = Callable[[str], dict[str, str]]
OPEN = "received,verified,account_check,notice_published,payout_review"


def _total(client: TestClient, headers: dict[str, str], **params: object) -> int:
    return client.get("/api/cases", headers=headers, params={"page_size": 1, **params}).json()["data"]["total"]


def test_supervisor_dashboard_agrees_with_the_case_list(client: TestClient, login_as: Login) -> None:
    headers = login_as("supervisor")
    r = client.get("/api/dashboard/stats", headers=headers)
    assert r.status_code == 200, r.text
    validate(r.json(), "DashboardStatsResponse")
    stats = r.json()["data"]
    assert stats["scope"] == {"bank_id": None, "label": "All banks"}
    assert stats["open_cases"] == _total(client, headers, status=OPEN)
    assert stats["overdue_cases"] == _total(client, headers, deadline_state="overdue") >= 6
    assert stats["due_soon_cases"] == _total(client, headers, deadline_state="due_soon")
    assert stats["unassigned_cases"] == _total(client, headers, status=OPEN, assigned_to="unassigned")
    assert set(stats["cases_by_status"]) == {
        "received",
        "verified",
        "account_check",
        "notice_published",
        "payout_review",
        "closed",
    }
    assert sum(stats["cases_by_status"].values()) == _total(client, headers)
    assert stats["avg_handling_days"] is not None and stats["avg_handling_days"] > 0
    assert stats["ai_review_pending"] >= 4 and stats["ai_low_confidence_pending"] >= 3
    names = {w["operator"]["name"] for w in stats["workload"]}
    assert {"Operator One", "Operator Two"} <= names
    assert sum(w["open_cases"] for w in stats["workload"]) <= stats["open_cases"]


def test_supervisor_can_narrow_to_one_bank(client: TestClient, login_as: Login) -> None:
    headers = login_as("supervisor")
    stats = client.get("/api/dashboard/stats", headers=headers, params={"bank_id": "bank_a"}).json()["data"]
    assert stats["scope"] == {"bank_id": "bank_a", "label": "Aster Regional Bank"}
    assert stats["open_cases"] == _total(client, headers, status=OPEN, bank_id="bank_a")


def test_bank_viewer_gets_their_own_bank_and_no_workload(client: TestClient, login_as: Login) -> None:
    headers = login_as("viewer_b")
    own = client.get("/api/dashboard/stats", headers=headers).json()["data"]
    asked_for_a = client.get("/api/dashboard/stats", headers=headers, params={"bank_id": "bank_a"}).json()["data"]
    assert own["scope"] == asked_for_a["scope"] == {"bank_id": "bank_b", "label": "Birch Regional Bank"}
    assert own["open_cases"] == asked_for_a["open_cases"] == _total(client, headers, status=OPEN)
    assert own["workload"] == []


def test_operators_and_victims_cant_see_the_dashboard(client: TestClient, login_as: Login) -> None:
    for who in ("operator", "victim1"):
        assert client.get("/api/dashboard/stats", headers=login_as(who)).status_code == 403
    assert client.get("/api/dashboard/stats").status_code == 401


def test_shared_account_alerts_stay_within_a_bank(client: TestClient, login_as: Login) -> None:
    r = client.get("/api/alerts/shared-accounts", headers=login_as("supervisor"))
    assert r.status_code == 200
    validate(r.json(), "SharedAccountAlertListResponse")
    alerts = r.json()["data"]
    keys = {(a["bank_id"], a["account_number"]) for a in alerts}
    assert {("bank_b", "9876543210"), ("bank_b", "0012345"), ("bank_d", "4455667")} <= keys
    assert ("bank_a", "9876543210") not in keys  # one case there; the same digits at bank_b are never compared
    for alert in alerts:
        assert alert["case_count"] == len(alert["cases"]) >= 2
    counts = [a["case_count"] for a in alerts]
    assert counts == sorted(counts, reverse=True)
    ring = next(a for a in alerts if a["account_number"] == "9876543210")
    assert ring["bank_name"] == "Birch Regional Bank" and isinstance(ring["total_amount"], (int, float))


def test_min_cases_filter_and_permissions(client: TestClient, login_as: Login) -> None:
    many = client.get("/api/alerts/shared-accounts", headers=login_as("supervisor"), params={"min_cases": 3}).json()
    assert all(a["case_count"] >= 3 for a in many["data"])
    assert (
        client.get("/api/alerts/shared-accounts", headers=login_as("supervisor"), params={"min_cases": 1}).status_code
        == 422
    )
    for who in ("operator", "viewer_b", "victim1"):
        assert client.get("/api/alerts/shared-accounts", headers=login_as(who)).status_code == 403
