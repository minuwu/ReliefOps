"""A15: bank-filtered retrieval and personal-data minimization (owner: Asif)."""

from __future__ import annotations

import json
import math
import re
from dataclasses import replace
from typing import Any
from uuid import UUID

from sqlalchemy import text

from app import db
from app.services import audit, case_sql
from app.services.caller import Caller
from app.services.service_errors import forbidden, not_found

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 768
PERSONAL_FIELDS = ("victim_name", "victim_phone", "victim_email", "victim_address",
                   "account_number", "account_holder_name")


def own_case(caller: Caller, case_id: UUID) -> dict[str, Any]:
    if caller.role != "victim":
        raise forbidden()
    with db.scoped_session(caller.scope()) as s:
        case = dict(case_sql.require_case(s, case_id))
        if case["victim_user_id"] != caller.user_id:
            raise not_found()
        return case


def case_context(case: dict[str, Any]) -> dict[str, Any]:
    """No names, accounts, notes, owners, internal deadlines or free-text reports."""
    elapsed = max(0, (case_sql.now() - case["status_changed_at"]).days)
    return audit.to_json({
        "status": case["status"], "time_in_stage": elapsed,
        "missing_information": case_sql.missing_fields(case), "scam_type": case["scam_type"],
        "amount": case["amount"], "transfer_date": case["transfer_date"],
        "closure_reason": case["closure_reason"],
    })


def redact(body: str, case: dict[str, Any]) -> str:
    """Remove known case identifiers plus email/phone-like text before external calls.

    This is deterministic minimization, not a general detector of unknown names
    or addresses someone may type. Never claim arbitrary free text is PII-free.
    """
    values = sorted({str(case[k]) for k in PERSONAL_FIELDS if case.get(k)}, key=len, reverse=True)
    for value in values:
        body = re.sub(re.escape(value), "[redacted]", body, flags=re.IGNORECASE)
    body = re.sub(r"[\w.+-]+@[\w.-]+\.[\w-]+", "[redacted]", body)
    return re.sub(r"(?<!\w)\+?\d[\d ()-]{5,}\d(?!\w)", "[redacted]", body)


def valid_vector(vector: Any) -> bool:
    return (isinstance(vector, list) and len(vector) == EMBEDDING_DIM
            and all(type(v) in (float, int) and math.isfinite(v) for v in vector)
            and any(v != 0 for v in vector))


def retrieve(caller: Caller, case_id: UUID, question: str,
             embedding: list[float] | None = None) -> list[dict[str, Any]]:
    """Top five passages. The bank is derived from an owned case, never a client parameter.

    No external call occurs here. Supply an embedding computed outside a DB transaction;
    None/invalid vectors use keyword-only retrieval. Exact vector search suits the 70-row seed.
    """
    case = own_case(caller, case_id)
    bank = case["bank_id"]
    question = redact(question, case)
    keywords = " OR ".join(re.findall(r"\w{2,}", question, flags=re.UNICODE)[:30])
    vector_sql = "0.0"
    params: dict[str, Any] = {"bank": bank, "query": keywords, "model": EMBEDDING_MODEL}
    if valid_vector(embedding):
        params["embedding"] = json.dumps(embedding, allow_nan=False)
        vector_sql = ("CASE WHEN p.embedding_model = :model AND p.embedding IS NOT NULL "
                      "THEN greatest(0.0, 1.0 - (p.embedding <=> cast(:embedding AS vector))) ELSE 0.0 END")
    sql = text(f"""
        WITH candidates AS MATERIALIZED (
            SELECT p.id AS passage_id, p.document_id, p.text, p.section, p.page,
                   d.title AS document_title, d.version,
                   ts_rank_cd(p.tsv, websearch_to_tsquery('simple', :query), 32) AS keyword_score,
                   {vector_sql} AS semantic_score
            FROM kb_passages p JOIN kb_documents d ON d.id = p.document_id AND d.bank_id = p.bank_id
            WHERE p.bank_id = :bank AND d.status = 'published' AND d.audience = 'victim_facing'
        )
        SELECT *, least(1.0, 0.7 * semantic_score + 0.3 * keyword_score) AS score
        FROM candidates WHERE keyword_score > 0 OR semantic_score >= 0.35
        ORDER BY score DESC, passage_id LIMIT 5
    """)
    with db.scoped_session(replace(caller.scope(), bank_id=bank)) as s:
        rows = s.exec(sql, params=params).mappings().all()
        return [{**dict(row), "passage_id": str(row["passage_id"]),
                 "document_id": str(row["document_id"]), "score": float(row["score"])} for row in rows]


def ai_passages(passages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Only the declared Galib interface; document metadata stays server-side for citations."""
    return [{key: p[key] for key in ("passage_id", "text", "section", "page", "score")} for p in passages]
