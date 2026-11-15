"""app/services/review.py: only a person's review changes the case (API_SPEC §6.5, D3)."""

from __future__ import annotations

import threading
from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy import Engine, text

from app import db
from app.models.review import ReviewRequest
from app.services import case_sql, documents, extraction, extraction_engine, review
from app.services.service_errors import ServiceError

from .conftest import insert_case, set_scope

FORM = b"Paper intake form\nName: Paper Victim\n"


def ai(*fields: tuple[str, Any, float]) -> Any:
    def fake(*_: Any) -> dict[str, Any]:
        return {"fields": [{"name": n, "value": v, "confidence": c, "evidence": "seen"} for n, v, c in fields],
                "model": "test-model", "prompt_version": "extract-v1"}
    return fake


def pending_extraction(owner_engine: Engine, callers: dict, **case_columns: object) -> tuple[UUID, UUID]:
    """A bank_b case with one document and one pending extraction (amount 250000, account 0012345)."""
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        case_id = UUID(insert_case(conn, "bank_b", channel="paper", amount="1000.00", **case_columns))
    op = callers["operator"]
    with db.scoped_session(op.scope()) as s:
        doc = documents.upload_document(s, op, case_id, data=FORM, filename="form.txt", doc_type="intake_form")
    settings = extraction.ExtractionSettings(
        ai=ai(("amount", 250000, 0.95), ("account_number", "0012345", 0.62)),
        ai_caller=extraction_engine.AICaller(max_concurrent=2),
    )
    with db.scoped_session(op.scope()) as s:
        result = extraction.run_extraction(s, op, UUID(doc.id), settings)
    return case_id, UUID(result.id)


def do_review(caller, extraction_id: UUID, **body: Any):  # noqa: ANN001, ANN201
    with db.scoped_session(caller.scope()) as s:
        return review.review_extraction(s, caller, extraction_id, ReviewRequest.model_validate(body))


def case_row(case_id: UUID):  # noqa: ANN201
    with db.system_session() as s:
        return case_sql.require_case(s, case_id)


def audit_of(case_id: UUID, action: str) -> list[dict]:
    with db.system_session() as s:
        return [dict(r) for r in s.exec(text("select changes, metadata from audit_log where case_id = :id "
                                              "and action = :a").bindparams(id=case_id, a=action)).mappings()]


def test_partial_accept_writes_only_the_chosen_fields(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    case_id, ext_id = pending_extraction(owner_engine, callers)
    result = do_review(callers["operator"], ext_id, decision="accept", expected_version=1,
                       fields={"amount": 250000}, note="Checked against the scan.")
    assert result.extraction.status == "accepted" and result.extraction.reviewed_by.name == "operator"
    finals = {f.name: f.final_value for f in result.extraction.fields}
    assert finals == {"amount": 250000.0, "account_number": None}
    case = case_row(case_id)
    assert (case["amount"], case["account_number"], case["version"]) == (250000, None, 2)
    assert case["pending_extraction_count"] == 0 and result.case["version"] == 2
    [entry] = audit_of(case_id, "ai.review_accepted")
    assert entry["changes"] == {"amount": {"from": 1000.0, "to": 250000.0}}
    assert entry["metadata"]["fields"] == [{"name": "amount", "ai_value": 250000, "final_value": 250000.0}]


def test_accepting_every_required_field_clears_missing_fields(app_db: Engine, owner_engine: Engine,
                                                              callers: dict) -> None:
    case_id, ext_id = pending_extraction(owner_engine, callers)
    do_review(callers["operator"], ext_id, decision="accept", expected_version=1, fields={
        "victim_phone": "+81-90-0000-0102", "amount": 250000, "transfer_date": "2026-10-28",
        "account_number": "0012345", "scam_type": "impersonation",
    })
    case = case_row(case_id)
    assert case_sql.missing_fields(case) == []
    assert (case["transfer_date"], case["scam_type"]) == (date(2026, 10, 28), "impersonation")
    with db.scoped_session(callers["operator"].scope()) as s:
        ext = extraction.get_extraction(s, callers["operator"], ext_id)
    added = next(f for f in ext.fields if f.name == "victim_phone")
    assert (added.value, added.final_value) == (None, "+81-90-0000-0102")  # added by the person, not the AI


def test_reject_needs_a_note_and_leaves_the_case_alone(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    case_id, ext_id = pending_extraction(owner_engine, callers)
    with pytest.raises(ServiceError) as caught:
        do_review(callers["operator"], ext_id, decision="reject", expected_version=1, note="  ")
    assert (caught.value.status, caught.value.code) == (422, "VALIDATION_ERROR")
    result = do_review(callers["operator"], ext_id, decision="reject", expected_version=1,
                       note="Wrong document — another victim's receipt.")
    assert result.extraction.status == "rejected"
    case = case_row(case_id)
    assert (case["amount"], case["version"], case["pending_extraction_count"]) == (1000, 1, 0)
    assert len(audit_of(case_id, "ai.review_rejected")) == 1


@pytest.mark.parametrize(
    ("fields", "field"),
    [
        ({"amount": -5}, "fields.amount"),
        ({"transfer_date": "28 Oct"}, "fields.transfer_date"),
        ({"scam_type": "wire_fraud"}, "fields.scam_type"),
        ({"victim_email": "not-an-email"}, "fields.victim_email"),
    ],
)
def test_bad_values_are_422_and_nothing_changes(app_db: Engine, owner_engine: Engine, callers: dict,
                                                fields: dict, field: str) -> None:
    case_id, ext_id = pending_extraction(owner_engine, callers)
    with pytest.raises(ServiceError) as caught:
        do_review(callers["operator"], ext_id, decision="accept", expected_version=1, fields=fields)
    assert caught.value.code == "VALIDATION_ERROR" and caught.value.details["fields"][0]["field"] == field
    assert case_row(case_id)["version"] == 1


def test_accept_without_fields_is_422(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    _, ext_id = pending_extraction(owner_engine, callers)
    with pytest.raises(ServiceError) as caught:
        do_review(callers["operator"], ext_id, decision="accept", expected_version=1, fields={})
    assert caught.value.code == "VALIDATION_ERROR"


def test_second_review_is_already_reviewed(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    _, ext_id = pending_extraction(owner_engine, callers)
    do_review(callers["operator"], ext_id, decision="accept", expected_version=1, fields={"amount": 250000})
    with pytest.raises(ServiceError) as caught:
        do_review(callers["supervisor"], ext_id, decision="reject", expected_version=2, note="x")
    assert (caught.value.status, caught.value.code) == (409, "ALREADY_REVIEWED")


def test_stale_version_keeps_the_extraction_pending(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    _, ext_id = pending_extraction(owner_engine, callers)
    with pytest.raises(ServiceError) as caught:
        do_review(callers["operator"], ext_id, decision="accept", expected_version=7, fields={"amount": 1})
    assert caught.value.code == "STALE_CASE"
    with db.scoped_session(callers["operator"].scope()) as s:
        assert extraction.get_extraction(s, callers["operator"], ext_id).status == "pending_review"


def test_closed_case_cannot_be_reviewed(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    case_id, ext_id = pending_extraction(owner_engine, callers)
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        conn.exec_driver_sql("update cases set status = 'closed', closed_at = %s, closure_reason = 'withdrawn' "
                             "where id = %s", (datetime.now(UTC), case_id))
    with pytest.raises(ServiceError) as caught:
        do_review(callers["operator"], ext_id, decision="accept", expected_version=1, fields={"amount": 1})
    assert caught.value.code == "CASE_CLOSED"


def test_only_staff_review(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    _, ext_id = pending_extraction(owner_engine, callers)
    with pytest.raises(ServiceError) as caught:
        do_review(callers["viewer_b"], ext_id, decision="reject", expected_version=1, note="x")
    assert caught.value.status == 403


def test_two_reviewers_at_once_one_wins(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    _, ext_id = pending_extraction(owner_engine, callers)
    barrier = threading.Barrier(2)
    outcomes: list[str] = []

    def reviewer(who: str) -> None:
        barrier.wait()
        try:
            do_review(callers[who], ext_id, decision="accept", expected_version=1, fields={"amount": 250000})
            outcomes.append("ok")
        except ServiceError as exc:
            outcomes.append(exc.code)

    threads = [threading.Thread(target=reviewer, args=(w,)) for w in ("operator", "supervisor")]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(outcomes) == ["ALREADY_REVIEWED", "ok"]


def test_accepting_the_current_values_makes_no_new_version(app_db: Engine, owner_engine: Engine,
                                                           callers: dict) -> None:
    case_id, ext_id = pending_extraction(owner_engine, callers)
    result = do_review(callers["operator"], ext_id, decision="accept", expected_version=1, fields={"amount": 1000})
    assert result.case["version"] == 1 and case_row(case_id)["pending_extraction_count"] == 0
    assert audit_of(case_id, "ai.review_accepted")[0]["changes"] is None


@pytest.mark.parametrize(
    "body",
    [
        {"decision": "accept", "expected_version": 1, "fields": {"status": "closed"}},
        {"decision": "approve", "expected_version": 1},
        {"decision": "accept"},
        {"decision": "accept", "expected_version": 1, "fields": {"amount": 1}, "owner": "me"},
    ],
)
def test_bad_review_bodies_are_rejected_by_the_schema(body: dict) -> None:
    with pytest.raises(ValidationError):
        ReviewRequest.model_validate(body)
