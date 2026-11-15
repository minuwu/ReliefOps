"""A13: concurrency and failure guarantees across my services (guide §8.3, §8.6)."""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from uuid import UUID, uuid4

import pytest
from sqlalchemy import Engine, text
from sqlmodel import Session

from app import db
from app.models.victim_cases import VictimCaseUpdate, VictimReport
from app.services import case_sql, documents, extraction, extraction_engine, victim_cases
from app.services.caller import StaticCaller
from app.services.service_errors import ServiceError

from .conftest import insert_case, insert_user, set_scope


@pytest.fixture(autouse=True)
def _banks_exist(world: dict[str, str]) -> None:
    """The shared world creates the banks every case here belongs to."""


def fresh_victim(owner_engine: Engine) -> StaticCaller:
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        user_id = insert_user(conn, f"a13-{uuid4().hex[:10]}@test.test", "victim")
    return StaticCaller(user_id=UUID(user_id), name="a13 victim", role="victim")


def new_case(owner_engine: Engine, **columns: Any) -> UUID:
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        return UUID(insert_case(conn, "bank_d", **columns))


def run_together(count: int, fn: Any) -> list[str]:
    """Start ``count`` calls at the same moment; return 'ok' or each error code."""
    barrier = threading.Barrier(count)

    def one(i: int) -> str:
        barrier.wait()
        try:
            fn(i)
            return "ok"
        except ServiceError as exc:
            return exc.code

    with ThreadPoolExecutor(count) as pool:
        return list(pool.map(one, range(count)))


def test_two_victim_edits_with_one_version_one_wins(app_db: Engine, owner_engine: Engine) -> None:
    victim = fresh_victim(owner_engine)
    case_id = new_case(owner_engine, victim_user_id=str(victim.user_id), status="verified", victim_phone="+81-90-0000-0001")

    def edit(i: int) -> None:
        with db.scoped_session(victim.scope()) as s:
            victim_cases.update_case(s, victim, case_id, VictimCaseUpdate.model_validate(
                {"expected_version": 1, "victim": {"phone": f"+81-90-1111-000{i}"}}))

    assert sorted(run_together(2, edit)) == ["STALE_CASE", "ok"]
    with db.system_session() as s:
        updates = s.exec(text("select count(*) from audit_log where case_id = :id and action = 'case.updated'")
                         .bindparams(id=case_id)).scalar_one()
        assert case_sql.require_case(s, case_id)["version"] == 2
    assert updates == 1  # exactly one audit entry for the one edit that won


def test_a_failed_commit_saves_nothing(app_db: Engine, owner_engine: Engine, monkeypatch: pytest.MonkeyPatch) -> None:
    victim = fresh_victim(owner_engine)
    report = VictimReport.model_validate({
        "bank_id": "bank_d", "victim": {"name": "Commit Test", "phone": "+81-90-0000-0300"},
        "amount": 1000, "transfer_date": "2026-11-01", "scam_type": "phishing", "consent": True,
    })

    def broken_commit(self: Session) -> None:
        raise RuntimeError("database went away during commit")

    with monkeypatch.context() as patched:
        patched.setattr(Session, "commit", broken_commit)
        with db.scoped_session(victim.scope()) as s, pytest.raises(RuntimeError):
            victim_cases.create_report(s, victim, report)

    with db.system_session() as s:
        cases = s.exec(text("select count(*) from cases where victim_user_id = :v").bindparams(v=victim.user_id)).scalar_one()
        entries = s.exec(text("select count(*) from audit_log where actor_id = :v").bindparams(v=victim.user_id)).scalar_one()
    assert (cases, entries) == (0, 0)  # neither the case nor its audit entry survived


def test_parallel_uploads_count_every_document(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    case_id = new_case(owner_engine)
    operator = callers["operator"]

    def upload(i: int) -> None:
        with db.scoped_session(operator.scope()) as s:
            documents.upload_document(s, operator, case_id, data=f"Receipt {i}\nAmount: {i}000 yen\n".encode(),
                                      filename=f"r{i}.txt", doc_type="transfer_receipt")

    assert run_together(6, upload) == ["ok"] * 6
    with db.system_session() as s:
        rows = s.exec(text("select count(*) from documents where case_id = :id").bindparams(id=case_id)).scalar_one()
        assert case_sql.require_case(s, case_id)["document_count"] == rows == 6


def test_parallel_reruns_keep_the_pending_counter_true(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    case_id = new_case(owner_engine)
    operator = callers["operator"]
    with db.scoped_session(operator.scope()) as s:
        doc_id = UUID(documents.upload_document(s, operator, case_id, data=b"Amount: 5,000 yen\n",
                                                filename="r.txt", doc_type="transfer_receipt").id)
    settings = extraction.ExtractionSettings(
        ai=lambda *_: {"fields": [{"name": "amount", "value": 5000, "confidence": 0.9}]},
        ai_caller=extraction_engine.AICaller(max_concurrent=4),
    )

    def rerun(i: int) -> None:
        with db.scoped_session(operator.scope()) as s:
            extraction.run_extraction(s, operator, doc_id, settings)

    assert run_together(4, rerun) == ["ok"] * 4
    with db.system_session() as s:
        pending = s.exec(text("select count(*) from ai_extractions where case_id = :id and status = 'pending_review'")
                         .bindparams(id=case_id)).scalar_one()
        assert case_sql.require_case(s, case_id)["pending_extraction_count"] == pending >= 1
