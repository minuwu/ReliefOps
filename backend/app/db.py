"""Database engine and scoped sessions (owner: Asif; guide §4.2 and §4.3).

Every transaction carries the caller's scope. A SQLAlchemy ``after_begin`` hook
reads ``session.info["scope"]`` and runs ``set_config(..., true)`` at the start
of **every** transaction, including the ones a session opens after a commit,
so row-level security (migration 002) always knows who is asking. The values
are transaction-local, so they never leak to the next user of a pooled
connection, and they are bound parameters, never string-formatted SQL.

No scope means no rows: a session opened without one sees nothing.

Usage
-----
At startup (Anim's ``create_app``)::

    db.init_engine(settings.database_url)

In a FastAPI dependency (Anim's ``security.py``, once ``CurrentPrincipal`` exists)::

    def get_session(who: CurrentPrincipal) -> Iterator[Session]:
        yield from db.session_for(who.scope())
    SessionDep = Annotated[Session, Depends(get_session)]

Auth lookups, the seed and background jobs::

    with db.system_session() as s:
        ...
        s.commit()

Write services end with ``s.commit()`` before they return; the session's
cleanup only rolls back and closes (guide §4.2 rule 2).
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import AbstractContextManager, contextmanager
from dataclasses import dataclass
from typing import Final, Literal
from uuid import UUID

from sqlalchemy import Connection, Engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import SessionTransaction
from sqlmodel import Session, create_engine

ScopeRole = Literal["operator", "supervisor", "bank_viewer", "victim", "system"]
SCOPE_ROLES: Final[frozenset[str]] = frozenset({"operator", "supervisor", "bank_viewer", "victim", "system"})
SCOPE_KEY: Final = "scope"

_SET_SCOPE_SQL: Final = (
    "select set_config('app.role', %s, true), "
    "set_config('app.user_id', %s, true), "
    "set_config('app.bank_id', %s, true)"
)


@dataclass(frozen=True, slots=True)
class Scope:
    """Who a transaction runs for. Mirrors the settings the RLS policies read."""

    role: ScopeRole
    user_id: UUID | None = None
    bank_id: str | None = None

    def __post_init__(self) -> None:
        if self.role not in SCOPE_ROLES:
            raise ValueError(f"unknown scope role {self.role!r}")
        if self.role == "bank_viewer" and not self.bank_id:
            raise ValueError("a bank_viewer scope needs a bank_id")
        if self.role == "victim" and self.user_id is None:
            raise ValueError("a victim scope needs a user_id")

    def settings(self) -> tuple[str, str, str]:
        """The (app.role, app.user_id, app.bank_id) values, '' for none."""
        return (self.role, str(self.user_id) if self.user_id else "", self.bank_id or "")


SYSTEM_SCOPE: Final = Scope(role="system")

_engine: Engine | None = None


def init_engine(database_url: str, *, pool_size: int = 5, max_overflow: int = 5) -> Engine:
    """Create the app's engine once at startup. ``database_url`` is the app_user, never the migrator."""
    global _engine
    if _engine is not None:
        _engine.dispose()
    _engine = create_engine(
        database_url,
        pool_pre_ping=True,
        pool_size=pool_size,
        max_overflow=max_overflow,
        connect_args=connect_args(database_url),
    )
    return _engine


DEFAULT_CONNECT_TIMEOUT_SECONDS = 5


def connect_args(database_url: str) -> dict[str, object]:
    """Every connection works in UTC, and a down database fails fast.

    Without ``timezone=UTC`` a server set to local time (e.g. Asia/Dhaka) sends
    ``+06:00`` timestamps, but the contract promises UTC (API_SPEC §1). A timeout
    already in the URL wins.
    """
    args: dict[str, object] = {"options": "-c timezone=UTC"}
    if "connect_timeout" not in make_url(database_url).query:
        args["connect_timeout"] = DEFAULT_CONNECT_TIMEOUT_SECONDS
    return args


def get_engine() -> Engine:
    if _engine is None:
        raise RuntimeError("db.init_engine() has not been called")
    return _engine


def dispose_engine() -> None:
    """Close pooled connections (app shutdown, tests)."""
    global _engine
    if _engine is not None:
        _engine.dispose()
        _engine = None


@event.listens_for(Session, "after_begin")
def _apply_scope(session: Session, transaction: SessionTransaction, connection: Connection) -> None:
    scope = session.info.get(SCOPE_KEY)
    if scope is None:
        return  # no scope: RLS shows nothing (fails closed)
    connection.exec_driver_sql(_SET_SCOPE_SQL, scope.settings())


@contextmanager
def scoped_session(scope: Scope, engine: Engine | None = None) -> Iterator[Session]:
    """A session whose every transaction runs with ``scope``. Uncommitted work is rolled back on exit."""
    with Session(engine or get_engine(), info={SCOPE_KEY: scope}) as session:
        yield session


def system_session(engine: Engine | None = None) -> AbstractContextManager[Session]:
    """Scope ``system``: auth lookups, the seed and background jobs only."""
    return scoped_session(SYSTEM_SCOPE, engine)


def session_for(scope: Scope) -> Iterator[Session]:
    """Generator for a FastAPI dependency with ``yield``; see the module docstring."""
    with scoped_session(scope) as session:
        yield session
