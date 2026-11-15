"""Migration 001: the tables exist and their constraints reject bad data."""

from __future__ import annotations

import pytest
from sqlalchemy import Connection
from sqlalchemy.exc import IntegrityError

from .conftest import insert_case, insert_user

CORE_TABLES = {
    "banks", "users", "sessions", "auth_tokens", "invitations", "cases", "documents",
    "document_contents", "ai_extractions", "notes", "audit_log",
}


def expect_violation(conn: Connection, constraint: str, sql: str, params: tuple = ()) -> None:
    """Run ``sql`` in a savepoint and assert it fails on ``constraint``."""
    savepoint = conn.begin_nested()
    with pytest.raises(IntegrityError) as caught:
        conn.exec_driver_sql(sql, params)
    savepoint.rollback()
    assert constraint in str(caught.value), caught.value


def test_core_tables_exist(owner_tx: Connection) -> None:
    found = set(
        owner_tx.exec_driver_sql(
            "select table_name from information_schema.tables where table_schema = 'public'"
        ).scalars()
    )
    assert CORE_TABLES <= found


def test_only_bank_viewers_have_a_bank(owner_tx: Connection, world: dict[str, str]) -> None:
    expect_violation(
        owner_tx, "users_bank_only_for_viewers",
        "insert into users (email, name, password_hash, role) values ('v@test.test', 'V', 'x', 'bank_viewer')",
    )
    expect_violation(
        owner_tx, "users_bank_only_for_viewers",
        "insert into users (email, name, password_hash, role, bank_id) values ('o@test.test', 'O', 'x', 'operator', 'bank_a')",
    )


def test_user_email_must_be_lower_case(owner_tx: Connection, world: dict[str, str]) -> None:
    expect_violation(
        owner_tx, "users_email_check",
        "insert into users (email, name, password_hash, role) values ('Mixed@Test.test', 'M', 'x', 'victim')",
    )


def test_case_rejects_unknown_status_and_bad_reference(owner_tx: Connection, world: dict[str, str]) -> None:
    expect_violation(
        owner_tx, "cases_status_check",
        "insert into cases (reference, bank_id, channel, victim_name, status) "
        "values ('RFR-2099-00001', 'bank_a', 'phone', 'X', 'bogus')",
    )
    expect_violation(
        owner_tx, "cases_reference_check",
        "insert into cases (reference, bank_id, channel, victim_name) values ('CASE-1', 'bank_a', 'phone', 'X')",
    )


def test_closed_case_needs_time_and_reason(owner_tx: Connection, world: dict[str, str]) -> None:
    expect_violation(
        owner_tx, "cases_closed_has_time",
        "update cases set status = 'closed', closure_reason = 'withdrawn' where id = %s",
        (world["case_a1"],),
    )
    expect_violation(
        owner_tx, "cases_closed_has_reason",
        "update cases set status = 'closed', closed_at = now() where id = %s",
        (world["case_a1"],),
    )


def test_paid_out_needs_payout_amount(owner_tx: Connection, world: dict[str, str]) -> None:
    expect_violation(
        owner_tx, "cases_paid_out_has_payout",
        "update cases set status = 'closed', closed_at = now(), closure_reason = 'paid_out' where id = %s",
        (world["case_a1"],),
    )
    owner_tx.exec_driver_sql(
        "update cases set status = 'closed', closed_at = now(), closure_reason = 'paid_out', payout_amount = 1000 "
        "where id = %s",
        (world["case_a1"],),
    )


def test_web_form_case_needs_consent(owner_tx: Connection, world: dict[str, str]) -> None:
    expect_violation(
        owner_tx, "cases_web_form_has_consent",
        "insert into cases (reference, bank_id, channel, victim_name) values ('RFR-2099-00002', 'bank_a', 'web_form', 'X')",
    )


def test_child_rows_must_match_their_case_bank(owner_tx: Connection, world: dict[str, str]) -> None:
    """A bank_a case's document can't be labelled bank_b: RLS relies on these copies."""
    expect_violation(
        owner_tx, "documents_case_bank_fk",
        "insert into documents (case_id, bank_id, filename, doc_type, mime_type, size_bytes, sha256, uploaded_by) "
        "values (%s, 'bank_b', 'x.txt', 'other', 'text/plain', 1, repeat('c', 64), %s)",
        (world["case_a1"], world["operator"]),
    )
    expect_violation(
        owner_tx, "notes_case_bank_fk",
        "insert into notes (case_id, bank_id, author_id, body) values (%s, 'bank_b', %s, 'x')",
        (world["case_a1"], world["operator"]),
    )
    expect_violation(
        owner_tx, "audit_log_case_bank_fk",
        "insert into audit_log (actor_type, action, case_id, bank_id, summary) values ('system', 'case.viewed', %s, 'bank_b', 'x')",
        (world["case_a1"],),
    )


def test_extraction_must_belong_to_its_document_case(owner_tx: Connection, world: dict[str, str]) -> None:
    expect_violation(
        owner_tx, "ai_extractions_document_fk",
        "insert into ai_extractions (document_id, case_id, bank_id, status, source) "
        "values (%s, %s, 'bank_a', 'pending_review', 'llm')",
        (world["doc_a1"], world["case_a2"]),
    )


def test_money_keeps_two_decimals(owner_tx: Connection, world: dict[str, str]) -> None:
    case_id = insert_case(owner_tx, "bank_a", amount="250000.505")
    amount = owner_tx.exec_driver_sql("select amount::text from cases where id = %s", (case_id,)).scalar_one()
    assert amount == "250000.51"


def test_one_pending_invitation_per_email(owner_tx: Connection, world: dict[str, str]) -> None:
    sql = (
        "insert into invitations (email, name, role, token_hash, invited_by, expires_at) "
        "values ('new@test.test', 'New', 'operator', %s, %s, now() + interval '72 hours')"
    )
    owner_tx.exec_driver_sql(sql, ("d" * 64, world["supervisor"]))
    expect_violation(owner_tx, "invitations_one_pending_per_email", sql, ("e" * 64, world["supervisor"]))


def test_claim_token_needs_case_and_email(owner_tx: Connection, world: dict[str, str]) -> None:
    expect_violation(
        owner_tx, "auth_tokens_claim_has_case",
        "insert into auth_tokens (purpose, email, token_hash, expires_at) "
        "values ('claim_case', 'v@test.test', repeat('f', 64), now() + interval '7 days')",
    )
    expect_violation(
        owner_tx, "auth_tokens_account_has_user",
        "insert into auth_tokens (purpose, token_hash, expires_at) values ('verify_email', repeat('f', 64), now() + interval '1 day')",
    )


def test_users_fixture_helper_rejects_unknown_role(owner_tx: Connection) -> None:
    savepoint = owner_tx.begin_nested()
    with pytest.raises(IntegrityError):
        insert_user(owner_tx, "x@test.test", "admin")
    savepoint.rollback()
