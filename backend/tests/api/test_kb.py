"""N18: bluebook list, upload + background indexing, publish and archive (API_SPEC §6.8)."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient

from .contract import validate

Login = Callable[[str], dict[str, str]]
EMBER_TITLE = "Ember Regional Bank — Fraud Relief Bluebook"  # the seeded, published bank_e bluebook

SYNTHETIC_TXT = (
    "Ember Regional Bank fraud relief guide (synthetic, for the demo)\n"
    "\n"
    "1 About this guide\n"
    "This guide explains how relief payments work after a transfer scam.\n"
    "\n"
    "2.1 Documents you need\n"
    "Bring the transfer receipt, a photo ID and the police report receipt number.\n"
    "\n"
    "2.2 Contact hours\n"
    "Call the relief desk on weekdays from 9:00 to 17:00.\n"
).encode()


def upload(
    client: TestClient, login_as: Login, content: bytes = SYNTHETIC_TXT, filename: str = "guide.txt", **form: str
) -> Any:
    fields = {"bank_id": "bank_e", "title": "Ember test guide", "version": "t1", "language": "en"} | form
    return client.post(
        "/api/kb/documents",
        headers=login_as("supervisor"),
        data=fields,
        files={"file": (filename, content, "text/plain")},
    )


def listed(client: TestClient, login_as: Login, who: str = "supervisor", **params: str) -> list[dict[str, Any]]:
    r = client.get("/api/kb/documents", headers=login_as(who), params=params)
    assert r.status_code == 200, r.text
    validate(r.json(), "KbDocumentListResponse")
    return r.json()["data"]


def find(client: TestClient, login_as: Login, document_id: str) -> dict[str, Any]:
    return next(d for d in listed(client, login_as) if d["id"] == document_id)


# ------------------------------------------------------------------ list


def test_staff_see_every_banks_bluebook_and_viewers_only_their_own(client: TestClient, login_as: Login) -> None:
    published = listed(client, login_as, "operator", status="published")
    assert {"bank_a", "bank_b", "bank_c", "bank_d", "bank_e"} <= {d["bank_id"] for d in published}
    assert all(d["audience"] in ("victim_facing", "staff_only") for d in published)
    own = listed(client, login_as, "viewer_b")
    asked_for_a = listed(client, login_as, "viewer_b", bank_id="bank_a")
    assert own and {d["bank_id"] for d in own} == {d["bank_id"] for d in asked_for_a} == {"bank_b"}
    assert {d["bank_id"] for d in listed(client, login_as, "operator", bank_id="bank_c")} == {"bank_c"}
    assert client.get("/api/kb/documents", headers=login_as("victim1")).status_code == 403


# ------------------------------------------------------------------ upload, index, publish, archive


def test_upload_indexes_in_the_background_then_publish_replaces_the_old_version(
    client: TestClient, login_as: Login
) -> None:
    old = next(d for d in listed(client, login_as, bank_id="bank_e", status="published") if d["title"] == EMBER_TITLE)

    r = upload(client, login_as, title=EMBER_TITLE, version="2026.2")
    assert r.status_code == 201, r.text
    validate(r.json(), "KbDocumentResponse")
    new = r.json()["data"]
    assert (new["status"], new["passage_count"], new["uploaded_by"]["name"]) == ("processing", None, "Supervisor Sato")

    indexed = find(client, login_as, new["id"])  # TestClient runs the background task before returning
    assert (indexed["status"], indexed["passage_count"], indexed["error"]) == ("ready", 3, None)

    published = client.post(f"/api/kb/documents/{new['id']}/publish", headers=login_as("supervisor"))
    assert published.status_code == 200
    validate(published.json(), "KbDocumentResponse")
    assert published.json()["data"]["status"] == "published" and published.json()["data"]["published_at"]
    assert find(client, login_as, old["id"])["status"] == "archived"

    again = client.post(f"/api/kb/documents/{new['id']}/publish", headers=login_as("supervisor"))
    assert again.status_code == 409
    assert again.json()["error"]["details"] == {"from": "published", "to": "published", "allowed": []}

    archived = client.post(f"/api/kb/documents/{new['id']}/archive", headers=login_as("supervisor"))
    assert archived.status_code == 200 and archived.json()["data"]["status"] == "archived"
    twice = client.post(f"/api/kb/documents/{new['id']}/archive", headers=login_as("supervisor"))
    assert twice.json()["data"]["status"] == "archived"


def test_a_file_without_numbered_sections_fails_with_a_reason(client: TestClient, login_as: Login) -> None:
    doc = upload(client, login_as, content=b"Just a paragraph with no numbered headings at all.\n").json()["data"]
    failed = find(client, login_as, doc["id"])
    assert failed["status"] == "failed" and "numbered sections" in failed["error"]
    r = client.post(f"/api/kb/documents/{doc['id']}/publish", headers=login_as("supervisor"))
    assert (r.status_code, r.json()["error"]["code"]) == (409, "INVALID_STATUS_TRANSITION")


def test_upload_checks_the_file_type_size_and_fields(client: TestClient, login_as: Login) -> None:
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
    bad_type = upload(client, login_as, content=png, filename="guide.txt")
    assert (bad_type.status_code, bad_type.json()["error"]["code"]) == (400, "BAD_REQUEST")
    big = upload(client, login_as, content=b"1 Big\n" + b"x" * (20 * 1024 * 1024))
    assert (big.status_code, big.json()["error"]["code"]) == (413, "FILE_TOO_LARGE")
    assert upload(client, login_as, language="fr").status_code == 422
    assert upload(client, login_as, audience="everyone").status_code == 422
    assert upload(client, login_as, bank_id="bank_z").status_code == 422


def test_only_supervisors_manage_bluebooks(client: TestClient, login_as: Login) -> None:
    form = {"bank_id": "bank_e", "title": "x", "version": "1", "language": "en"}
    files = {"file": ("g.txt", SYNTHETIC_TXT, "text/plain")}
    for who in ("operator", "viewer_b", "victim1"):
        assert client.post("/api/kb/documents", headers=login_as(who), data=form, files=files).status_code == 403
    missing = "/api/kb/documents/00000000-0000-4000-8000-000000000000"
    assert client.post(f"{missing}/publish", headers=login_as("supervisor")).status_code == 404
    assert client.post(f"{missing}/archive", headers=login_as("supervisor")).status_code == 404
    assert client.post(f"{missing}/archive", headers=login_as("operator")).status_code == 403


def test_a_real_pdf_bluebook_indexes_into_the_same_passages_as_the_seed(client: TestClient, login_as: Login) -> None:
    import json
    from pathlib import Path

    folder = Path(__file__).resolve().parents[2] / "seed_data" / "bluebooks"
    expected = sum(
        1 for p in json.loads((folder / "kb_passages.json").read_text(encoding="utf-8")) if p["bank_id"] == "bank_a"
    )
    r = client.post(
        "/api/kb/documents",
        headers=login_as("supervisor"),
        data={
            "bank_id": "bank_a",
            "title": "Aster PDF re-index check",
            "version": "pdf-1",
            "language": "en",
            "audience": "staff_only",
        },
        files={"file": ("bank_a_bluebook.pdf", (folder / "bank_a_bluebook.pdf").read_bytes(), "application/pdf")},
    )
    assert r.status_code == 201, r.text
    indexed = find(client, login_as, r.json()["data"]["id"])
    assert (indexed["status"], indexed["audience"], indexed["passage_count"]) == ("ready", "staff_only", expected)
