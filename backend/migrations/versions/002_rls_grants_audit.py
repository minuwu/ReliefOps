"""Row-level security, grants, append-only audit log, case references.

Revision ID: 002_rls
Revises: 001_core
Create Date: 2026-11-15

backend-plan.md §5 (bank separation) and backend-development-guide.md §7.

Every request sets three transaction-local settings (app/db.py):
  app.role     operator | supervisor | bank_viewer | victim | system
  app.user_id  the caller's users.id ('' when none)
  app.bank_id  the bank viewer's bank ('' when none)
A missing or unknown role matches no policy, so an unscoped query sees nothing.

Policies apply to every role (TO PUBLIC) and the tables use FORCE ROW LEVEL SECURITY,
so even the owner (migrator) must set a scope; the seed uses role 'system'.
current_setting() is wrapped in (SELECT ...) so Postgres evaluates it once per query.
"""

import os
import re

from alembic import op

revision = "002_rls"
down_revision = "001_core"
branch_labels = None
depends_on = None

APP_ROLE = os.environ.get("APP_DB_ROLE", "app_user")
if not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", APP_ROLE):
    raise ValueError(f"APP_DB_ROLE {APP_ROLE!r} is not a plain lower-case identifier")

# Case references start at 100, so seeded demo cases (RFR-2026-00042, -00051) never collide.
REFERENCE_START = 100

ROLE = "(SELECT current_setting('app.role', true))"
USER_ID = "(SELECT nullif(current_setting('app.user_id', true), '')::uuid)"
BANK_ID = "(SELECT nullif(current_setting('app.bank_id', true), ''))"

SYSTEM = f"{ROLE} = 'system'"
STAFF = f"{ROLE} IN ('operator', 'supervisor')"
SUPERVISOR = f"{ROLE} = 'supervisor'"
VIEWER_OWN_BANK = f"({ROLE} = 'bank_viewer' AND bank_id = {BANK_ID})"
VICTIM_OWN_CASE = f"({ROLE} = 'victim' AND victim_user_id = {USER_ID})"
KNOWN_ROLE = f"{ROLE} IN ('operator', 'supervisor', 'bank_viewer', 'victim', 'system')"

# (table, policy suffix, command, USING, WITH CHECK)
POLICIES: list[tuple[str, str, str, str | None, str | None]] = [
    # Reference data: everyone may read. Only the seed (system scope) writes; app_user has no write grant.
    ("banks", "read", "SELECT", "true", None),
    ("banks", "system_insert", "INSERT", None, SYSTEM),
    ("banks", "system_update", "UPDATE", SYSTEM, SYSTEM),
    # Accounts. Staff see all users (D2); bank viewers see staff names and themselves; victims see themselves.
    ("users", "read", "SELECT",
     f"{SYSTEM} OR {STAFF} OR ({ROLE} = 'bank_viewer' AND (role IN ('operator', 'supervisor') OR id = {USER_ID}))"
     f" OR ({ROLE} = 'victim' AND id = {USER_ID})", None),
    ("users", "insert", "INSERT", None, SYSTEM),
    ("users", "update", "UPDATE", f"{SYSTEM} OR {SUPERVISOR}", f"{SYSTEM} OR {SUPERVISOR}"),
    # Auth tables: only auth code running in system_session().
    ("sessions", "system", "ALL", SYSTEM, SYSTEM),
    ("auth_tokens", "system", "ALL", SYSTEM, SYSTEM),
    ("invitations", "system", "ALL", SYSTEM, SYSTEM),
    ("invitations", "supervisor_read", "SELECT", SUPERVISOR, None),
    ("invitations", "supervisor_insert", "INSERT", None, SUPERVISOR),
    ("invitations", "supervisor_update", "UPDATE", SUPERVISOR, SUPERVISOR),
    # Cases: staff all banks, viewers their bank (read-only), victims their own cases.
    ("cases", "read", "SELECT", f"{SYSTEM} OR {STAFF} OR {VIEWER_OWN_BANK} OR {VICTIM_OWN_CASE}", None),
    ("cases", "insert", "INSERT", None,
     f"{SYSTEM} OR {STAFF} OR ({VICTIM_OWN_CASE} AND channel = 'web_form')"),
    ("cases", "update", "UPDATE", f"{SYSTEM} OR {STAFF} OR {VICTIM_OWN_CASE}", f"{SYSTEM} OR {STAFF} OR {VICTIM_OWN_CASE}"),
]
# Case children: staff all banks, viewers their bank read-only, victims nothing (yet).
for _table in ("documents", "document_contents", "ai_extractions", "notes"):
    POLICIES += [
        (_table, "read", "SELECT", f"{SYSTEM} OR {STAFF} OR {VIEWER_OWN_BANK}", None),
        (_table, "insert", "INSERT", None, f"{SYSTEM} OR {STAFF}"),
    ]
POLICIES.append(("ai_extractions", "update", "UPDATE", f"{SYSTEM} OR {STAFF}", f"{SYSTEM} OR {STAFF}"))
# Audit log: append-only. Viewing a case writes case.viewed, so every known role may insert.
POLICIES += [
    ("audit_log", "read", "SELECT", f"{SYSTEM} OR {STAFF} OR {VIEWER_OWN_BANK}", None),
    ("audit_log", "insert", "INSERT", None, KNOWN_ROLE),
]

# Least privilege for the app: no DELETE or TRUNCATE anywhere ("we don't delete").
GRANTS = {
    "banks": "SELECT",
    "users": "SELECT, INSERT, UPDATE",
    "sessions": "SELECT, INSERT, UPDATE",
    "auth_tokens": "SELECT, INSERT, UPDATE",
    "invitations": "SELECT, INSERT, UPDATE",
    "cases": "SELECT, INSERT, UPDATE",
    "documents": "SELECT, INSERT",
    "document_contents": "SELECT, INSERT",
    "ai_extractions": "SELECT, INSERT, UPDATE",
    "notes": "SELECT, INSERT",
    "audit_log": "SELECT, INSERT",
}
TABLES = list(GRANTS)


def _policy_name(table: str, suffix: str) -> str:
    return f"{table}_{suffix}"


def _create_policy(table: str, suffix: str, command: str, using: str | None, check: str | None) -> str:
    sql = f"CREATE POLICY {_policy_name(table, suffix)} ON {table} FOR {command}"
    if using is not None:
        sql += f" USING ({using})"
    if check is not None:
        sql += f" WITH CHECK ({check})"
    return sql + ";"


def upgrade() -> None:
    statements: list[str] = []
    for table in TABLES:
        statements += [
            f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;",
            f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;",
            f"REVOKE ALL ON {table} FROM PUBLIC;",
            f"GRANT {GRANTS[table]} ON {table} TO {APP_ROLE};",
        ]
    statements += [_create_policy(*policy) for policy in POLICIES]

    statements += [
        # D8: nobody, not even the owner, can change or remove audit entries.
        """
        CREATE FUNCTION audit_log_block_changes() RETURNS trigger
        LANGUAGE plpgsql SET search_path = '' AS $$
        BEGIN
            RAISE EXCEPTION 'audit_log is append-only' USING ERRCODE = 'insufficient_privilege';
        END
        $$;
        """,
        # Statement-level, so it fires even when RLS leaves zero rows to change, and for superusers.
        "CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_log "
        "FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_changes();",
        # Case references: RFR-<UTC year>-<5 digits>, taken before the insert (no RETURNING needed).
        f"CREATE SEQUENCE case_reference_seq AS integer START {REFERENCE_START} MINVALUE 1 MAXVALUE 99999 NO CYCLE;",
        "REVOKE ALL ON SEQUENCE case_reference_seq FROM PUBLIC;",
        """
        CREATE FUNCTION next_case_reference() RETURNS text
        LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
            SELECT 'RFR-' || to_char(now() AT TIME ZONE 'UTC', 'YYYY') || '-'
                   || lpad(nextval('public.case_reference_seq')::text, 5, '0')
        $$;
        """,
        "REVOKE ALL ON FUNCTION next_case_reference() FROM PUBLIC;",
        f"GRANT EXECUTE ON FUNCTION next_case_reference() TO {APP_ROLE};",
    ]
    for statement in statements:
        op.execute(statement)


def downgrade() -> None:
    statements = [
        "DROP FUNCTION IF EXISTS next_case_reference();",
        "DROP SEQUENCE IF EXISTS case_reference_seq;",
        "DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log;",
        "DROP FUNCTION IF EXISTS audit_log_block_changes();",
    ]
    statements += [f"DROP POLICY IF EXISTS {_policy_name(t, s)} ON {t};" for t, s, *_ in POLICIES]
    for table in TABLES:
        statements += [
            f"REVOKE ALL ON {table} FROM {APP_ROLE};",
            f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;",
            f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;",
        ]
    for statement in statements:
        op.execute(statement)
