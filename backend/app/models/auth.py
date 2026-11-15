"""Account and login schemas (owner: Anim; API_SPEC §4 User and §6.1)."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.models.common import BankId
from app.security import Role

LoginEmail = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=3, max_length=254)]
LoginPassword = Annotated[str, StringConstraints(min_length=1, max_length=200)]


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: LoginEmail
    password: LoginPassword


class User(BaseModel):
    id: UUID
    name: str
    email: str
    role: Role
    bank_id: BankId | None
    email_verified: bool
    is_active: bool

    @classmethod
    def from_row(cls, row: Any) -> User:
        return cls(
            id=row["id"],
            name=row["name"],
            email=row["email"],
            role=row["role"],
            bank_id=row["bank_id"],
            email_verified=row["email_verified_at"] is not None,
            is_active=row["is_active"],
        )


class LoginResult(BaseModel):
    token: str
    expires_at: datetime
    user: User
