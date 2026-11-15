"""Fixtures for database-rule tests (backend-development-guide.md §8.4).

These tests use raw SQL, never app code, so they prove what the database
alone enforces. They need two variables pointing at a database whose name
ends in ``_test``:

  TEST_MIGRATIONS_DATABASE_URL  the migrator (owner) user
  TEST_DATABASE_URL             the app_user (what the app connects as)

The session fixture migrates the test database down to base and back up to
head, so every run starts from an empty schema.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, Engine, create_engine
from sqlalchemy.engine import make_url

BACKEND_DIR = Path(__file__).resolve().parents[2]


def _test_url(variable: str) -> str:
    url = os.environ.get(variable)
    if not url:
        pytest.exit(f"{variable} is not set (see tests/rls/conftest.py)", returncode=2)
    database = make_url(url).database or ""
    if not database.endswith("_test"):
        pytest.exit(f"refusing to run against database {database!r}: name must end in _test", returncode=2)
    return url


def set_scope(conn: Connection, role: str | None, user_id: str | None = None, bank_id: str | None = None) -> None:
    """Apply a scope to the current transaction, like app/db.py does."""
    conn.exec_driver_sql(
        "select set_config('app.role', %s, true), set_config('app.user_id', %s, true), "
        "set_config('app.bank_id', %s, true)",
        (role or "", user_id or "", bank_id or ""),
    )


@pytest.fixture(scope="session")
def alembic_config() -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.attributes["url"] = _test_url("TEST_MIGRATIONS_DATABASE_URL")
    cfg.attributes["skip_logging"] = True
    return cfg


@pytest.fixture(scope="session")
def migrated(alembic_config: Config) -> Config:
    command.downgrade(alembic_config, "base")
    command.upgrade(alembic_config, "head")
    return alembic_config


@pytest.fixture(scope="session")
def owner_engine(migrated: Config) -> Iterator[Engine]:
    engine = create_engine(_test_url("TEST_MIGRATIONS_DATABASE_URL"))
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def app_engine(migrated: Config) -> Iterator[Engine]:
    engine = create_engine(_test_url("TEST_DATABASE_URL"))
    yield engine
    engine.dispose()


@pytest.fixture
def owner_tx(owner_engine: Engine) -> Iterator[Connection]:
    """A migrator connection in a system-scoped transaction that is always rolled back."""
    with owner_engine.connect() as conn:
        tx = conn.begin()
        set_scope(conn, "system")
        try:
            yield conn
        finally:
            tx.rollback()


@pytest.fixture
def app_conn(app_engine: Engine) -> Iterator[Connection]:
    """An app_user connection in a transaction that is always rolled back. Set the scope yourself."""
    with app_engine.connect() as conn:
        tx = conn.begin()
        try:
            yield conn
        finally:
            tx.rollback()


# ---------------------------------------------------------------- test data

_reference_counter = iter(range(90000, 99999))


def next_reference() -> str:
    return f"RFR-2099-{next(_reference_counter):05d}"


def insert_user(conn: Connection, email: str, role: str, bank_id: str | None = None) -> str:
    return conn.exec_driver_sql(
        "insert into users (email, name, password_hash, role, bank_id, email_verified_at) "
        "values (%s, %s, 'not-a-real-hash', %s, %s, now()) returning id::text",
        (email, email.split("@")[0], role, bank_id),
    ).scalar_one()


def insert_case(conn: Connection, bank_id: str, victim_user_id: str | None = None, **columns: object) -> str:
    values = {
        "reference": next_reference(),
        "bank_id": bank_id,
        "channel": "phone",
        "victim_name": "Synthetic Victim",
        "victim_user_id": victim_user_id,
        **columns,
    }
    names = ", ".join(values)
    marks = ", ".join(["%s"] * len(values))
    return conn.exec_driver_sql(
        f"insert into cases ({names}) values ({marks}) returning id::text", tuple(values.values())
    ).scalar_one()


@pytest.fixture(scope="session")
def world(owner_engine: Engine) -> dict[str, str]:
    """Committed, synthetic data shared by the read-only tests: two banks' cases and their children."""
    ids: dict[str, str] = {}
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        conn.exec_driver_sql(
            "insert into banks (id, name) values "
            "('bank_a', 'Aster Test Bank'), ('bank_b', 'Birch Test Bank'), ('bank_c', 'Cedar Test Bank'), "
            "('bank_d', 'Dune Test Bank'), ('bank_e', 'Elm Test Bank')"
        )
        ids["operator"] = insert_user(conn, "operator@test.test", "operator")
        ids["supervisor"] = insert_user(conn, "supervisor@test.test", "supervisor")
        ids["viewer_a"] = insert_user(conn, "viewer-a@test.test", "bank_viewer", "bank_a")
        ids["viewer_b"] = insert_user(conn, "viewer-b@test.test", "bank_viewer", "bank_b")
        ids["victim1"] = insert_user(conn, "victim1@test.test", "victim")
        ids["victim2"] = insert_user(conn, "victim2@test.test", "victim")

        ids["case_a1"] = insert_case(conn, "bank_a")
        ids["case_a2"] = insert_case(conn, "bank_a", victim_user_id=ids["victim2"])
        ids["case_b1"] = insert_case(conn, "bank_b", victim_user_id=ids["victim1"])
        ids["case_b2"] = insert_case(conn, "bank_b")

        for key, case_key, bank in (("doc_a1", "case_a1", "bank_a"), ("doc_b1", "case_b1", "bank_b")):
            ids[key] = conn.exec_driver_sql(
                "insert into documents (case_id, bank_id, filename, doc_type, mime_type, size_bytes, sha256, uploaded_by) "
                "values (%s, %s, 'receipt.txt', 'transfer_receipt', 'text/plain', 5, repeat('a', 64), %s) "
                "returning id::text",
                (ids[case_key], bank, ids["operator"]),
            ).scalar_one()
            conn.exec_driver_sql(
                "insert into document_contents (document_id, bank_id, content) values (%s, %s, 'hello'::bytea)",
                (ids[key], bank),
            )
            conn.exec_driver_sql(
                "insert into notes (case_id, bank_id, author_id, body) values (%s, %s, %s, 'Called the victim.')",
                (ids[case_key], bank, ids["operator"]),
            )
            conn.exec_driver_sql(
                "insert into ai_extractions (document_id, case_id, bank_id, status, source) "
                "values (%s, %s, %s, 'pending_review', 'rules_fallback')",
                (ids[key], ids[case_key], bank),
            )
            conn.exec_driver_sql(
                "insert into audit_log (actor_type, actor_id, action, case_id, bank_id, summary) "
                "values ('user', %s, 'case.created', %s, %s, 'Case created')",
                (ids["operator"], ids[case_key], bank),
            )
        conn.exec_driver_sql(
            "insert into sessions (user_id, token_hash, expires_at) values (%s, repeat('b', 64), now() + interval '8 hours')",
            (ids["operator"],),
        )
    return ids
