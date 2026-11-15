"""app/services/history.py: case history, CSV export and the audit log (API_SPEC §6.4)."""

from __future__ import annotations

import csv
import io
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from sqlalchemy import Engine, text

from app import db
from app.models.common import PageParams
from app.models.history import AuditFilters
from app.services import audit, history
from app.services.service_errors import ServiceError

from .conftest import insert_case, set_scope


def new_case_with_entries(owner_engine: Engine, bank_id: str, summaries: list[str]) -> UUID:
    """A fresh case with one audit entry per summary, one second apart (oldest first)."""
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        case_id = UUID(insert_case(conn, bank_id))
    start = datetime.now(UTC) - timedelta(hours=1)
    with db.system_session() as s:
        stub = type("Case", (), {"id": case_id, "bank_id": bank_id})()
        for i, summary in enumerate(summaries):
            audit.record(s, action="case.updated", actor=audit.SYSTEM_ACTOR, summary=summary, case=stub,
                         at=start + timedelta(seconds=i))
        s.commit()
    return case_id


def test_history_is_newest_first_and_paginated(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    case_id = new_case_with_entries(owner_engine, "bank_a", ["first", "second", "third"])
    with db.scoped_session(callers["operator"].scope()) as s:
        page1 = history.case_history(s, callers["operator"], case_id, PageParams(page=1, page_size=2))
        page2 = history.case_history(s, callers["operator"], case_id, PageParams(page=2, page_size=2))
    assert [e.summary for e in page1.items] == ["third", "second"]
    assert [e.summary for e in page2.items] == ["first"]
    assert (page1.total, page1.page, page1.page_size) == (3, 1, 2)
    entry = page1.items[0]
    assert entry.case_reference and entry.case_reference.startswith("RFR-")
    assert (entry.actor.type, entry.actor.name, entry.bank_id) == ("system", "System", "bank_a")


def test_bank_viewer_reads_own_bank_history_only(app_db: Engine, callers: dict, world: dict[str, str]) -> None:
    with db.scoped_session(callers["viewer_a"].scope()) as s:
        own = history.case_history(s, callers["viewer_a"], UUID(world["case_a1"]))
    assert own.total >= 1 and all(e.bank_id == "bank_a" for e in own.items)
    with db.scoped_session(callers["viewer_a"].scope()) as s, pytest.raises(ServiceError) as caught:
        history.case_history(s, callers["viewer_a"], UUID(world["case_b1"]))
    assert (caught.value.status, caught.value.code) == (404, "RESOURCE_NOT_FOUND")


def test_victims_cannot_read_staff_history(app_db: Engine, callers: dict, world: dict[str, str]) -> None:
    with db.scoped_session(callers["victim1"].scope()) as s, pytest.raises(ServiceError) as caught:
        history.case_history(s, callers["victim1"], UUID(world["case_b1"]))
    assert caught.value.status == 403


def test_csv_export_has_the_contract_columns_and_is_audited(app_db: Engine, owner_engine: Engine,
                                                            callers: dict) -> None:
    case_id = new_case_with_entries(owner_engine, "bank_b", ["Phone changed", "=HYPERLINK(\"http://x\")"])
    with db.scoped_session(callers["supervisor"].scope()) as s:
        filename, content = history.case_history_csv(s, callers["supervisor"], case_id)
    rows = list(csv.reader(io.StringIO(content)))
    assert rows[0] == ["at", "actor_name", "actor_role", "action", "summary"]
    assert [r[4] for r in rows[1:]] == ["'=HYPERLINK(\"http://x\")", "Phone changed"]  # formula neutralised
    assert filename.endswith("-history.csv")
    with db.system_session() as s:
        exports = s.exec(text("select metadata from audit_log where case_id = :id and action = 'export.generated'")
                         .bindparams(id=case_id)).scalars().all()
    assert exports == [{"format": "csv", "rows": 2}]


def test_supervisor_sees_all_banks_and_viewer_only_their_own(app_db: Engine, callers: dict,
                                                            world: dict[str, str]) -> None:
    big = PageParams(page_size=100)
    with db.scoped_session(callers["supervisor"].scope()) as s:
        everything = history.audit_logs(s, callers["supervisor"], paging=big)
    with db.scoped_session(callers["viewer_a"].scope()) as s:
        bank_a = history.audit_logs(s, callers["viewer_a"], paging=big)
    assert {"bank_a", "bank_b"} <= {e.bank_id for e in everything.items}
    assert bank_a.items and {e.bank_id for e in bank_a.items} == {"bank_a"}
    assert bank_a.total < everything.total


def test_operators_cannot_read_the_audit_log(app_db: Engine, callers: dict) -> None:
    with db.scoped_session(callers["operator"].scope()) as s, pytest.raises(ServiceError) as caught:
        history.audit_logs(s, callers["operator"])
    assert caught.value.status == 403


def test_audit_log_filters(app_db: Engine, owner_engine: Engine, callers: dict, world: dict[str, str]) -> None:
    case_id = new_case_with_entries(owner_engine, "bank_c", ["one", "two"])
    with db.scoped_session(callers["supervisor"].scope()) as s:
        by_case = history.audit_logs(s, callers["supervisor"], AuditFilters(case_id=case_id))
        by_action = history.audit_logs(s, callers["supervisor"], AuditFilters(action="case.created"))
        by_actor = history.audit_logs(s, callers["supervisor"], AuditFilters(actor_id=UUID(world["operator"])))
        future = history.audit_logs(s, callers["supervisor"],
                                    AuditFilters.model_validate({"from": datetime.now(UTC) + timedelta(days=1)}))
    assert by_case.total == 2
    assert by_action.items and {e.action for e in by_action.items} == {"case.created"}
    assert by_actor.items and {e.actor.id for e in by_actor.items} == {world["operator"]}
    assert future.total == 0


@pytest.mark.parametrize(
    "filters",
    [
        AuditFilters(action="case.deleted"),
        AuditFilters.model_validate({"from": "2026-11-15T00:00:00Z", "to": "2026-11-01T00:00:00Z"}),
    ],
)
def test_bad_audit_filters_are_422(app_db: Engine, callers: dict, filters: AuditFilters) -> None:
    with db.scoped_session(callers["supervisor"].scope()) as s, pytest.raises(ServiceError) as caught:
        history.audit_logs(s, callers["supervisor"], filters)
    assert (caught.value.status, caught.value.code) == (422, "VALIDATION_ERROR")


def test_page_size_is_capped_at_100() -> None:
    with pytest.raises(ValueError):
        PageParams(page_size=101)
    with pytest.raises(ValueError):
        PageParams(page=0)
