"""app/services/review_queue.py: pending AI results, riskiest first (API_SPEC §6.5)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

import pytest
from sqlalchemy import Engine

from app import db
from app.models.common import PageParams
from app.models.review import ReviewRequest
from app.services import documents, extraction, extraction_engine, review, review_queue
from app.services.service_errors import ServiceError

from .conftest import insert_case, set_scope


def ai(confidence: float) -> Any:
    def fake(*_: Any) -> dict[str, Any]:
        return {"fields": [{"name": "amount", "value": 1000, "confidence": confidence}], "model": "m"}
    return fake


def extraction_for(owner_engine: Engine, callers: dict, bank_id: str, confidence: float,
                   assigned: str | None = None) -> tuple[UUID, UUID]:
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        case_id = UUID(insert_case(conn, bank_id, assigned_operator_id=assigned))
    op = callers["operator"]
    with db.scoped_session(op.scope()) as s:
        doc = documents.upload_document(s, op, case_id, data=b"Amount: 1,000 yen\n", filename=f"{bank_id}.txt",
                                        doc_type="transfer_receipt")
    settings = extraction.ExtractionSettings(ai=ai(confidence), ai_caller=extraction_engine.AICaller())
    with db.scoped_session(op.scope()) as s:
        return case_id, UUID(extraction.run_extraction(s, op, UUID(doc.id), settings).id)


def queue(caller, **kwargs: Any):  # noqa: ANN001, ANN201
    with db.scoped_session(caller.scope()) as s:
        return review_queue.review_queue(s, caller, paging=PageParams(page_size=100), **kwargs)


def test_low_confidence_first_then_oldest(app_db: Engine, owner_engine: Engine, callers: dict, world: dict) -> None:
    _, standard = extraction_for(owner_engine, callers, "bank_c", 0.95, assigned=world["operator"])
    _, low = extraction_for(owner_engine, callers, "bank_c", 0.60)
    items = [i for i in queue(callers["operator"], bank_id="bank_c").items
             if UUID(i.extraction_id) in {standard, low}]
    assert [UUID(i.extraction_id) for i in items] == [low, standard]
    first, second = items
    assert (first.review_lane, second.review_lane) == ("low_confidence", "standard")
    assert second.assigned_operator is not None and second.assigned_operator.name == "operator"
    assert first.assigned_operator is None
    assert (first.bank_name, first.document_filename, first.source) == ("Cedar Test Bank", "bank_c.txt", "llm")
    lanes = [i.review_lane for i in queue(callers["operator"]).items]
    assert lanes == sorted(lanes, key=lambda lane: lane != "low_confidence")  # every low one before any standard


def test_reviewed_results_leave_the_queue(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    case_id, ext_id = extraction_for(owner_engine, callers, "bank_d", 0.9)
    with db.scoped_session(callers["operator"].scope()) as s:
        review.review_extraction(s, callers["operator"], ext_id,
                                 ReviewRequest(decision="reject", expected_version=1, note="Not relevant"))
    assert str(ext_id) not in {i.extraction_id for i in queue(callers["operator"]).items}


def test_filters_by_lane_and_bank(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    extraction_for(owner_engine, callers, "bank_e", 0.95)
    extraction_for(owner_engine, callers, "bank_e", 0.50)
    standard = queue(callers["supervisor"], lane="standard", bank_id="bank_e")
    assert standard.total == 1 and standard.items[0].review_lane == "standard"
    assert {i.bank_id for i in queue(callers["supervisor"], bank_id="bank_e").items} == {"bank_e"}


def test_pagination_reports_the_total(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    with db.scoped_session(callers["operator"].scope()) as s:
        page = review_queue.review_queue(s, callers["operator"], paging=PageParams(page=1, page_size=1))
    assert len(page.items) == 1 and page.total >= 2


@pytest.mark.parametrize(("kwargs", "field"), [({"lane": "urgent"}, "lane"), ({"bank_id": "bank_z"}, "bank_id")])
def test_bad_filters_are_422(app_db: Engine, callers: dict, kwargs: dict, field: str) -> None:
    with pytest.raises(ServiceError) as caught:
        queue(callers["operator"], **kwargs)
    assert caught.value.code == "VALIDATION_ERROR" and caught.value.details["fields"][0]["field"] == field


@pytest.mark.parametrize("who", ["viewer_a", "victim1"])
def test_only_staff_see_the_queue(app_db: Engine, callers: dict, who: str) -> None:
    with pytest.raises(ServiceError) as caught:
        queue(callers[who])
    assert caught.value.status == 403
