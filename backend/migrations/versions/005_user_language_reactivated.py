"""Store a victim's preferred language; audit reactivations as their own action.

Revision ID: 005_user_language
Revises: 004_chat_writes
Create Date: 2026-11-15

- ``users.preferred_language``: sign-up accepts it (API_SPEC §6.1) but there was no column, so it
  was dropped. Existing rows get 'en'. The app role already has table-level SELECT/INSERT/UPDATE
  on ``users`` (002), which covers the new column; RLS policies are unchanged.
- ``audit_log.action`` gains ``user.reactivated``: reactivating a user was recorded as
  ``user.deactivated`` with ``changes.is_active`` showing the direction, which read wrongly.

Downgrade restores the old action list as ``NOT VALID``: the append-only log can't rewrite
existing ``user.reactivated`` rows, so they stay, while new rows are checked again.
"""

from alembic import op

revision = "005_user_language"
down_revision = "004_chat_writes"
branch_labels = None
depends_on = None

_ACTIONS_BEFORE = (
    "auth.login",
    "auth.login_failed",
    "auth.logout",
    "auth.signup",
    "auth.email_verified",
    "auth.password_reset",
    "user.invited",
    "user.invitation_revoked",
    "user.joined",
    "user.deactivated",
    "case.created",
    "case.viewed",
    "case.updated",
    "case.status_changed",
    "case.assigned",
    "case.deadline_changed",
    "case.victim_invited",
    "case.claimed",
    "note.added",
    "document.uploaded",
    "document.downloaded",
    "ai.extraction_completed",
    "ai.extraction_failed",
    "ai.review_accepted",
    "ai.review_rejected",
    "export.generated",
    "chat.escalated",
    "chat.staff_replied",
    "kb.document_uploaded",
    "kb.document_published",
    "kb.document_archived",
)
_ACTIONS_AFTER = (*_ACTIONS_BEFORE, "user.reactivated")


def _action_check(actions: tuple[str, ...], *, not_valid: bool = False) -> str:
    values = ", ".join(f"'{a}'" for a in actions)
    suffix = " NOT VALID" if not_valid else ""
    return f"ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check CHECK (action IN ({values})){suffix}"


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users ADD COLUMN preferred_language text NOT NULL DEFAULT 'en' "
        "CONSTRAINT users_preferred_language_check CHECK (preferred_language IN ('en', 'ja', 'bn'))"
    )
    op.execute("ALTER TABLE audit_log DROP CONSTRAINT audit_log_action_check")
    op.execute(_action_check(_ACTIONS_AFTER))


def downgrade() -> None:
    op.execute("ALTER TABLE audit_log DROP CONSTRAINT audit_log_action_check")
    op.execute(_action_check(_ACTIONS_BEFORE, not_valid=True))
    op.execute("ALTER TABLE users DROP COLUMN preferred_language")
