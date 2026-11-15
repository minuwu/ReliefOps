"""app/db.py: every transaction carries its scope (guide §4.2 rule 1)."""

from __future__ import annotations

from collections.abc import Iterator
from uuid import UUID

import pytest
from sqlalchemy import Engine, text
from sqlmodel import Session

from app import db

from .conftest import _test_url, insert_case, set_scope


@pytest.fixture(scope="module")
def engine(migrated: object) -> Iterator[Engine]:
    # One pooled connection, so the leak test really reuses the same connection.
    engine = db.init_engine(_test_url("TEST_DATABASE_URL"), pool_size=1, max_overflow=0)
    yield engine
    db.dispose_engine()


def setting(s: Session, name: str) -> str:
    return s.exec(text(f"select current_setting('app.{name}', true)")).scalar_one()


def case_ids(s: Session) -> set[str]:
    return set(s.exec(text("select id::text from cases")).scalars())


def operator_scope(world: dict[str, str]) -> db.Scope:
    return db.Scope(role="operator", user_id=UUID(world["operator"]))


def test_scope_is_applied(engine: Engine, world: dict[str, str]) -> None:
    with db.scoped_session(operator_scope(world)) as s:
        assert setting(s, "role") == "operator"
        assert setting(s, "user_id") == world["operator"]
        assert setting(s, "bank_id") == ""


def test_scope_survives_commit_and_rollback(engine: Engine, world: dict[str, str]) -> None:
    with db.scoped_session(operator_scope(world)) as s:
        assert setting(s, "role") == "operator"
        s.commit()
        assert setting(s, "role") == "operator"  # a new transaction, scope applied again
        s.rollback()
        assert setting(s, "role") == "operator"


def test_session_without_scope_sees_nothing(engine: Engine, world: dict[str, str]) -> None:
    with Session(engine) as s:
        assert setting(s, "role") in ("", None)
        assert case_ids(s) == set()


def test_scope_does_not_leak_to_the_next_pooled_connection(engine: Engine, world: dict[str, str]) -> None:
    with db.scoped_session(operator_scope(world)) as s:
        assert case_ids(s)
        s.commit()
    with Session(engine) as s:  # same single pooled connection, no scope
        assert setting(s, "role") in ("", None)
        assert case_ids(s) == set()


def test_bank_viewer_scope_sees_only_own_bank(engine: Engine, world: dict[str, str]) -> None:
    scope = db.Scope(role="bank_viewer", user_id=UUID(world["viewer_a"]), bank_id="bank_a")
    with db.scoped_session(scope) as s:
        banks = set(s.exec(text("select distinct bank_id from cases")).scalars())
    assert banks == {"bank_a"}


def test_victim_scope_sees_only_own_case(engine: Engine, world: dict[str, str]) -> None:
    scope = db.Scope(role="victim", user_id=UUID(world["victim1"]), bank_id="bank_b")
    with db.scoped_session(scope) as s:
        owners = set(s.exec(text("select victim_user_id::text from cases")).scalars())
        ids = case_ids(s)
    assert owners == {world["victim1"]}  # every visible case is theirs
    assert world["case_b1"] in ids and world["case_a2"] not in ids


def test_system_session_reads_auth_tables(engine: Engine, world: dict[str, str]) -> None:
    with db.system_session() as s:
        assert s.exec(text("select count(*) from sessions")).scalar_one() == 1
    with db.scoped_session(operator_scope(world)) as s:
        assert s.exec(text("select count(*) from sessions")).scalar_one() == 0


def test_scope_values_are_bound_parameters(engine: Engine, world: dict[str, str]) -> None:
    scope = db.Scope(role="bank_viewer", user_id=UUID(world["viewer_a"]), bank_id="bank_a' or '1'='1")
    with db.scoped_session(scope) as s:
        assert case_ids(s) == set()


def test_uncommitted_work_is_rolled_back_on_exit(engine: Engine, world: dict[str, str]) -> None:
    with db.scoped_session(operator_scope(world)) as s:
        s.exec(text("update cases set victim_phone = 'uncommitted' where id = :id").bindparams(id=UUID(world["case_b2"])))
    with db.system_session() as s:
        phone = s.exec(text("select victim_phone from cases where id = :id").bindparams(id=UUID(world["case_b2"]))).scalar_one()
    assert phone != "uncommitted"


def test_committed_work_is_saved(engine: Engine, owner_engine: Engine, world: dict[str, str]) -> None:
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        case_id = insert_case(conn, "bank_c")
    with db.scoped_session(operator_scope(world)) as s:
        s.exec(text("update cases set victim_phone = '+81-90-5555-0000' where id = :id").bindparams(id=UUID(case_id)))
        s.commit()
    with db.system_session() as s:
        phone = s.exec(text("select victim_phone from cases where id = :id").bindparams(id=UUID(case_id))).scalar_one()
    assert phone == "+81-90-5555-0000"


@pytest.mark.parametrize(
    ("kwargs", "message"),
    [
        ({"role": "admin"}, "unknown scope role"),
        ({"role": "bank_viewer"}, "needs a bank_id"),
        ({"role": "victim"}, "needs a user_id"),
    ],
)
def test_invalid_scopes_are_rejected(kwargs: dict[str, str], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        db.Scope(**kwargs)


def test_get_engine_before_init_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(db, "_engine", None)
    with pytest.raises(RuntimeError, match="init_engine"):
        db.get_engine()
