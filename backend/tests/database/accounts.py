"""Helpers for Anim's HTTP tests on the test database: app settings and real accounts (owner: Anim)."""

from __future__ import annotations

from uuid import uuid4

from sqlalchemy import Engine

from app import security
from app.config import Settings

from .conftest import _test_url, set_scope

PASSWORD = "a-long-test-password"
_PASSWORD_HASH = security.hash_password(PASSWORD)


def app_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "app_env": "test",
        "database_url": _test_url("TEST_DATABASE_URL"),
        "email_mode": "outbox",
    }
    return Settings(_env_file=None, **(values | overrides))  # type: ignore[call-arg]


def make_account(
    owner_engine: Engine,
    role: str,
    *,
    bank_id: str | None = None,
    verified: bool = True,
    active: bool = True,
    label: str | None = None,
) -> dict[str, str]:
    """Insert a committed account with a real argon2 hash for ``PASSWORD``. Returns ``{id, email}``."""
    label = label or role
    email = f"{label.replace('_', '-')}-{uuid4().hex[:10]}@acct.test"
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        user_id = conn.exec_driver_sql(
            "insert into users (email, name, password_hash, role, bank_id, email_verified_at, is_active) "
            "values (%s, %s, %s, %s, %s, case when %s then now() end, %s) returning id::text",
            (email, label.replace("_", " ").title(), _PASSWORD_HASH, role, bank_id, verified, active),
        ).scalar_one()
    return {"id": user_id, "email": email}
