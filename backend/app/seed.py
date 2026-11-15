"""Synthetic demo data (owner: Anim; API_SPEC §8, guide §7 rule 8).

    cd backend && uv run python -m app.seed          # uses MIGRATIONS_DATABASE_URL (the migrator)

Idempotent: every row has a fixed ID (or a unique key) and is inserted with
``ON CONFLICT DO NOTHING``, so running it twice changes nothing. It runs as the
table owner in the ``system`` scope, because ``FORCE ROW LEVEL SECURITY``
applies to the owner too.

Everything is invented: ``.test`` emails, ``0000`` phone blocks, and Galib's
synthetic bluebooks and sample documents. Dates are relative to the moment
of the first run, so deadlines and the overdue cases make sense in the demo.
"""

from __future__ import annotations

import hashlib
import json
import logging
import random
import sys
import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any, Final

from sqlalchemy import Connection, Engine, create_engine, text

from app.security import hash_password
from app.services.case_sql import STAGE_DAYS

log = logging.getLogger("app.seed")

BACKEND_DIR: Final = Path(__file__).resolve().parents[1]
BLUEBOOK_DIR: Final = BACKEND_DIR / "seed_data" / "bluebooks"
DOCUMENT_DIR: Final = BACKEND_DIR / "eval" / "extraction" / "documents"
LABELS_FILE: Final = BACKEND_DIR / "eval" / "extraction" / "labels.json"

DEMO_PASSWORD: Final = "Demo@1234"
_NAMESPACE: Final = uuid.UUID("5f0c4d1e-7a52-4c1b-9f3e-2b8a6d0c9e71")

BANKS: Final = {
    "bank_a": "Aster Regional Bank",
    "bank_b": "Birch Regional Bank",
    "bank_c": "Cobalt Regional Bank",
    "bank_d": "Dune Regional Bank",
    "bank_e": "Ember Regional Bank",
}
OPERATOR1_ID: Final = uuid.UUID("11111111-1111-4111-8111-111111111111")  # the contract's login example
CASE_42_ID: Final = uuid.UUID("7f3c2a9e-5b1d-4c8e-9a10-2d6f8b4e1c33")  # the contract's case example

# (email, name, role, bank_id, email verified)
ACCOUNTS: Final = (
    ("operator1@opscenter.test", "Operator One", "operator", None, True),
    ("operator2@opscenter.test", "Operator Two", "operator", None, True),
    ("supervisor@opscenter.test", "Supervisor Sato", "supervisor", None, True),
    ("viewer@bank-a.test", "Aster Viewer", "bank_viewer", "bank_a", True),
    ("viewer@bank-b.test", "Birch Viewer", "bank_viewer", "bank_b", True),
    ("victim1@mail.test", "Rina Example", "victim", None, True),
    ("victim2@mail.test", "Haruto Tanaka", "victim", None, True),
    ("victim3@mail.test", "Unverified Victim", "victim", None, False),
)
STATUSES: Final = ("received", "verified", "account_check", "notice_published", "payout_review", "closed")
SCAM_TYPES: Final = ("phishing", "impersonation", "investment", "romance", "lottery_prize", "job_offer", "other")
CHANNELS: Final = ("web_form", "phone", "paper")
FIRST_NAMES: Final = ("Aiko", "Kenji", "Yuki", "Sora", "Mei", "Daichi", "Hana", "Ren", "Emi", "Takumi", "Nao", "Kaito")
LAST_NAMES: Final = ("Suzuki", "Takahashi", "Ito", "Watanabe", "Yamamoto", "Nakamura", "Kobayashi", "Kato", "Mori")
GENERIC_CASES: Final = 40
OVERDUE_INDEXES: Final = frozenset({2, 9, 15, 21, 28, 33})
# Same receiving account in several cases: two same-bank rings and one cross-bank account (XREQ-004 story).
SHARED_ACCOUNTS: Final = {
    3: ("bank_b", "9876543210", "GLOBAL ASSET TRUST"),
    11: ("bank_b", "9876543210", "GLOBAL ASSET TRUST"),
    19: ("bank_a", "9876543210", "GLOBAL ASSET TRUST"),
    7: ("bank_d", "4455667", "Sakura Holdings LLC"),
    24: ("bank_d", "4455667", "Sakura Holdings LLC"),
    30: ("bank_b", "0012345", "Sample Trading LLC"),
}


def seed_id(key: str) -> uuid.UUID:
    return uuid.uuid5(_NAMESPACE, key)


def user_id(email: str) -> uuid.UUID:
    return OPERATOR1_ID if email == "operator1@opscenter.test" else seed_id(f"user:{email}")


@dataclass
class SeedCase:
    reference: str
    bank_id: str
    status: str
    channel: str
    victim_name: str
    days_in_stage: int
    age_days: int
    case_id: uuid.UUID | None = None
    victim_user_email: str | None = None
    victim_phone: str | None = None
    victim_email: str | None = None
    preferred_language: str = "ja"
    amount: Decimal | None = None
    transfer_date: date | None = None
    account_number: str | None = None
    account_holder_name: str | None = None
    scam_type: str | None = None
    description: str | None = None
    closure_reason: str | None = None
    assigned_operator: str | None = None
    document: str | None = None  # eval document id from labels.json
    extraction: str | None = None  # standard | low_confidence | rules_fallback | failed
    notes: list[str] = field(default_factory=list)

    @property
    def id(self) -> uuid.UUID:
        return self.case_id or seed_id(f"case:{self.reference}")


def _special_cases() -> list[SeedCase]:
    return [
        SeedCase(
            reference="RFR-2026-00042",
            case_id=CASE_42_ID,
            bank_id="bank_b",
            status="verified",
            channel="web_form",
            victim_name="Rina Example",
            victim_user_email="victim1@mail.test",
            victim_phone="+81-90-0000-0042",
            victim_email="victim1@mail.test",
            amount=Decimal("250000"),
            transfer_date=date(2026, 10, 28),
            account_number="0012345",
            account_holder_name="Sample Trading LLC",
            scam_type="impersonation",
            description="Caller said they were from the tax office and asked me to pay a refund fee.",
            days_in_stage=3,
            age_days=13,
            assigned_operator="operator1@opscenter.test",
            document="t02_netbank",
            notes=["Victim confirmed the transfer by phone."],
        ),
        SeedCase(
            reference="RFR-2026-00051",
            bank_id="bank_c",
            status="received",
            channel="web_form",
            victim_name="Haruto Tanaka",
            victim_user_email="victim2@mail.test",
            victim_email="victim2@mail.test",
            amount=Decimal("1450000"),
            transfer_date=date(2026, 11, 10),
            scam_type="impersonation",
            description="Pension imposter phone scam requesting an escrow transfer.",
            days_in_stage=1,
            age_days=1,
        ),
    ]


def _generic_cases(labels: list[dict[str, Any]]) -> list[SeedCase]:
    rng = random.Random(2026)
    banks = list(BANKS)
    extraction_kinds = ("low_confidence", "rules_fallback", "standard", "failed", "low_confidence")
    cases, documents = [], [label["id"] for label in labels]
    received_with_docs = 0
    for i in range(GENERIC_CASES):
        status = STATUSES[i % len(STATUSES)]
        stage_days = STAGE_DAYS.get(status, 30)
        days_in_stage = (
            stage_days + rng.randint(2, 9) if i in OVERDUE_INDEXES else rng.randint(0, max(0, stage_days - 2))
        )
        bank_id = banks[i % len(banks)]
        name = f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"
        case = SeedCase(
            reference=f"RFR-2026-{i + 1:05d}",
            bank_id=bank_id,
            status=status,
            channel=CHANNELS[i % 3],
            victim_name=name,
            days_in_stage=days_in_stage,
            age_days=days_in_stage + 3 + i % 20,
            victim_phone=f"+81-90-0000-{1000 + i:04d}",
            victim_email=f"case{i + 1:02d}@mail.test",
            preferred_language=("ja", "en", "bn")[i % 3],
            amount=Decimal(rng.randrange(50_000, 3_000_000, 5_000)),
            transfer_date=date(2026, 11, 14) - timedelta(days=days_in_stage + 5 + i % 20),
            account_number=f"{rng.randrange(1_000_000, 9_999_999)}",
            account_holder_name=f"{rng.choice(LAST_NAMES)} Trading",
            scam_type=SCAM_TYPES[i % len(SCAM_TYPES)],
            description="Synthetic demo case.",
            assigned_operator=("operator1@opscenter.test", "operator2@opscenter.test", None)[i % 3],
        )
        if status == "closed":
            case.closure_reason = ("paid_out", "rejected", "withdrawn")[(i // 6) % 3]
        if status == "received":
            # Received cases are still being filled in: some lack facts, a few have a document waiting for review.
            if i % 12 == 0:
                case.account_number = case.account_holder_name = None
            if received_with_docs < len(extraction_kinds):
                case.document = documents[received_with_docs % len(documents)]
                case.extraction = extraction_kinds[received_with_docs]
                received_with_docs += 1
        else:
            case.document = documents[i % len(documents)]
        if i in SHARED_ACCOUNTS:  # last, so nothing above can blank the shared account
            case.bank_id, case.account_number, case.account_holder_name = SHARED_ACCOUNTS[i]
        if i % 5 == 1:
            case.notes = ["Called the bank; waiting for the account check."]
        cases.append(case)
    return cases


# ------------------------------------------------------------------ writing


def _set_system_scope(conn: Connection) -> None:
    conn.execute(text("select set_config('app.role', 'system', true)"))


def _insert(conn: Connection, table: str, row: dict[str, Any], conflict: str = "(id)") -> bool:
    columns = ", ".join(row)
    values = ", ".join(f":{name}" for name in row)
    sql = f"insert into {table} ({columns}) values ({values}) on conflict {conflict} do nothing"
    return conn.execute(text(sql), row).rowcount == 1


def _seed_accounts(conn: Connection) -> None:
    for bank_id, name in BANKS.items():
        _insert(conn, "banks", {"id": bank_id, "name": name})
    password_hash = hash_password(DEMO_PASSWORD)
    for email, name, role, bank_id, verified in ACCOUNTS:
        _insert(
            conn,
            "users",
            {
                "id": user_id(email),
                "email": email,
                "name": name,
                "password_hash": password_hash,
                "role": role,
                "bank_id": bank_id,
                "email_verified_at": datetime.now(UTC) if verified else None,
            },
            conflict="(email)",
        )


def _extraction_row(case: SeedCase, label: dict[str, Any]) -> dict[str, Any]:
    kind = case.extraction
    if kind == "failed":
        return {
            "status": "failed",
            "source": "rules_fallback",
            "model": None,
            "prompt_version": None,
            "overall_confidence": None,
            "review_lane": None,
            "fields": "[]",
            "error": json.dumps(
                {"reason": "ai_unavailable", "message": "AI provider unreachable; enter fields manually"}
            ),
        }
    low = {"standard": 0.0, "low_confidence": 0.3, "rules_fallback": 0.25}[kind or "standard"]
    current = {"amount": case.amount, "transfer_date": case.transfer_date, "account_number": case.account_number}
    fields = []
    for position, (name, value) in enumerate(label["expected"].items()):
        confidence = round(0.95 - (low if position == 1 else 0.0) - 0.02 * position, 2)
        now_value = current.get(name)
        fields.append(
            {
                "name": name,
                "value": value,
                "confidence": confidence,
                "evidence": f"{name}: {value}",
                "current_case_value": float(now_value)
                if isinstance(now_value, Decimal)
                else now_value.isoformat()
                if isinstance(now_value, date)
                else now_value,
                "final_value": None,
            }
        )
    lowest = min(f["confidence"] for f in fields) if fields else None
    llm = kind != "rules_fallback"
    return {
        "status": "pending_review",
        "source": "llm" if llm else "rules_fallback",
        "model": "gemini-2.5-flash-lite" if llm else None,
        "prompt_version": "extract-v2" if llm else None,
        "overall_confidence": lowest,
        "review_lane": "standard" if lowest is not None and lowest >= 0.75 else "low_confidence",
        "fields": json.dumps(fields, ensure_ascii=False),
        "error": None,
    }


def _seed_case(conn: Connection, case: SeedCase, labels: dict[str, dict[str, Any]], now: datetime) -> None:
    created_at = now - timedelta(days=case.age_days)
    entered = now - timedelta(days=case.days_in_stage)
    closed = case.status == "closed"
    has_doc = case.document is not None
    pending = 1 if has_doc and case.extraction not in (None, "failed") else 0
    row = {
        "id": case.id,
        "reference": case.reference,
        "bank_id": case.bank_id,
        "status": case.status,
        "status_changed_at": entered,
        "channel": case.channel,
        "reported_date": created_at.date(),
        "deadline": None if closed else entered + timedelta(days=STAGE_DAYS[case.status]),
        "assigned_operator_id": user_id(case.assigned_operator) if case.assigned_operator else None,
        "victim_user_id": user_id(case.victim_user_email) if case.victim_user_email else None,
        "victim_name": case.victim_name,
        "victim_phone": case.victim_phone,
        "victim_email": case.victim_email,
        "preferred_language": case.preferred_language,
        "amount": case.amount,
        "currency": "JPY",
        "transfer_date": case.transfer_date,
        "account_number": case.account_number,
        "account_holder_name": case.account_holder_name,
        "scam_type": case.scam_type,
        "description": case.description,
        "consent_at": created_at if case.channel == "web_form" else None,
        "payout_amount": (case.amount * Decimal("0.8")).quantize(Decimal("1"))
        if case.closure_reason == "paid_out" and case.amount is not None
        else None,
        "closure_reason": case.closure_reason,
        "closed_at": entered if closed else None,
        "document_count": 1 if has_doc else 0,
        "pending_extraction_count": pending,
        "created_at": created_at,
        "updated_at": entered,
    }
    if not _insert(conn, "cases", row, conflict="(reference)"):
        return  # already seeded: leave it (and its children) exactly as they are

    operator1 = user_id("operator1@opscenter.test")
    if case.victim_user_email:
        actor = {
            "actor_type": "victim",
            "actor_id": user_id(case.victim_user_email),
            "actor_name": case.victim_name,
            "actor_role": "victim",
        }
    elif case.channel == "web_form":
        actor = {"actor_type": "public", "actor_id": None, "actor_name": "Web intake form", "actor_role": None}
    else:
        actor = {"actor_type": "user", "actor_id": operator1, "actor_name": "Operator One", "actor_role": "operator"}
    _audit(conn, f"created:{case.reference}", "case.created", case, "Case created", created_at, actor)

    if has_doc:
        _seed_document(conn, case, labels[case.document], created_at)
    for n, body in enumerate(case.notes):
        _insert(
            conn,
            "notes",
            {
                "id": seed_id(f"note:{case.reference}:{n}"),
                "case_id": case.id,
                "bank_id": case.bank_id,
                "author_id": operator1,
                "body": body,
                "created_at": created_at + timedelta(hours=2),
            },
        )


def _seed_document(conn: Connection, case: SeedCase, label: dict[str, Any], created_at: datetime) -> None:
    content = (DOCUMENT_DIR / label["file"]).read_bytes()
    document_id = seed_id(f"document:{case.reference}")
    uploaded_at = created_at + timedelta(hours=1)
    operator1 = user_id("operator1@opscenter.test")
    doc_type = label["doc_type"] if label["doc_type"] != "victim_report" else "intake_form"
    _insert(
        conn,
        "documents",
        {
            "id": document_id,
            "case_id": case.id,
            "bank_id": case.bank_id,
            "filename": label["file"],
            "doc_type": doc_type,
            "mime_type": label["mime_type"],
            "size_bytes": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
            "uploaded_by": operator1,
            "uploaded_at": uploaded_at,
        },
    )
    _insert(
        conn,
        "document_contents",
        {"document_id": document_id, "bank_id": case.bank_id, "content": content},
        conflict="(document_id)",
    )
    actor = {"actor_type": "user", "actor_id": operator1, "actor_name": "Operator One", "actor_role": "operator"}
    _audit(
        conn,
        f"uploaded:{case.reference}",
        "document.uploaded",
        case,
        f"Document uploaded: {label['file']}",
        uploaded_at,
        actor,
        {"document_id": str(document_id)},
    )
    if case.extraction is None:
        return
    _insert(
        conn,
        "ai_extractions",
        {
            "id": seed_id(f"extraction:{case.reference}"),
            "document_id": document_id,
            "case_id": case.id,
            "bank_id": case.bank_id,
            "created_at": uploaded_at + timedelta(minutes=1),
            **_extraction_row(case, label),
        },
    )


def _audit(
    conn: Connection,
    key: str,
    action: str,
    case: SeedCase,
    summary: str,
    at: datetime,
    actor: dict[str, Any],
    metadata: dict[str, Any] | None = None,
) -> None:
    _insert(
        conn,
        "audit_log",
        {
            "id": seed_id(f"audit:{key}"),
            "at": at,
            **actor,
            "action": action,
            "case_id": case.id,
            "bank_id": case.bank_id,
            "summary": summary,
            "metadata": json.dumps(metadata) if metadata else None,
        },
    )


def _seed_bluebooks(conn: Connection, now: datetime) -> None:
    books = json.loads((BLUEBOOK_DIR / "bluebooks.json").read_text(encoding="utf-8"))
    passages = json.loads((BLUEBOOK_DIR / "kb_passages.json").read_text(encoding="utf-8"))
    supervisor = user_id("supervisor@opscenter.test")
    for book in books:
        content = (BLUEBOOK_DIR / book["file"]).read_bytes()
        document_id = seed_id(f"kb:{book['bank_id']}:{book['version']}")
        own = [p for p in passages if p["bank_id"] == book["bank_id"]]
        _insert(
            conn,
            "kb_documents",
            {
                "id": document_id,
                "bank_id": book["bank_id"],
                "title": book["title"],
                "version": book["version"],
                "language": book["language"],
                "audience": book["audience"],
                "status": "published",
                "content": content,
                "sha256": hashlib.sha256(content).hexdigest(),
                "passage_count": len(own),
                "uploaded_by": supervisor,
                "uploaded_at": now - timedelta(days=30),
                "published_at": now - timedelta(days=29),
            },
        )
        for passage in own:
            conn.execute(
                text(
                    "insert into kb_passages (id, document_id, bank_id, section, page, text, embedding, embedding_model) "
                    "values (:id, :document_id, :bank_id, :section, :page, :text, cast(:embedding as vector), :model) "
                    "on conflict (id) do nothing"
                ),
                {
                    "id": seed_id(f"passage:{passage['passage_id']}"),
                    "document_id": document_id,
                    "bank_id": passage["bank_id"],
                    "section": passage.get("section"),
                    "page": passage.get("page"),
                    "text": passage["text"],
                    "embedding": json.dumps(passage["embedding"]),
                    "model": passage["embedding_model"],
                },
            )


def all_cases() -> list[SeedCase]:
    labels = json.loads(LABELS_FILE.read_text(encoding="utf-8"))
    return _special_cases() + _generic_cases(labels)


SEED_TABLES: Final = ("banks", "users", "cases", "documents", "ai_extractions", "notes", "kb_documents", "kb_passages")


def seed_into(conn: Connection, *, now: datetime | None = None) -> dict[str, int]:
    """Insert the demo data on an open connection (the caller commits or rolls back). Returns row counts."""
    now = now or datetime.now(UTC)
    labels = {label["id"]: label for label in json.loads(LABELS_FILE.read_text(encoding="utf-8"))}
    _set_system_scope(conn)
    _seed_accounts(conn)
    for case in all_cases():
        _seed_case(conn, case, labels, now)
    _seed_bluebooks(conn, now)
    return {table: conn.execute(text(f"select count(*) from {table}")).scalar_one() for table in SEED_TABLES}


def seed(engine: Engine, *, now: datetime | None = None) -> dict[str, int]:
    """Insert the demo data in one committed transaction. Safe to run again."""
    with engine.begin() as conn:
        return seed_into(conn, now=now)


def main() -> None:
    from app.config import get_settings

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    engine = create_engine(get_settings().migrations_database_url)
    try:
        counts = seed(engine)
    finally:
        engine.dispose()
    log.info("seeded: %s", ", ".join(f"{table}={count}" for table, count in counts.items()))
    log.info("demo logins (password %s): %s", DEMO_PASSWORD, ", ".join(email for email, *_ in ACCOUNTS))


if __name__ == "__main__":
    sys.exit(main())
