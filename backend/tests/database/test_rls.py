"""Migration 002: what the database alone enforces for app_user (guide §8.4, plan §5).

Every query runs as app_user, the account the app connects with, inside a
rolled-back transaction. No app code is involved, so these prove bank
separation holds even if a filter were missing in Python.
"""

from __future__ import annotations

import re

import pytest
from sqlalchemy import Connection
from sqlalchemy.exc import DBAPIError

from .conftest import set_scope

BANK_OWNED_TABLES = ("cases", "documents", "document_contents", "ai_extractions", "notes", "audit_log")
ALL_TABLES = (
    "banks", "users", "sessions", "auth_tokens", "invitations", "cases", "documents",
    "document_contents", "ai_extractions", "notes", "audit_log",
)


def count(conn: Connection, table: str, where: str = "true", params: tuple = ()) -> int:
    return conn.exec_driver_sql(f"select count(*) from {table} where {where}", params).scalar_one()


def expect_denied(conn: Connection, sql: str, params: tuple = (), message: str = "") -> None:
    """Run ``sql`` in a savepoint and assert the database refuses it."""
    savepoint = conn.begin_nested()
    with pytest.raises(DBAPIError) as caught:
        conn.exec_driver_sql(sql, params)
    savepoint.rollback()
    assert message in str(caught.value), caught.value


# ------------------------------------------------------------- no scope


@pytest.mark.parametrize("table", ALL_TABLES[1:])
def test_no_scope_sees_nothing(app_conn: Connection, world: dict[str, str], table: str) -> None:
    assert count(app_conn, table) == 0


@pytest.mark.parametrize("role", ["", "admin", "public", "Operator"])
def test_unknown_role_sees_no_cases(app_conn: Connection, world: dict[str, str], role: str) -> None:
    set_scope(app_conn, role)
    assert count(app_conn, "cases") == 0


def test_banks_are_readable_by_anyone(app_conn: Connection, world: dict[str, str]) -> None:
    assert count(app_conn, "banks") == 5


# ------------------------------------------------------------- bank viewers


@pytest.mark.parametrize("table", BANK_OWNED_TABLES)
def test_bank_a_viewer_sees_only_bank_a(app_conn: Connection, world: dict[str, str], table: str) -> None:
    set_scope(app_conn, "bank_viewer", world["viewer_a"], "bank_a")
    assert count(app_conn, table) > 0
    assert count(app_conn, table, "bank_id <> 'bank_a'") == 0


def test_bank_viewer_cannot_read_other_bank_case_by_id(app_conn: Connection, world: dict[str, str]) -> None:
    set_scope(app_conn, "bank_viewer", world["viewer_a"], "bank_a")
    assert count(app_conn, "cases", "id = %s", (world["case_b1"],)) == 0


def test_bank_viewer_without_bank_sees_nothing(app_conn: Connection, world: dict[str, str]) -> None:
    set_scope(app_conn, "bank_viewer", world["viewer_a"], None)
    assert count(app_conn, "cases") == 0


def test_bank_viewer_cannot_update_cases(app_conn: Connection, world: dict[str, str]) -> None:
    set_scope(app_conn, "bank_viewer", world["viewer_a"], "bank_a")
    updated = app_conn.exec_driver_sql(
        "update cases set victim_name = 'changed' where id = %s", (world["case_a1"],)
    ).rowcount
    assert updated == 0


def test_bank_viewer_cannot_insert_case_or_note(app_conn: Connection, world: dict[str, str]) -> None:
    set_scope(app_conn, "bank_viewer", world["viewer_a"], "bank_a")
    expect_denied(
        app_conn,
        "insert into cases (reference, bank_id, channel, victim_name) values ('RFR-2099-00003', 'bank_a', 'phone', 'X')",
        message="row-level security",
    )
    expect_denied(
        app_conn,
        "insert into notes (case_id, bank_id, author_id, body) values (%s, 'bank_a', %s, 'x')",
        (world["case_a1"], world["viewer_a"]),
        message="row-level security",
    )


def test_bank_viewer_sees_staff_names_but_not_victim_accounts(app_conn: Connection, world: dict[str, str]) -> None:
    set_scope(app_conn, "bank_viewer", world["viewer_a"], "bank_a")
    assert count(app_conn, "users", "role = 'victim'") == 0
    assert count(app_conn, "users", "id = %s", (world["operator"],)) == 1
    assert count(app_conn, "users", "id = %s", (world["viewer_b"],)) == 0


# ------------------------------------------------------------- staff


def test_staff_see_all_banks(app_conn: Connection, world: dict[str, str]) -> None:
    set_scope(app_conn, "operator", world["operator"])
    banks = set(app_conn.exec_driver_sql("select distinct bank_id from cases").scalars())
    assert {"bank_a", "bank_b"} <= banks


def test_operator_can_update_case_and_add_note(app_conn: Connection, world: dict[str, str]) -> None:
    set_scope(app_conn, "operator", world["operator"])
    assert app_conn.exec_driver_sql(
        "update cases set victim_phone = '+81-90-0000-0000' where id = %s", (world["case_b2"],)
    ).rowcount == 1
    app_conn.exec_driver_sql(
        "insert into notes (case_id, bank_id, author_id, body) values (%s, 'bank_b', %s, 'Checked.')",
        (world["case_b2"], world["operator"]),
    )


def test_operator_cannot_touch_auth_tables(app_conn: Connection, world: dict[str, str]) -> None:
    set_scope(app_conn, "operator", world["operator"])
    assert count(app_conn, "sessions") == 0
    assert count(app_conn, "auth_tokens") == 0
    assert count(app_conn, "invitations") == 0


# ------------------------------------------------------------- victims


def test_victim_sees_only_own_cases(app_conn: Connection, world: dict[str, str]) -> None:
    # app.bank_id is set too (the chatbot needs it); the victim policy must still match only their own case.
    set_scope(app_conn, "victim", world["victim1"], "bank_b")
    rows = app_conn.exec_driver_sql("select id::text, victim_user_id::text from cases").all()
    assert world["case_b1"] in {case_id for case_id, _ in rows}
    assert {owner for _, owner in rows} == {world["victim1"]}  # every visible case is theirs
    assert world["case_a2"] not in {case_id for case_id, _ in rows}  # victim2's case stays hidden


@pytest.mark.parametrize("table", ["documents", "document_contents", "ai_extractions", "notes", "audit_log"])
def test_victim_sees_no_staff_records(app_conn: Connection, world: dict[str, str], table: str) -> None:
    set_scope(app_conn, "victim", world["victim1"], "bank_b")
    assert count(app_conn, table) == 0


def test_victim_sees_only_own_account(app_conn: Connection, world: dict[str, str]) -> None:
    set_scope(app_conn, "victim", world["victim1"])
    ids = set(app_conn.exec_driver_sql("select id::text from users").scalars())
    assert ids == {world["victim1"]}


def test_victim_cannot_update_someone_elses_case(app_conn: Connection, world: dict[str, str]) -> None:
    set_scope(app_conn, "victim", world["victim1"])
    assert app_conn.exec_driver_sql(
        "update cases set victim_phone = 'x' where id = %s", (world["case_a2"],)
    ).rowcount == 0
    assert app_conn.exec_driver_sql(
        "update cases set victim_phone = '+81-90-1111-2222' where id = %s", (world["case_b1"],)
    ).rowcount == 1


def test_victim_cannot_give_away_own_case(app_conn: Connection, world: dict[str, str]) -> None:
    set_scope(app_conn, "victim", world["victim1"])
    expect_denied(
        app_conn,
        "update cases set victim_user_id = %s where id = %s",
        (world["victim2"], world["case_b1"]),
        message="row-level security",
    )


def test_victim_can_report_only_for_themselves(app_conn: Connection, world: dict[str, str]) -> None:
    set_scope(app_conn, "victim", world["victim1"])
    insert = (
        "insert into cases (reference, bank_id, channel, victim_name, victim_user_id, consent_at) "
        "values (%s, 'bank_c', %s, 'Victim One', %s, now())"
    )
    app_conn.exec_driver_sql(insert, ("RFR-2099-00010", "web_form", world["victim1"]))
    expect_denied(app_conn, insert, ("RFR-2099-00011", "web_form", world["victim2"]), "row-level security")
    expect_denied(app_conn, insert, ("RFR-2099-00012", "phone", world["victim1"]), "row-level security")


def test_victim_with_empty_user_id_sees_nothing(app_conn: Connection, world: dict[str, str]) -> None:
    set_scope(app_conn, "victim", None, "bank_b")
    assert count(app_conn, "cases") == 0


# ------------------------------------------------------------- system scope and auth tables


def test_app_user_reads_sessions_only_in_system_scope(app_conn: Connection, world: dict[str, str]) -> None:
    assert count(app_conn, "sessions") == 0
    set_scope(app_conn, "system")
    assert count(app_conn, "sessions") == 1


def test_supervisor_manages_invitations(app_conn: Connection, world: dict[str, str]) -> None:
    set_scope(app_conn, "supervisor", world["supervisor"])
    app_conn.exec_driver_sql(
        "insert into invitations (email, name, role, bank_id, token_hash, invited_by, expires_at) "
        "values ('viewer-c@test.test', 'Viewer C', 'bank_viewer', 'bank_c', repeat('9', 64), %s, now() + interval '72 hours')",
        (world["supervisor"],),
    )
    assert count(app_conn, "invitations") == 1
    set_scope(app_conn, "operator", world["operator"])
    assert count(app_conn, "invitations") == 0


def test_only_system_creates_accounts(app_conn: Connection, world: dict[str, str]) -> None:
    sql = "insert into users (email, name, password_hash, role) values ('sneaky@test.test', 'S', 'x', 'supervisor')"
    set_scope(app_conn, "supervisor", world["supervisor"])
    expect_denied(app_conn, sql, message="row-level security")
    set_scope(app_conn, "system")
    app_conn.exec_driver_sql(sql)


# ------------------------------------------------------------- audit log (D8)


def test_audit_log_rejects_delete_and_update(app_conn: Connection, world: dict[str, str]) -> None:
    set_scope(app_conn, "system")
    expect_denied(app_conn, "delete from audit_log", message="permission denied")
    expect_denied(app_conn, "update audit_log set summary = 'edited'", message="permission denied")
    expect_denied(app_conn, "truncate audit_log", message="permission denied")


def test_audit_log_is_append_only_even_for_the_owner(owner_tx: Connection, world: dict[str, str]) -> None:
    expect_denied(owner_tx, "delete from audit_log", message="append-only")
    expect_denied(owner_tx, "update audit_log set summary = 'edited'", message="append-only")


def test_every_known_role_can_write_audit_entries(app_conn: Connection, world: dict[str, str]) -> None:
    set_scope(app_conn, "bank_viewer", world["viewer_a"], "bank_a")
    app_conn.exec_driver_sql(
        "insert into audit_log (actor_type, actor_id, action, case_id, bank_id, summary) "
        "values ('user', %s, 'case.viewed', %s, 'bank_a', 'Case viewed')",
        (world["viewer_a"], world["case_a1"]),
    )
    set_scope(app_conn, "")
    expect_denied(
        app_conn,
        "insert into audit_log (actor_type, action, summary) values ('public', 'auth.login_failed', 'x')",
        message="row-level security",
    )


# ------------------------------------------------------------- privileges and references


@pytest.mark.parametrize("table", ALL_TABLES)
def test_app_user_cannot_delete(app_conn: Connection, world: dict[str, str], table: str) -> None:
    set_scope(app_conn, "system")
    expect_denied(app_conn, f"delete from {table}", message="permission denied")


def test_app_user_cannot_create_tables(app_conn: Connection, world: dict[str, str]) -> None:
    expect_denied(app_conn, "create table sneaky (id int)", message="permission denied")


def test_every_table_forces_row_level_security(app_conn: Connection, world: dict[str, str]) -> None:
    rows = app_conn.exec_driver_sql(
        "select relname, relrowsecurity, relforcerowsecurity from pg_class "
        "where relnamespace = 'public'::regnamespace and relkind = 'r' and relname <> 'alembic_version'"
    ).all()
    assert {name for name, *_ in rows} == set(ALL_TABLES)
    assert all(enabled and forced for _, enabled, forced in rows), rows


def test_next_case_reference_format_and_order(app_conn: Connection, world: dict[str, str]) -> None:
    first = app_conn.exec_driver_sql("select next_case_reference()").scalar_one()
    second = app_conn.exec_driver_sql("select next_case_reference()").scalar_one()
    assert re.fullmatch(r"RFR-\d{4}-\d{5}", first)
    assert int(second[-5:]) == int(first[-5:]) + 1
    assert int(first[-5:]) >= 100  # never collides with the seeded demo references


def test_app_user_cannot_use_the_sequence_directly(app_conn: Connection, world: dict[str, str]) -> None:
    expect_denied(app_conn, "select nextval('case_reference_seq')", message="permission denied")
