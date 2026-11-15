"""N5: the demo seed, run inside a rolled-back transaction so the shared test database stays clean."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlalchemy import Connection, Engine

from app import security
from app.seed import ACCOUNTS, CASE_42_ID, DEMO_PASSWORD, OPERATOR1_ID, seed_into

from .conftest import set_scope


@pytest.fixture
def seeded(owner_engine: Engine, world: dict[str, str]) -> Iterator[Connection]:
    """The seed applied twice on top of the test data, never committed."""
    with owner_engine.connect() as conn:
        tx = conn.begin()
        try:
            first = seed_into(conn)
            second = seed_into(conn)
            assert first == second  # idempotent: the second run adds nothing
            yield conn
        finally:
            tx.rollback()


def _scalar(conn: Connection, sql: str, *params: object) -> object:
    return conn.exec_driver_sql(sql, params).scalar_one()


def _seed_cases(conn: Connection, where: str = "true") -> int:
    return _scalar(conn, f"select count(*) from cases where reference like 'RFR-2026-%%' and {where}")  # type: ignore[return-value]


def test_demo_accounts_exist_with_the_demo_password(seeded: Connection) -> None:
    for email, _name, role, bank_id, verified in ACCOUNTS:
        row = seeded.exec_driver_sql(
            "select role, bank_id, email_verified_at is not null, is_active, password_hash from users where email = %s",
            (email,),
        ).one()
        assert (row[0], row[1], row[2], row[3]) == (role, bank_id, verified, True), email
        assert security.verify_password(DEMO_PASSWORD, row[4]), email
    assert _scalar(seeded, "select id from users where email = 'operator1@opscenter.test'") == OPERATOR1_ID


def test_cases_cover_every_bank_and_status_with_overdue_ones(seeded: Connection) -> None:
    assert _seed_cases(seeded) >= 30
    seed_rows = "reference like 'RFR-2026-%%'"
    banks = seeded.exec_driver_sql(f"select count(distinct bank_id) from cases where {seed_rows}").scalar_one()
    statuses = seeded.exec_driver_sql(f"select count(distinct status) from cases where {seed_rows}").scalar_one()
    assert (banks, statuses) == (5, 6)
    assert 5 <= _seed_cases(seeded, "status <> 'closed' and deadline < now()") <= 8


def test_the_two_victim_cases_match_the_contract(seeded: Connection) -> None:
    rows = seeded.exec_driver_sql(
        "select c.reference, c.id, c.status, c.bank_id, u.email from cases c join users u on u.id = c.victim_user_id "
        "where c.reference in ('RFR-2026-00042', 'RFR-2026-00051') order by c.reference"
    ).all()
    assert [tuple(r) for r in rows] == [
        ("RFR-2026-00042", CASE_42_ID, "verified", "bank_b", "victim1@mail.test"),
        ("RFR-2026-00051", rows[1][1], "received", "bank_c", "victim2@mail.test"),
    ]


def test_shared_accounts_documents_and_review_queue(seeded: Connection) -> None:
    shared = seeded.exec_driver_sql(
        "select count(*) from (select bank_id, account_number from cases where reference like 'RFR-2026-%%' "
        "and account_number is not null group by 1, 2 having count(*) > 1) s"
    ).scalar_one()
    assert shared >= 3
    assert (
        _scalar(
            seeded,
            "select count(*) from documents d join cases c on c.id = d.case_id where c.reference like 'RFR-2026-%%'",
        )
        >= 10
    )
    lanes = {
        tuple(r)
        for r in seeded.exec_driver_sql(
            "select e.status, e.review_lane, e.source from ai_extractions e join cases c on c.id = e.case_id "
            "where c.reference like 'RFR-2026-%%'"
        )
    }
    assert ("pending_review", "low_confidence", "rules_fallback") in lanes
    assert ("pending_review", "standard", "llm") in lanes
    assert ("failed", None, "rules_fallback") in lanes


def test_counters_match_the_real_rows(seeded: Connection) -> None:
    wrong = _scalar(
        seeded,
        "select count(*) from cases c where c.reference like 'RFR-2026-%%' and ("
        "c.document_count <> (select count(*) from documents d where d.case_id = c.id) or "
        "c.pending_extraction_count <> (select count(*) from ai_extractions e "
        "where e.case_id = c.id and e.status = 'pending_review'))",
    )
    assert wrong == 0


def test_every_bank_has_a_published_bluebook_with_embedded_passages(seeded: Connection) -> None:
    rows = seeded.exec_driver_sql(
        "select d.bank_id, d.status, d.audience, d.passage_count, count(p.id), count(p.embedding) "
        "from kb_documents d join kb_passages p on p.document_id = d.id "
        "where d.title like '%%Fraud Relief Bluebook' group by 1, 2, 3, 4 order by 1"
    ).all()
    assert [r[0] for r in rows] == ["bank_a", "bank_b", "bank_c", "bank_d", "bank_e"]
    for _bank, status, audience, passage_count, passages, embedded in rows:
        assert (status, audience) == ("published", "victim_facing")
        assert passage_count == passages == embedded > 0


def test_bank_isolation_holds_for_seeded_data(seeded: Connection) -> None:
    set_scope(seeded, "bank_viewer", bank_id="bank_a")
    assert {r[0] for r in seeded.exec_driver_sql("select distinct bank_id from cases")} == {"bank_a"}
