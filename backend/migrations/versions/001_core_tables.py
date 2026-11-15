"""Core tables: banks, accounts, cases, documents, AI extractions, notes, audit log.

Revision ID: 001_core
Revises:
Create Date: 2026-11-15

backend-plan.md §4 and backend-development-guide.md §7.
- Enums are text + CHECK with the same values as API_SPEC §3.4 (no Postgres enum types).
- Every bank-owned table carries its own bank_id so RLS policies (migration 002) need no joins.
  Composite foreign keys (case_id, bank_id) make that copy impossible to get wrong.
- Row-level security, grants, the audit trigger and next_case_reference() are in 002.
"""

from alembic import op

revision = "001_core"
down_revision = None
branch_labels = None
depends_on = None

ROLES = "'operator', 'supervisor', 'bank_viewer', 'victim'"
STAFF_INVITE_ROLES = "'operator', 'supervisor', 'bank_viewer'"
CASE_STATUSES = "'received', 'verified', 'account_check', 'notice_published', 'payout_review', 'closed'"
CLOSURE_REASONS = "'paid_out', 'rejected', 'withdrawn'"
SCAM_TYPES = "'phishing', 'impersonation', 'investment', 'romance', 'lottery_prize', 'job_offer', 'other'"
CHANNELS = "'web_form', 'phone', 'paper'"
LANGUAGES = "'en', 'ja', 'bn'"
DOCUMENT_TYPES = "'intake_form', 'transfer_receipt', 'bank_statement', 'police_report', 'id_document', 'other'"
MIME_TYPES = "'application/pdf', 'image/png', 'image/jpeg', 'text/plain'"
EXTRACTION_STATUSES = "'pending_review', 'accepted', 'rejected', 'failed'"
EXTRACTION_SOURCES = "'llm', 'rules_fallback'"
REVIEW_LANES = "'standard', 'low_confidence'"
ACTOR_TYPES = "'user', 'public', 'victim', 'system', 'ai'"
AUDIT_ACTIONS = ", ".join(
    f"'{a}'"
    for a in (
        "auth.login", "auth.login_failed", "auth.logout", "auth.signup", "auth.email_verified",
        "auth.password_reset", "user.invited", "user.invitation_revoked", "user.joined",
        "user.deactivated", "case.created", "case.viewed", "case.updated", "case.status_changed",
        "case.assigned", "case.deadline_changed", "case.victim_invited", "case.claimed",
        "note.added", "document.uploaded", "document.downloaded", "ai.extraction_completed",
        "ai.extraction_failed", "ai.review_accepted", "ai.review_rejected", "export.generated",
        "chat.escalated", "chat.staff_replied", "kb.document_uploaded", "kb.document_published",
        "kb.document_archived",
    )
)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

UPGRADE_SQL = f"""
CREATE TABLE banks (
    id   text PRIMARY KEY CHECK (id IN ('bank_a', 'bank_b', 'bank_c', 'bank_d', 'bank_e')),
    name text NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 1 AND 200)
);

CREATE TABLE users (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email             text NOT NULL UNIQUE CHECK (email = lower(email) AND char_length(email) BETWEEN 3 AND 254),
    name              text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
    password_hash     text NOT NULL,
    role              text NOT NULL CHECK (role IN ({ROLES})),
    bank_id           text REFERENCES banks (id),
    email_verified_at timestamptz,
    is_active         boolean NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_bank_only_for_viewers CHECK ((role = 'bank_viewer') = (bank_id IS NOT NULL))
);
CREATE INDEX users_bank_id_idx ON users (bank_id);

CREATE TABLE sessions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users (id),
    token_hash   text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{{64}}$'),
    created_at   timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL,
    revoked_at   timestamptz,
    last_used_at timestamptz,
    CONSTRAINT sessions_expiry_after_creation CHECK (expires_at > created_at)
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);

CREATE TABLE cases (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reference                text NOT NULL UNIQUE CHECK (reference ~ '^RFR-[0-9]{{4}}-[0-9]{{5}}$'),
    bank_id                  text NOT NULL REFERENCES banks (id),
    status                   text NOT NULL DEFAULT 'received' CHECK (status IN ({CASE_STATUSES})),
    status_changed_at        timestamptz NOT NULL DEFAULT now(),
    channel                  text NOT NULL CHECK (channel IN ({CHANNELS})),
    reported_date            date NOT NULL DEFAULT CURRENT_DATE,
    deadline                 timestamptz,
    assigned_operator_id     uuid REFERENCES users (id),
    victim_user_id           uuid REFERENCES users (id),
    victim_name              text NOT NULL CHECK (char_length(btrim(victim_name)) BETWEEN 1 AND 200),
    victim_phone             text,
    victim_email             text,
    victim_address           text,
    preferred_language       text NOT NULL DEFAULT 'en' CHECK (preferred_language IN ({LANGUAGES})),
    amount                   numeric(14, 2) CHECK (amount >= 0),
    currency                 text NOT NULL DEFAULT 'JPY' CHECK (currency ~ '^[A-Z]{{3}}$'),
    transfer_date            date,
    account_number           text,
    account_holder_name      text,
    scam_type                text CHECK (scam_type IN ({SCAM_TYPES})),
    description              text,
    consent_at               timestamptz,
    payout_amount            numeric(14, 2) CHECK (payout_amount >= 0),
    closure_reason           text CHECK (closure_reason IN ({CLOSURE_REASONS})),
    closed_at                timestamptz,
    document_count           integer NOT NULL DEFAULT 0 CHECK (document_count >= 0),
    pending_extraction_count integer NOT NULL DEFAULT 0 CHECK (pending_extraction_count >= 0),
    victim_question_pending  boolean NOT NULL DEFAULT false,
    possible_duplicate       boolean NOT NULL DEFAULT false,
    version                  integer NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cases_id_bank_key UNIQUE (id, bank_id),
    CONSTRAINT cases_closed_has_time CHECK ((status = 'closed') = (closed_at IS NOT NULL)),
    CONSTRAINT cases_closed_has_reason CHECK ((status = 'closed') = (closure_reason IS NOT NULL)),
    CONSTRAINT cases_payout_only_when_paid_out CHECK (payout_amount IS NULL OR closure_reason = 'paid_out'),
    CONSTRAINT cases_paid_out_has_payout CHECK (closure_reason IS DISTINCT FROM 'paid_out' OR payout_amount IS NOT NULL),
    CONSTRAINT cases_web_form_has_consent CHECK (channel <> 'web_form' OR consent_at IS NOT NULL)
);
CREATE INDEX cases_bank_status_idx ON cases (bank_id, status);
CREATE INDEX cases_bank_account_idx ON cases (bank_id, account_number);
CREATE INDEX cases_open_deadline_idx ON cases (deadline) WHERE status <> 'closed';
CREATE INDEX cases_open_assignee_idx ON cases (assigned_operator_id) WHERE status <> 'closed';
CREATE INDEX cases_victim_user_idx ON cases (victim_user_id);

CREATE TABLE auth_tokens (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purpose    text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password', 'claim_case')),
    user_id    uuid REFERENCES users (id),
    email      text CHECK (email = lower(email)),
    case_id    uuid REFERENCES cases (id),
    token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{{64}}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    CONSTRAINT auth_tokens_claim_has_case CHECK ((purpose = 'claim_case') = (case_id IS NOT NULL)),
    CONSTRAINT auth_tokens_claim_has_email CHECK (purpose <> 'claim_case' OR email IS NOT NULL),
    CONSTRAINT auth_tokens_account_has_user CHECK (purpose = 'claim_case' OR user_id IS NOT NULL)
);
CREATE INDEX auth_tokens_user_id_idx ON auth_tokens (user_id);
CREATE INDEX auth_tokens_case_id_idx ON auth_tokens (case_id);

CREATE TABLE invitations (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email            text NOT NULL CHECK (email = lower(email)),
    name             text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
    role             text NOT NULL CHECK (role IN ({STAFF_INVITE_ROLES})),
    bank_id          text REFERENCES banks (id),
    token_hash       text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{{64}}$'),
    status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    invited_by       uuid NOT NULL REFERENCES users (id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    expires_at       timestamptz NOT NULL,
    accepted_at      timestamptz,
    accepted_user_id uuid REFERENCES users (id),
    revoked_at       timestamptz,
    CONSTRAINT invitations_bank_only_for_viewers CHECK ((role = 'bank_viewer') = (bank_id IS NOT NULL)),
    CONSTRAINT invitations_accepted_has_user CHECK ((status = 'accepted') = (accepted_user_id IS NOT NULL))
);
CREATE UNIQUE INDEX invitations_one_pending_per_email ON invitations (email) WHERE status = 'pending';
CREATE INDEX invitations_invited_by_idx ON invitations (invited_by);
CREATE INDEX invitations_bank_id_idx ON invitations (bank_id);
CREATE INDEX invitations_accepted_user_idx ON invitations (accepted_user_id);

CREATE TABLE documents (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id     uuid NOT NULL,
    bank_id     text NOT NULL,
    filename    text NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 255),
    doc_type    text NOT NULL CHECK (doc_type IN ({DOCUMENT_TYPES})),
    mime_type   text NOT NULL CHECK (mime_type IN ({MIME_TYPES})),
    size_bytes  integer NOT NULL CHECK (size_bytes BETWEEN 1 AND {MAX_UPLOAD_BYTES}),
    sha256      text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{{64}}$'),
    uploaded_by uuid NOT NULL REFERENCES users (id),
    uploaded_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT documents_case_bank_fk FOREIGN KEY (case_id, bank_id) REFERENCES cases (id, bank_id),
    CONSTRAINT documents_id_bank_key UNIQUE (id, bank_id),
    CONSTRAINT documents_id_case_bank_key UNIQUE (id, case_id, bank_id)
);
CREATE INDEX documents_case_idx ON documents (case_id, uploaded_at);
CREATE INDEX documents_bank_idx ON documents (bank_id);
CREATE INDEX documents_uploaded_by_idx ON documents (uploaded_by);

-- File bytes, 1:1 with documents, read only by the download endpoint (D10).
CREATE TABLE document_contents (
    document_id uuid PRIMARY KEY,
    bank_id     text NOT NULL,
    content     bytea NOT NULL,
    CONSTRAINT document_contents_document_bank_fk FOREIGN KEY (document_id, bank_id) REFERENCES documents (id, bank_id)
);
CREATE INDEX document_contents_bank_idx ON document_contents (bank_id);

CREATE TABLE ai_extractions (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id        uuid NOT NULL,
    case_id            uuid NOT NULL,
    bank_id            text NOT NULL,
    status             text NOT NULL CHECK (status IN ({EXTRACTION_STATUSES})),
    source             text NOT NULL CHECK (source IN ({EXTRACTION_SOURCES})),
    model              text,
    prompt_version     text,
    overall_confidence numeric(4, 3) CHECK (overall_confidence BETWEEN 0 AND 1),
    review_lane        text CHECK (review_lane IN ({REVIEW_LANES})),
    fields             jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(fields) = 'array'),
    missing_fields     text[] NOT NULL DEFAULT '{{}}',
    error              jsonb,
    created_at         timestamptz NOT NULL DEFAULT now(),
    reviewed_by        uuid REFERENCES users (id),
    reviewed_at        timestamptz,
    review_note        text,
    CONSTRAINT ai_extractions_document_fk FOREIGN KEY (document_id, case_id, bank_id)
        REFERENCES documents (id, case_id, bank_id),
    CONSTRAINT ai_extractions_reviewed_iff_decided CHECK (
        (status IN ('accepted', 'rejected')) = (reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
    )
);
CREATE INDEX ai_extractions_queue_idx ON ai_extractions (status, review_lane, created_at);
CREATE INDEX ai_extractions_document_idx ON ai_extractions (document_id, case_id, bank_id);
CREATE INDEX ai_extractions_case_idx ON ai_extractions (case_id);
CREATE INDEX ai_extractions_bank_idx ON ai_extractions (bank_id);
CREATE INDEX ai_extractions_reviewed_by_idx ON ai_extractions (reviewed_by);

CREATE TABLE notes (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id    uuid NOT NULL,
    bank_id    text NOT NULL,
    author_id  uuid NOT NULL REFERENCES users (id),
    body       text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 5000),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT notes_case_bank_fk FOREIGN KEY (case_id, bank_id) REFERENCES cases (id, bank_id)
);
CREATE INDEX notes_case_idx ON notes (case_id, created_at);
CREATE INDEX notes_bank_idx ON notes (bank_id);
CREATE INDEX notes_author_idx ON notes (author_id);

-- One history trail (D9), append-only (D8, enforced in 002).
CREATE TABLE audit_log (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    at         timestamptz NOT NULL DEFAULT now(),
    actor_type text NOT NULL CHECK (actor_type IN ({ACTOR_TYPES})),
    actor_id   uuid REFERENCES users (id),
    actor_name text,
    actor_role text,
    action     text NOT NULL CHECK (action IN ({AUDIT_ACTIONS})),
    case_id    uuid,
    bank_id    text REFERENCES banks (id),
    summary    text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 500),
    changes    jsonb,
    metadata   jsonb,
    CONSTRAINT audit_log_case_bank_fk FOREIGN KEY (case_id, bank_id) REFERENCES cases (id, bank_id),
    CONSTRAINT audit_log_case_has_bank CHECK (case_id IS NULL OR bank_id IS NOT NULL)
);
CREATE INDEX audit_log_case_at_idx ON audit_log (case_id, at DESC);
CREATE INDEX audit_log_bank_at_idx ON audit_log (bank_id, at DESC);
CREATE INDEX audit_log_at_idx ON audit_log (at DESC);
CREATE INDEX audit_log_actor_idx ON audit_log (actor_id);
"""

DOWNGRADE_SQL = """
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS ai_extractions;
DROP TABLE IF EXISTS document_contents;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS invitations;
DROP TABLE IF EXISTS auth_tokens;
DROP TABLE IF EXISTS cases;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS banks;
"""


def upgrade() -> None:
    op.execute(UPGRADE_SQL)


def downgrade() -> None:
    op.execute(DOWNGRADE_SQL)
