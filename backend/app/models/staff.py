"""Staff invitation and user-management schemas (owner: Anim; API_SPEC §4 Invitation, §6.1–6.2)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.auth import NewPassword, Token
from app.models.common import BankId, Email, Name
from app.models.documents import UserRef

StaffRole = Literal["operator", "supervisor", "bank_viewer"]
InvitationStatus = Literal["pending", "accepted", "revoked", "expired"]


class InvitationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: Email
    name: Name
    role: StaffRole
    bank_id: BankId | None = None


class Invitation(BaseModel):
    id: str
    email: str
    name: str
    role: StaffRole
    bank_id: BankId | None
    status: InvitationStatus
    invited_by: UserRef
    created_at: datetime
    expires_at: datetime


class AcceptInvitationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: Token
    password: NewPassword


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_active: bool
