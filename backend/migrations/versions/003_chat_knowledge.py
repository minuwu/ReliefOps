"""Case assistant storage and bank-scoped knowledge (A15).

Enable the vector extension as a database administrator before migrating.
Downgrading removes our tables, never the shared extension.
"""

import os
import re

from alembic import op

revision = "003_chat"
down_revision = "002_rls"
branch_labels = None
depends_on = None

APP_ROLE = os.environ.get("APP_DB_ROLE", "app_user")
if not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", APP_ROLE):
    raise ValueError("APP_DB_ROLE must be a plain lower-case identifier")

ROLE = "(SELECT current_setting('app.role', true))"
USER = "(SELECT nullif(current_setting('app.user_id', true), '')::uuid)"
BANK = "(SELECT nullif(current_setting('app.bank_id', true), ''))"
SYSTEM = f"{ROLE} = 'system'"
STAFF = f"{ROLE} IN ('operator', 'supervisor')"
VIEWER = f"({ROLE} = 'bank_viewer' AND bank_id = {BANK})"


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT FROM pg_extension WHERE extname = 'vector') THEN
                RAISE EXCEPTION 'Enable pgvector first: CREATE EXTENSION vector (as database administrator)';
            END IF;
        END $$;
    """)
    op.execute("""
        CREATE TABLE kb_documents (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            bank_id text NOT NULL REFERENCES banks(id),
            title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
            version text NOT NULL CHECK (length(version) BETWEEN 1 AND 100),
            language text NOT NULL CHECK (language IN ('en','ja','bn')),
            audience text NOT NULL CHECK (audience IN ('victim_facing','staff_only')),
            status text NOT NULL DEFAULT 'processing'
                CHECK (status IN ('processing','ready','published','archived','failed')),
            content bytea NOT NULL CHECK (octet_length(content) <= 20971520),
            sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
            passage_count integer CHECK (passage_count >= 0), error text,
            uploaded_by uuid NOT NULL REFERENCES users(id),
            uploaded_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,
            UNIQUE (id, bank_id)
        );
        CREATE INDEX kb_documents_bank_status ON kb_documents(bank_id, status);
        CREATE UNIQUE INDEX kb_documents_one_published
            ON kb_documents(bank_id, title, audience, language) WHERE status = 'published';
        CREATE TABLE kb_passages (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            document_id uuid NOT NULL, bank_id text NOT NULL,
            section text, page integer CHECK (page >= 1),
            text text NOT NULL CHECK (length(trim(text)) > 0),
            embedding vector(768), embedding_model text,
            tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', text)) STORED,
            FOREIGN KEY (document_id, bank_id) REFERENCES kb_documents(id, bank_id),
            CHECK ((embedding IS NULL) = (embedding_model IS NULL))
        );
        CREATE INDEX kb_passages_bank_document ON kb_passages(bank_id, document_id);
        CREATE INDEX kb_passages_search ON kb_passages USING gin(tsv);
        CREATE TABLE chat_messages (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            case_id uuid NOT NULL, bank_id text NOT NULL,
            role text NOT NULL CHECK (role IN ('victim','assistant','staff')),
            body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 8000),
            language text NOT NULL CHECK (language IN ('en','ja','bn')),
            answer_type text CHECK (answer_type IN ('grounded','passages_only','no_answer','refused')),
            citations jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(citations) = 'array'),
            confidence double precision CHECK (confidence >= 0 AND confidence <= 1),
            needs_staff boolean NOT NULL DEFAULT false,
            used_passage_ids uuid[] NOT NULL DEFAULT '{}', model text, prompt_version text,
            latency_ms integer CHECK (latency_ms >= 0),
            feedback text CHECK (feedback IN ('helpful','not_helpful')),
            author_id uuid REFERENCES users(id), author_name text,
            reply_to uuid UNIQUE REFERENCES chat_messages(id),
            created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            FOREIGN KEY (case_id, bank_id) REFERENCES cases(id, bank_id),
            CHECK ((role = 'assistant') = (answer_type IS NOT NULL)),
            CHECK (role = 'assistant' OR (feedback IS NULL AND citations = '[]'::jsonb
                AND confidence IS NULL AND NOT needs_staff)),
            CHECK (role <> 'staff' OR (author_id IS NOT NULL AND author_name IS NOT NULL)),
            CHECK (role <> 'victim' OR length(body) <= 1000)
        );
        CREATE INDEX chat_messages_case_time ON chat_messages(case_id, created_at, id);
        CREATE INDEX chat_messages_questions ON chat_messages(case_id, created_at) WHERE role = 'victim';
    """)
    # FORCE also applies to the migrator. No application DELETE/TRUNCATE grants.
    for table in ("kb_documents", "kb_passages", "chat_messages"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON {table} FROM PUBLIC")
        op.execute(f"GRANT SELECT, INSERT, UPDATE ON {table} TO {APP_ROLE}")
        op.execute(f"CREATE POLICY {table}_system ON {table} FOR ALL USING ({SYSTEM}) WITH CHECK ({SYSTEM})")

    victim_bank = (f"{ROLE} = 'victim' AND bank_id = {BANK} AND EXISTS "
                   f"(SELECT 1 FROM cases c WHERE c.bank_id = {BANK} AND c.victim_user_id = {USER})")
    op.execute(f"""CREATE POLICY kb_documents_read ON kb_documents FOR SELECT USING (
        {STAFF} OR {VIEWER} OR ({victim_bank} AND status = 'published' AND audience = 'victim_facing'))""")
    op.execute(f"""CREATE POLICY kb_documents_manage ON kb_documents FOR ALL
        USING ({ROLE} = 'supervisor') WITH CHECK ({ROLE} = 'supervisor')""")
    op.execute(f"""CREATE POLICY kb_passages_read ON kb_passages FOR SELECT USING (
        {STAFF} OR {VIEWER} OR ({victim_bank} AND EXISTS
          (SELECT 1 FROM kb_documents d WHERE d.id = document_id
           AND d.status = 'published' AND d.audience = 'victim_facing')))""")
    op.execute(f"""CREATE POLICY kb_passages_manage ON kb_passages FOR ALL
        USING ({ROLE} = 'supervisor') WITH CHECK ({ROLE} = 'supervisor')""")

    own = (f"{ROLE} = 'victim' AND EXISTS (SELECT 1 FROM cases c "
           f"WHERE c.id = case_id AND c.victim_user_id = {USER})")
    op.execute(f"CREATE POLICY chat_read ON chat_messages FOR SELECT USING ({STAFF} OR {VIEWER} OR ({own}))")
    op.execute(f"""CREATE POLICY chat_insert ON chat_messages FOR INSERT WITH CHECK (
        ({STAFF} AND role = 'staff' AND author_id = {USER}) OR
        ({own} AND role IN ('victim','assistant') AND author_id IS NULL))""")
    op.execute(f"""CREATE POLICY chat_feedback ON chat_messages FOR UPDATE
        USING ({own} AND role = 'assistant') WITH CHECK ({own} AND role = 'assistant')""")
    # UPDATE permission is necessary for feedback, never permission to rewrite a transcript.
    op.execute("""
        CREATE FUNCTION chat_feedback_only() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF current_setting('app.role', true) IS DISTINCT FROM 'system'
               AND (to_jsonb(NEW) - 'feedback') IS DISTINCT FROM (to_jsonb(OLD) - 'feedback') THEN
                RAISE EXCEPTION 'Only feedback may be updated' USING ERRCODE = 'insufficient_privilege';
            END IF;
            RETURN NEW;
        END $$;
        CREATE TRIGGER chat_feedback_only BEFORE UPDATE ON chat_messages
            FOR EACH ROW EXECUTE FUNCTION chat_feedback_only();
    """)


def downgrade() -> None:
    op.execute("DROP TABLE chat_messages")
    op.execute("DROP FUNCTION chat_feedback_only()")
    op.execute("DROP TABLE kb_passages")
    op.execute("DROP TABLE kb_documents")
