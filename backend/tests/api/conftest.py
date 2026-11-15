"""API test harness: the real app over HTTP on the seeded test database (owner: Anim; guide §8.2).

- The app gets explicit settings built from ``TEST_*`` variables; nothing is read from ``.env``.
  It refuses to run unless the database name ends in ``_test``.
- Once per session: migrate the test database down to base and back to head, then run the seed,
  so every endpoint test starts from the API_SPEC §8 demo data.
- Before each test: clear the rate limiters and the email outbox.
- ``login_as("operator")`` returns auth headers for a seeded account (tokens are cached per session).
- Tests that write create their own data and never assume global counts.

``tests/database`` migrates the same database for its own fixtures. Both happen once per session
and pytest runs one folder after the other, so they never interleave.
"""

from __future__ import annotations

import os
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url

from app import email, rate_limit
from app.config import Settings
from app.main import create_app
from app.seed import DEMO_PASSWORD, seed

BACKEND_DIR = Path(__file__).resolve().parents[2]

DEMO_EMAILS = {
    "operator": "operator1@opscenter.test",
    "operator2": "operator2@opscenter.test",
    "supervisor": "supervisor@opscenter.test",
    "viewer_a": "viewer@bank-a.test",
    "viewer_b": "viewer@bank-b.test",
    "victim1": "victim1@mail.test",
    "victim2": "victim2@mail.test",
    "victim3": "victim3@mail.test",
}


def _test_url(variable: str) -> str:
    url = os.environ.get(variable)
    if not url:
        pytest.exit(f"{variable} is not set (see tests/api/conftest.py)", returncode=2)
    database = make_url(url).database or ""
    if not database.endswith("_test"):
        pytest.exit(f"refusing to run against database {database!r}: name must end in _test", returncode=2)
    return url


@pytest.fixture(scope="session")
def settings() -> Settings:
    return Settings(  # type: ignore[call-arg]
        _env_file=None,
        app_env="test",
        database_url=_test_url("TEST_DATABASE_URL"),
        migrations_database_url=_test_url("TEST_MIGRATIONS_DATABASE_URL"),
        email_mode="outbox",
        ai_mode="off",
        ai_timeout_seconds=1,
        frontend_base_url="http://frontend.test",
    )


@pytest.fixture(scope="session")
def seeded_database(settings: Settings) -> None:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.attributes["url"] = settings.migrations_database_url
    cfg.attributes["skip_logging"] = True
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    engine = create_engine(settings.migrations_database_url)
    try:
        seed(engine)
    finally:
        engine.dispose()


@pytest.fixture(scope="session")
def client(settings: Settings, seeded_database: None) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as c:
        yield c


@pytest.fixture(autouse=True)
def _fresh_state() -> None:
    rate_limit.reset_rate_limits()
    email.outbox.clear()


_tokens: dict[str, str] = {}


@pytest.fixture
def login_as(client: TestClient) -> Callable[[str], dict[str, str]]:
    def headers(who: str) -> dict[str, str]:
        if who not in _tokens:
            r = client.post("/api/auth/login", json={"email": DEMO_EMAILS[who], "password": DEMO_PASSWORD})
            assert r.status_code == 200, r.text
            _tokens[who] = r.json()["data"]["token"]
        return {"Authorization": f"Bearer {_tokens[who]}"}

    return headers
