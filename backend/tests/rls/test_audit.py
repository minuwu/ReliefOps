"""app/services/audit.py: entries are written in the caller's transaction, as any role."""

from __future__ import annotations

import re
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

import pytest
from sqlalchemy import Engine, text
from sqlmodel import Session

from app import db
from app.models.audit import AUDIT_ACTIONS
from app.services import audit

from .conftest import _test_url


@dataclass(frozen=True)
class CaseStub:
    id: UUID
    bank_id: str


@pytest.fixture(scope="module")
def engine(migrated: object) -> Iterator[Engine]:
    engine = db.init_engine(_test_url("TEST_DATABASE_URL"))
    yield engine
    db.dispose_engine()


def entries(case_id: str, action: str | None = None) -> list[dict]:
    with db.system_session() as s:
        sql = "select actor_type, actor_id::text, actor_name, actor_role, action, bank_id, summary, changes, metadata " \
              "from audit_log where case_id = :case_id" + (" and action = :action" if action else "") + " order by at"
        params = {"case_id": UUID(case_id), **({"action": action} if action else {})}
        return [dict(row._mapping) for row in s.exec(text(sql).bindparams(**params))]


def actor_for(world: dict[str, str], key: str, role: str, actor_type: str = "user") -> audit.Actor:
    return audit.Actor(type=actor_type, id=UUID(world[key]), name=key, role=role)


def test_action_list_matches_the_database_check(engine: Engine, world: dict[str, str]) -> None:
    with db.system_session() as s:
        definition = s.exec(
            text("select pg_get_constraintdef(oid) from pg_constraint where conname = 'audit_log_action_check'")
        ).scalar_one()
    assert set(re.findall(r"'([a-z_.]+)'", definition)) == set(AUDIT_ACTIONS)


def test_record_writes_in_the_callers_transaction(engine: Engine, world: dict[str, str]) -> None:
    case = CaseStub(UUID(world["case_b2"]), "bank_b")
    operator = actor_for(world, "operator", "operator")
    with db.scoped_session(db.Scope(role="operator", user_id=operator.id)) as s:
        audit.record(
            s, action="case.updated", actor=operator, summary="Amount corrected", case=case,
            changes=audit.diff({"amount": Decimal("1000.00")}, {"amount": Decimal("1250.50")}),
        )
        s.commit()
    [entry] = entries(world["case_b2"], "case.updated")
    assert entry["bank_id"] == "bank_b"
    assert entry["actor_name"] == "operator" and entry["actor_role"] == "operator"
    assert entry["changes"] == {"amount": {"from": 1000.0, "to": 1250.5}}  # money as JSON numbers


def test_entry_is_lost_with_the_change_when_not_committed(engine: Engine, world: dict[str, str]) -> None:
    operator = actor_for(world, "operator", "operator")
    with db.scoped_session(db.Scope(role="operator", user_id=operator.id)) as s:
        audit.record(s, action="note.added", actor=operator, summary="Note", case=CaseStub(UUID(world["case_a1"]), "bank_a"))
    assert entries(world["case_a1"], "note.added") == []


def test_bank_viewer_and_victim_can_record_views(engine: Engine, world: dict[str, str]) -> None:
    viewer = actor_for(world, "viewer_a", "bank_viewer")
    with db.scoped_session(db.Scope(role="bank_viewer", user_id=viewer.id, bank_id="bank_a")) as s:
        assert audit.record_case_view(s, actor=viewer, case=CaseStub(UUID(world["case_a2"]), "bank_a"))
        s.commit()
    victim = actor_for(world, "victim1", "victim", "victim")
    with db.scoped_session(db.Scope(role="victim", user_id=victim.id, bank_id="bank_b")) as s:
        assert audit.record_case_view(s, actor=victim, case=CaseStub(UUID(world["case_b1"]), "bank_b"))
        s.commit()  # works although victims can't read audit_log back (no RETURNING)
    assert [e["actor_type"] for e in entries(world["case_b1"], "case.viewed")] == ["victim"]


def test_case_views_are_deduplicated_for_ten_minutes(engine: Engine, world: dict[str, str]) -> None:
    supervisor = actor_for(world, "supervisor", "supervisor")
    case = CaseStub(UUID(world["case_a1"]), "bank_a")
    start = datetime.now(UTC)
    with db.scoped_session(db.Scope(role="supervisor", user_id=supervisor.id)) as s:
        assert audit.record_case_view(s, actor=supervisor, case=case, now=start)
        assert not audit.record_case_view(s, actor=supervisor, case=case, now=start + timedelta(minutes=9))
        assert audit.record_case_view(s, actor=supervisor, case=case, now=start + timedelta(minutes=11))
        s.commit()
    views = [e for e in entries(world["case_a1"], "case.viewed") if e["actor_id"] == world["supervisor"]]
    assert len(views) == 2


def test_record_without_a_case_keeps_the_bank(engine: Engine, world: dict[str, str]) -> None:
    supervisor = actor_for(world, "supervisor", "supervisor")
    with db.scoped_session(db.Scope(role="supervisor", user_id=supervisor.id)) as s:
        audit.record(s, action="kb.document_published", actor=supervisor, summary="Bluebook published",
                     bank_id="bank_c", metadata={"version": "2026.1", "published_on": date(2026, 11, 15)})
        s.commit()
        row = s.exec(text("select bank_id, metadata from audit_log where action = 'kb.document_published'")).one()
    assert row.bank_id == "bank_c"
    assert row.metadata == {"version": "2026.1", "published_on": "2026-11-15"}


@pytest.mark.parametrize("key", ["password", "new_password", "token", "session_token", "Authorization"])
def test_secrets_are_refused(engine: Engine, world: dict[str, str], key: str) -> None:
    with db.system_session() as s, pytest.raises(ValueError, match="must not contain"):
        audit.record(s, action="auth.login", actor=audit.SYSTEM_ACTOR, summary="x", metadata={key: "x"})


def test_unknown_action_and_bank_mismatch_are_refused(engine: Engine, world: dict[str, str]) -> None:
    case = CaseStub(UUID(world["case_a1"]), "bank_a")
    with db.system_session() as s:
        with pytest.raises(ValueError, match="unknown audit action"):
            audit.record(s, action="case.deleted", actor=audit.SYSTEM_ACTOR, summary="x", case=case)
        with pytest.raises(ValueError, match="doesn't match"):
            audit.record(s, action="case.viewed", actor=audit.SYSTEM_ACTOR, summary="x", case=case, bank_id="bank_b")
        with pytest.raises(ValueError, match="summary is empty"):
            audit.record(s, action="case.viewed", actor=audit.SYSTEM_ACTOR, summary="   ", case=case)


def test_unscoped_session_cannot_write_audit_entries(engine: Engine, world: dict[str, str]) -> None:
    with Session(engine) as s, pytest.raises(Exception, match="row-level security"):
        audit.record(s, action="auth.login_failed", actor=audit.SYSTEM_ACTOR, summary="Failed login")


def test_long_summaries_are_shortened() -> None:
    assert len(audit._summary("x" * 900)) == audit.SUMMARY_MAX


def test_diff_reports_only_changed_fields() -> None:
    before = {"phone": "+81-1", "email": "a@test.test", "amount": Decimal("10.00")}
    after = {"phone": "+81-2", "email": "a@test.test", "amount": Decimal("10")}
    assert audit.diff(before, after) == {"phone": {"from": "+81-1", "to": "+81-2"}}
    assert audit.diff(before, {"email": "a@test.test"}) is None


def test_to_json_refuses_unknown_types() -> None:
    with pytest.raises(TypeError):
        audit.to_json(object())
