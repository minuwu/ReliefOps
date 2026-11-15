"""Only the server writes assistant answers; victims insert only their own questions.

Revision ID: 004_chat_writes
Revises: 003_chat
Create Date: 2026-11-15

003 let a victim's own session insert rows with role 'assistant', so a bug in
code running as the victim could plant an "official" answer with citations.
Answers are now written by the server in the system scope (victim_chat.ask),
and the victim policy accepts role 'victim' only. Staff replies are unchanged.

Also pins the trigger function's search_path, the standard hardening for
functions that run on every row change.
"""

from alembic import op

revision = "004_chat_writes"
down_revision = "003_chat"
branch_labels = None
depends_on = None

ROLE = "(SELECT current_setting('app.role', true))"
USER = "(SELECT nullif(current_setting('app.user_id', true), '')::uuid)"
STAFF = f"{ROLE} IN ('operator', 'supervisor')"
OWN = (f"{ROLE} = 'victim' AND EXISTS (SELECT 1 FROM cases c "
       f"WHERE c.id = case_id AND c.victim_user_id = {USER})")


def _insert_policy(victim_roles: str) -> str:
    return (f"CREATE POLICY chat_insert ON chat_messages FOR INSERT WITH CHECK ("
            f"({STAFF} AND role = 'staff' AND author_id = {USER}) OR "
            f"({OWN} AND role IN ({victim_roles}) AND author_id IS NULL))")


def upgrade() -> None:
    op.execute("DROP POLICY chat_insert ON chat_messages")
    op.execute(_insert_policy("'victim'"))
    op.execute("ALTER FUNCTION chat_feedback_only() SET search_path = ''")


def downgrade() -> None:
    op.execute("ALTER FUNCTION chat_feedback_only() RESET search_path")
    op.execute("DROP POLICY chat_insert ON chat_messages")
    op.execute(_insert_policy("'victim', 'assistant'"))
