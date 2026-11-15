"""Asif's routes over HTTP, each response checked against the schema openapi.yaml declares for it.

The schema isn't hand-picked: ``check()`` looks up ``paths[path][method].responses[status]`` in the
contract and validates the body against exactly that, so a wrong status or a missing/renamed field
fails. File and CSV downloads are checked by headers (the contract says they skip the envelope).
"""

from __future__ import annotations

from collections.abc import Callable
from functools import lru_cache
from pathlib import Path
from typing import Any
from uuid import uuid4

import jsonschema
import yaml
from fastapi.testclient import TestClient
from httpx import Response

from app import email
from app.seed import CASE_42_ID

Login = Callable[[str], dict[str, str]]
CONTRACT = Path(__file__).resolve().parents[3] / "docs" / "openapi.yaml"
PAPER_FORM = Path(__file__).resolve().parents[2] / "eval" / "extraction" / "documents" / "t04_victim_report.txt"


@lru_cache(maxsize=1)
def _spec() -> dict[str, Any]:
    return yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))


def check(r: Response, method: str, path: str, status: int) -> dict[str, Any]:
    """Assert the status, then validate the body against the contract's schema for (path, method, status)."""
    assert r.status_code == status, f"{method} {path}: {r.status_code} {r.text[:300]}"
    declared = _spec()["paths"][path][method.lower()]["responses"]
    assert str(status) in declared, f"{method} {path} returned {status}, which the contract doesn't declare"
    response = declared[str(status)]
    if "$ref" in response:  # a shared response such as #/components/responses/ValidationError
        response = _spec()["components"]["responses"][response["$ref"].rsplit("/", 1)[1]]
    schema = response["content"]["application/json"]["schema"]
    body = r.json()
    jsonschema.Draft202012Validator(
        {**schema, "components": _spec()["components"]}, format_checker=jsonschema.FormatChecker()
    ).validate(body)
    return body


def _paper_case(client: TestClient, login_as: Login, **victim: str) -> dict[str, Any]:
    body = {"bank_id": "bank_b", "channel": "paper", "victim": {"name": "Contract Victim", **victim}}
    return client.post("/api/cases", headers=login_as("operator"), json=body).json()["data"]


def _upload(client: TestClient, login_as: Login, case_id: str) -> Response:
    return client.post(
        f"/api/cases/{case_id}/documents",
        headers=login_as("operator"),
        files={"file": ("paper_form.txt", PAPER_FORM.read_bytes(), "text/plain")},
        data={"doc_type": "intake_form"},
    )


def test_documents_extraction_review_and_queue(client: TestClient, login_as: Login) -> None:
    op = login_as("operator")
    case = _paper_case(client, login_as)
    doc = check(_upload(client, login_as, case["id"]), "POST", "/api/cases/{case_id}/documents", 201)["data"]

    file = client.get(f"/api/documents/{doc['id']}/file", headers=op)
    assert file.status_code == 200 and file.content == PAPER_FORM.read_bytes()
    assert file.headers["content-disposition"].startswith("attachment")
    assert file.headers["x-content-type-options"] == "nosniff"
    check(
        client.get(f"/api/documents/{doc['id']}/file", headers=login_as("viewer_a")),
        "GET",
        "/api/documents/{document_id}/file",
        404,
    )

    ext = check(
        client.post(f"/api/documents/{doc['id']}/extract", headers=op),
        "POST",
        "/api/documents/{document_id}/extract",
        201,
    )["data"]
    assert (ext["status"], ext["source"]) == ("pending_review", "rules_fallback")  # AI_MODE=off in tests
    check(client.get(f"/api/extractions/{ext['id']}", headers=op), "GET", "/api/extractions/{extraction_id}", 200)
    queue = check(
        client.get("/api/review-queue", headers=op, params={"page_size": 100}), "GET", "/api/review-queue", 200
    )["data"]
    assert ext["id"] in {i["extraction_id"] for i in queue["items"]}
    check(client.get("/api/review-queue", headers=op, params={"lane": "nope"}), "GET", "/api/review-queue", 422)

    version = client.get(f"/api/cases/{case['id']}", headers=op).json()["data"]["version"]
    stale = {"decision": "accept", "expected_version": version + 5, "fields": {"amount": 1000}}
    check(
        client.post(f"/api/extractions/{ext['id']}/review", headers=op, json=stale),
        "POST",
        "/api/extractions/{extraction_id}/review",
        409,
    )
    accept = {"decision": "accept", "expected_version": version, "fields": {"amount": 250000, "scam_type": "phishing"}}
    result = check(
        client.post(f"/api/extractions/{ext['id']}/review", headers=op, json=accept),
        "POST",
        "/api/extractions/{extraction_id}/review",
        200,
    )["data"]
    assert result["case"]["amount"] == 250000 and result["extraction"]["status"] == "accepted"
    again = {"decision": "reject", "expected_version": result["case"]["version"], "note": "x"}
    body = check(
        client.post(f"/api/extractions/{ext['id']}/review", headers=op, json=again),
        "POST",
        "/api/extractions/{extraction_id}/review",
        409,
    )
    assert body["error"]["code"] == "ALREADY_REVIEWED"


def test_upload_errors(client: TestClient, login_as: Login) -> None:
    case = _paper_case(client, login_as)
    exe = client.post(
        f"/api/cases/{case['id']}/documents",
        headers=login_as("operator"),
        files={"file": ("x.pdf", b"MZ\x90\x00" + b"\x00" * 64, "application/pdf")},
        data={"doc_type": "other"},
    )
    check(exe, "POST", "/api/cases/{case_id}/documents", 400)
    big = client.post(
        f"/api/cases/{case['id']}/documents",
        headers=login_as("operator"),
        files={"file": ("big.txt", b"a" * (10 * 1024 * 1024 + 1), "text/plain")},
        data={"doc_type": "other"},
    )
    check(big, "POST", "/api/cases/{case_id}/documents", 413)
    check(_upload(client, login_as, str(uuid4())), "POST", "/api/cases/{case_id}/documents", 404)


def test_history_csv_and_audit_logs(client: TestClient, login_as: Login) -> None:
    op, sup = login_as("operator"), login_as("supervisor")
    page = check(client.get(f"/api/cases/{CASE_42_ID}/history", headers=op), "GET", "/api/cases/{case_id}/history", 200)
    assert page["data"]["total"] >= 1
    check(
        client.get(f"/api/cases/{CASE_42_ID}/history", headers=login_as("viewer_a")),
        "GET",
        "/api/cases/{case_id}/history",
        404,
    )
    csv = client.get(f"/api/cases/{CASE_42_ID}/history", headers=op, params={"format": "csv"})
    assert csv.status_code == 200 and csv.headers["content-type"].startswith("text/csv")
    assert csv.headers["content-disposition"].startswith("attachment")
    assert csv.text.splitlines()[0].count(",") >= 3

    logs = check(client.get("/api/audit-logs", headers=sup, params={"page_size": 50}), "GET", "/api/audit-logs", 200)
    assert logs["data"]["total"] > 0
    viewer = check(
        client.get("/api/audit-logs", headers=login_as("viewer_b"), params={"page_size": 100}),
        "GET",
        "/api/audit-logs",
        200,
    )
    assert {e["bank_id"] for e in viewer["data"]["items"]} <= {"bank_b", None}
    check(client.get("/api/audit-logs", headers=op), "GET", "/api/audit-logs", 403)


def test_victim_report_list_view_edit(client: TestClient, login_as: Login) -> None:
    v2 = login_as("victim2")
    report = {
        "bank_id": "bank_c",
        "victim": {"name": "Haruto Tanaka", "phone": "+81-90-0000-5151"},
        "amount": 98000,
        "currency": "JPY",
        "transfer_date": "2026-11-03",
        "scam_type": "romance",
        "consent": True,
    }
    mine = check(client.post("/api/victim/cases", headers=v2, json=report), "POST", "/api/victim/cases", 201)["data"]
    assert mine["victim"]["email"] == "victim2@mail.test"  # defaults to the account's verified email
    listed = check(client.get("/api/victim/cases", headers=v2), "GET", "/api/victim/cases", 200)["data"]
    assert mine["id"] in {c["id"] for c in listed}
    check(client.get(f"/api/victim/cases/{mine['id']}", headers=v2), "GET", "/api/victim/cases/{case_id}", 200)
    check(
        client.get(f"/api/victim/cases/{mine['id']}", headers=login_as("victim1")),
        "GET",
        "/api/victim/cases/{case_id}",
        404,
    )

    edit = {"expected_version": mine["version"], "amount": 99000, "victim": {"address": "Synthetic street 1"}}
    edited = check(
        client.patch(f"/api/victim/cases/{mine['id']}", headers=v2, json=edit),
        "PATCH",
        "/api/victim/cases/{case_id}",
        200,
    )["data"]
    assert edited["amount"] == 99000 and edited["victim"]["address"] == "Synthetic street 1"
    locked = client.patch(
        f"/api/victim/cases/{CASE_42_ID}", headers=login_as("victim1"), json={"expected_version": 1, "amount": 1}
    )
    check(locked, "PATCH", "/api/victim/cases/{case_id}", 409)  # verified case: report facts locked (or stale)
    check(
        client.post("/api/victim/cases", headers=v2, json=report | {"consent": False}), "POST", "/api/victim/cases", 422
    )


def test_victim_invite_and_claim(client: TestClient, login_as: Login) -> None:
    case = _paper_case(client, login_as, email="victim2@mail.test")
    url = f"/api/cases/{case['id']}/victim-invite"
    check(client.post(url, headers=login_as("operator")), "POST", "/api/cases/{case_id}/victim-invite", 200)
    token = email.outbox.last_token("victim2@mail.test")
    check(
        client.post("/api/victim/claims", headers=login_as("victim1"), json={"token": token}),
        "POST",
        "/api/victim/claims",
        403,
    )  # a different verified email can't claim it
    claimed = check(
        client.post("/api/victim/claims", headers=login_as("victim2"), json={"token": token}),
        "POST",
        "/api/victim/claims",
        200,
    )["data"]
    assert claimed["reference"] == case["reference"]
    check(
        client.post("/api/victim/claims", headers=login_as("victim2"), json={"token": token}),
        "POST",
        "/api/victim/claims",
        400,
    )
    no_email = _paper_case(client, login_as)
    check(
        client.post(f"/api/cases/{no_email['id']}/victim-invite", headers=login_as("operator")),
        "POST",
        "/api/cases/{case_id}/victim-invite",
        422,
    )
