"""app/services/extraction.py: saving AI results safely (API_SPEC §6.5, guide §4.5 and §8.6)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import pytest
from sqlalchemy import Engine, text

from app import db
from app.services import case_sql, documents, extraction, extraction_engine
from app.services.ai_errors import AIUnavailableError
from app.services.service_errors import ServiceError

from .conftest import insert_case, set_scope

RECEIPT = b"Transfer amount: 250,000 yen\nDate: 2026-10-28\nAccount No. 0012345\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def answer(*fields: tuple[str, Any, float]) -> Any:
    def fake(file_bytes: bytes, mime_type: str, doc_type: str) -> dict[str, Any]:
        return {"fields": [{"name": n, "value": v, "confidence": c, "evidence": "seen"} for n, v, c in fields],
                "model": "test-model", "prompt_version": "extract-v1"}
    return fake


def ai_down(*_: Any) -> dict[str, Any]:
    raise AIUnavailableError("down")


def settings(ai: Any) -> extraction.ExtractionSettings:
    return extraction.ExtractionSettings(timeout=2, ai=ai, ai_caller=extraction_engine.AICaller(max_concurrent=2))


def case_with_document(owner_engine: Engine, callers: dict, data: bytes = RECEIPT, **columns: object) -> tuple[UUID, UUID]:
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        case_id = UUID(insert_case(conn, "bank_b", amount="1000.00", **columns))
    with db.scoped_session(callers["operator"].scope()) as s:
        meta = documents.upload_document(s, callers["operator"], case_id, data=data, filename="doc", doc_type="transfer_receipt")
    return case_id, UUID(meta.id)


def run(caller, document_id: UUID, ai: Any):  # noqa: ANN001, ANN201
    with db.scoped_session(caller.scope()) as s:
        return extraction.run_extraction(s, caller, document_id, settings(ai))


def case_row(case_id: UUID):  # noqa: ANN201
    with db.system_session() as s:
        return case_sql.require_case(s, case_id)


def test_confident_answer_is_saved_for_review_and_the_case_is_untouched(app_db: Engine, owner_engine: Engine,
                                                                       callers: dict) -> None:
    case_id, doc_id = case_with_document(owner_engine, callers)
    result = run(callers["operator"], doc_id, answer(("amount", 250000, 0.95), ("account_number", "0012345", 0.9)))
    assert (result.status, result.source, result.review_lane, result.overall_confidence) == (
        "pending_review", "llm", "standard", 0.9)
    amount = next(f for f in result.fields if f.name == "amount")
    assert (amount.value, amount.current_case_value, amount.final_value) == (250000, 1000.0, None)
    case = case_row(case_id)
    assert case["amount"] == 1000 and case["version"] == 1  # only a person's review changes the case (D3)
    assert case["pending_extraction_count"] == 1
    with db.system_session() as s:
        meta = s.exec(text("select metadata from audit_log where case_id = :id and action = 'ai.extraction_completed'")
                      .bindparams(id=case_id)).scalar_one()
    assert meta["extraction_id"] == result.id and meta["overall_confidence"] == 0.9


def test_ai_down_on_text_saves_a_fallback(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    _, doc_id = case_with_document(owner_engine, callers)
    result = run(callers["operator"], doc_id, ai_down)
    assert (result.status, result.source, result.review_lane) == ("pending_review", "rules_fallback", "low_confidence")
    assert result.error is not None and result.error.reason == "ai_unavailable"


def test_ai_down_on_an_image_saves_a_failed_extraction(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    case_id, doc_id = case_with_document(owner_engine, callers, PNG)
    result = run(callers["supervisor"], doc_id, ai_down)
    assert (result.status, result.fields, result.review_lane) == ("failed", [], None)
    assert case_row(case_id)["pending_extraction_count"] == 0
    with db.system_session() as s:
        actions = s.exec(text("select action from audit_log where case_id = :id and action like 'ai.%'")
                         .bindparams(id=case_id)).scalars().all()
    assert actions == ["ai.extraction_failed"]


def test_prompt_injection_output_fails_and_changes_nothing(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    case_id, doc_id = case_with_document(owner_engine, callers)
    result = run(callers["operator"], doc_id, answer(("status", "closed", 0.99)))
    assert (result.status, result.error.reason) == ("failed", "invalid_ai_output")
    case = case_row(case_id)
    assert (case["status"], case["version"], case["assigned_operator_id"]) == ("received", 1, None)


def test_rerun_supersedes_the_older_pending_result(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    case_id, doc_id = case_with_document(owner_engine, callers)
    first = run(callers["operator"], doc_id, answer(("amount", 1, 0.9)))
    second = run(callers["operator"], doc_id, answer(("amount", 2, 0.9)))
    with db.scoped_session(callers["operator"].scope()) as s:
        old = extraction.get_extraction(s, callers["operator"], UUID(first.id))
    assert (old.status, old.review_note, old.reviewed_by.name) == ("rejected", "superseded", "operator")
    assert second.status == "pending_review"
    assert case_row(case_id)["pending_extraction_count"] == 1


def test_no_transaction_is_held_while_the_ai_works(app_db: Engine, app_engine: Engine, owner_engine: Engine,
                                                   callers: dict) -> None:
    _, doc_id = case_with_document(owner_engine, callers)
    seen: list[int] = []

    def watching_ai(*_: Any) -> dict[str, Any]:
        with app_engine.connect() as conn:  # same role, so it may read the other sessions' state
            seen.append(conn.exec_driver_sql(
                "select count(*) from pg_stat_activity where usename = current_user "
                "and state = 'idle in transaction' and pid <> pg_backend_pid()").scalar_one())
        return {"fields": [{"name": "amount", "value": 1, "confidence": 0.9}]}

    run(callers["operator"], doc_id, watching_ai)
    assert seen == [0]


@pytest.mark.parametrize("who", ["viewer_b", "victim1"])
def test_only_staff_run_or_read_extractions(app_db: Engine, owner_engine: Engine, callers: dict, who: str) -> None:
    _, doc_id = case_with_document(owner_engine, callers)
    with pytest.raises(ServiceError) as caught:
        run(callers[who], doc_id, answer(("amount", 1, 0.9)))
    assert caught.value.status == 403
    with db.scoped_session(callers[who].scope()) as s, pytest.raises(ServiceError):
        extraction.get_extraction(s, callers[who], uuid4())


def test_closed_case_cannot_be_extracted(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    case_id, doc_id = case_with_document(owner_engine, callers)
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        conn.exec_driver_sql("update cases set status = 'closed', closed_at = %s, closure_reason = 'withdrawn' "
                             "where id = %s", (datetime.now(UTC), case_id))
    with pytest.raises(ServiceError) as caught:
        run(callers["operator"], doc_id, answer(("amount", 1, 0.9)))
    assert caught.value.code == "CASE_CLOSED"


def test_unknown_document_and_extraction_are_404(app_db: Engine, callers: dict) -> None:
    with pytest.raises(ServiceError) as caught:
        run(callers["operator"], uuid4(), answer(("amount", 1, 0.9)))
    assert caught.value.status == 404
    with db.scoped_session(callers["operator"].scope()) as s, pytest.raises(ServiceError) as caught:
        extraction.get_extraction(s, callers["operator"], uuid4())
    assert caught.value.status == 404
