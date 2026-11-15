"""Who is calling a service (owner: Asif).

Services take a ``Caller``: anything with these attributes and the two methods.
Anim's ``security.Principal`` (guide §4.3) satisfies it, so routers pass the
logged-in user straight through. ``StaticCaller`` is a plain implementation for
background jobs and tests.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from app.db import Scope
from app.services.audit import Actor

STAFF_ROLES = frozenset({"operator", "supervisor"})


class Caller(Protocol):
    @property
    def user_id(self) -> UUID: ...

    @property
    def name(self) -> str: ...

    @property
    def role(self) -> str: ...

    @property
    def bank_id(self) -> str | None: ...

    def scope(self) -> Scope: ...

    def actor(self) -> Actor: ...


@dataclass(frozen=True, slots=True)
class StaticCaller:
    user_id: UUID
    name: str
    role: str
    bank_id: str | None = None

    def scope(self) -> Scope:
        return Scope(role=self.role, user_id=self.user_id, bank_id=self.bank_id)  # type: ignore[arg-type]

    def actor(self) -> Actor:
        return Actor(type="victim" if self.role == "victim" else "user", id=self.user_id, name=self.name, role=self.role)


def is_staff(caller: Caller) -> bool:
    return caller.role in STAFF_ROLES
