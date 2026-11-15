"""app/services/case_sql.py: scoped case reads, atomic version checks, required info."""

from __future__ import annotations

import threading
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import Engine

from app import db
from app.services import case_sql
from app.services.service_errors import ServiceError

from .conftest import insert_case, set_scope


def new_case(owner_engine: Engine, bank_id: str = "bank_a", **columns: object) -> UUID:
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        return UUID(insert_case(conn, bank_id, **columns))


def test_missing_fields_follow_the_required_information_rule() -> None:
    empty = {"document_count": 0}
    assert case_sql.missing_fields(empty) == [
        "victim_contact", "amount", "transfer_date", "account_number", "scam_type", "document",
    ]
    complete = {
        "victim_email": "a@test.test", "amount": Decimal("1"), "transfer_date": "2026-10-28",
        "account_number": "0012345", "scam_type": "phishing", "document_count": 1,
    }
    assert case_sql.missing_fields(complete) == []
    assert case_sql.missing_fields({**complete, "victim_email": None, "victim_phone": "+81-1"}) == []


def test_stage_deadlines() -> None:
    start = datetime(2026, 11, 1, tzinfo=UTC)
    assert case_sql.deadline_for("received", start) == datetime(2026, 11, 8, tzinfo=UTC)
    assert case_sql.deadline_for("notice_published", start).day == 30
    assert case_sql.deadline_for("closed", start) is None


def test_other_banks_case_is_404_for_a_viewer(app_db: Engine, callers: dict, world: dict[str, str]) -> None:
    with db.scoped_session(callers["viewer_b"].scope()) as s, pytest.raises(ServiceError) as caught:
        case_sql.require_case(s, UUID(world["case_a1"]))
    assert (caught.value.status, caught.value.code) == (404, "RESOURCE_NOT_FOUND")
    with db.scoped_session(callers["operator"].scope()) as s:
        assert case_sql.require_case(s, UUID(world["case_a1"]))["bank_id"] == "bank_a"


def test_unknown_case_is_404(app_db: Engine, callers: dict, world: dict[str, str]) -> None:
    with db.scoped_session(callers["operator"].scope()) as s, pytest.raises(ServiceError, match="not found"):
        case_sql.require_case(s, uuid4())


def test_update_bumps_the_version(app_db: Engine, owner_engine: Engine, callers: dict, world: dict[str, str]) -> None:
    case_id = new_case(owner_engine)
    with db.scoped_session(callers["operator"].scope()) as s:
        row = case_sql.update_case(s, case_id, 1, {"victim_phone": "+81-90-1234-5678"})
        s.commit()
    assert (row["version"], row["victim_phone"]) == (2, "+81-90-1234-5678")


def test_stale_version_is_409_with_the_current_version(app_db: Engine, owner_engine: Engine, callers: dict,
                                                       world: dict[str, str]) -> None:
    case_id = new_case(owner_engine)
    with db.scoped_session(callers["operator"].scope()) as s:
        case_sql.update_case(s, case_id, 1, {"victim_phone": "+81-1"})
        s.commit()
        with pytest.raises(ServiceError) as caught:
            case_sql.update_case(s, case_id, 1, {"victim_phone": "+81-2"})
    assert (caught.value.status, caught.value.code, caught.value.details) == (409, "STALE_CASE", {"current_version": 2})


def test_viewer_update_of_a_visible_case_is_refused(app_db: Engine, owner_engine: Engine, callers: dict,
                                                    world: dict[str, str]) -> None:
    """RLS gives a bank viewer no UPDATE rows, so the write can't happen even if code forgot a role check."""
    case_id = new_case(owner_engine, "bank_a")
    with db.scoped_session(callers["viewer_a"].scope()) as s, pytest.raises(ServiceError) as caught:
        case_sql.update_case(s, case_id, 1, {"victim_phone": "+81-3"})
    assert (caught.value.status, caught.value.code) == (403, "FORBIDDEN")
    with db.system_session() as s:
        assert case_sql.require_case(s, case_id)["victim_phone"] is None


def test_two_edits_with_the_same_version_one_wins(app_db: Engine, owner_engine: Engine, callers: dict,
                                                  world: dict[str, str]) -> None:
    case_id = new_case(owner_engine)
    barrier = threading.Barrier(2)
    results: list[str] = []

    def edit(phone: str) -> None:
        with db.scoped_session(callers["operator"].scope()) as s:
            barrier.wait()
            try:
                case_sql.update_case(s, case_id, 1, {"victim_phone": phone})
                s.commit()
                results.append("ok")
            except ServiceError as exc:
                results.append(exc.code)

    threads = [threading.Thread(target=edit, args=(p,)) for p in ("+81-90-0000-0001", "+81-90-0000-0002")]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(results) == ["STALE_CASE", "ok"]
    with db.system_session() as s:
        assert case_sql.require_case(s, case_id)["version"] == 2


def test_closed_case_is_read_only(app_db: Engine, owner_engine: Engine, callers: dict, world: dict[str, str]) -> None:
    case_id = new_case(owner_engine, status="closed", closed_at=datetime.now(UTC), closure_reason="withdrawn")
    with db.scoped_session(callers["operator"].scope()) as s:
        case = case_sql.require_case(s, case_id)
        with pytest.raises(ServiceError) as caught:
            case_sql.require_open(case)
    assert (caught.value.status, caught.value.code) == (409, "CASE_CLOSED")


def test_bank_name(app_db: Engine, callers: dict, world: dict[str, str]) -> None:
    with db.scoped_session(callers["victim1"].scope()) as s:
        assert case_sql.bank_name(s, "bank_b") == "Birch Test Bank"
        assert case_sql.bank_name(s, "bank_x") == "bank_x"
