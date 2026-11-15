"""Persisted victim chat, bounded AI work and escalation (A15; owner: Asif).

Calls open their own short scoped sessions. Routers must not wrap ask() in a
transaction. The question is committed before AI work so concurrent requests
cannot bypass the hourly cap; failures never discard a submitted question.
"""

from __future__ import annotations

import math
import re
import threading
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, replace
from datetime import timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import column, func, insert, select, table, text, update
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID

from app import db
from app.models.chat import ChatExchange, ChatFeedback, ChatMessage, ChatQuestion, ChatThread
from app.models.documents import UserRef
from app.services import audit, case_sql, retrieval
from app.services.ai_errors import AIUnavailableError
from app.services.caller import Caller
from app.services.documents import CaseRef
from app.services.service_errors import ServiceError, forbidden, not_found, validation_error

messages = table("chat_messages", *(column(k) for k in (
    "id", "case_id", "bank_id", "role", "body", "language", "created_at", "author_id", "author_name",
    "answer_type", "confidence", "needs_staff", "feedback", "reply_to", "model", "prompt_version", "latency_ms",
)), column("citations", JSONB), column("used_passage_ids", ARRAY(PGUUID(as_uuid=True))))
_POOL = ThreadPoolExecutor(max_workers=4, thread_name_prefix="case-assistant")
_SLOTS = threading.BoundedSemaphore(4)
_unavailable_until = 0.0
_WANTS_PERSON = re.compile(r"talk to (?:a |an )?(?:person|human|staff)|contact (?:a |the )?staff|担当者|人と話|কর্মী", re.I)


def assistant_available() -> bool:
    """Recent local provider status for health/thread output, not a network probe."""
    return time.monotonic() >= _unavailable_until


def _embed(question: str) -> list[float]:
    from app.services.rag import embed
    return embed([question], task="query")[0]


def _answer(*args: Any) -> dict[str, Any]:
    from app.services.rag import answer
    return answer(*args)


@dataclass(frozen=True)
class ChatSettings:
    timeout: float = 20.0
    embedding_timeout: float = 4.0
    ai_enabled: bool = True
    embed: Callable = _embed
    answer: Callable = _answer


def _bounded(fn: Callable, *args: Any, timeout: float) -> Any:
    if timeout <= 0 or not _SLOTS.acquire(blocking=False):
        raise AIUnavailableError("Assistant busy")
    try:
        future = _POOL.submit(fn, *args)
    except Exception:
        _SLOTS.release()
        raise
    future.add_done_callback(lambda _: _SLOTS.release())
    try:
        return future.result(timeout=timeout)
    except Exception as exc:
        future.cancel()
        raise AIUnavailableError("Assistant unavailable") from exc


def _message(row: Any) -> ChatMessage:
    return ChatMessage(
        id=str(row["id"]), role=row["role"], body=row["body"], language=row["language"],
        created_at=row["created_at"], answer_type=row["answer_type"], citations=row["citations"],
        confidence=row["confidence"], needs_staff=row["needs_staff"], feedback=row["feedback"],
        author=UserRef(id=str(row["author_id"]), name=row["author_name"]) if row["role"] == "staff" else None,
    )


def _check_case(s: Any, caller: Caller, case_id: UUID) -> dict[str, Any]:
    if caller.role not in ("victim", "operator", "supervisor", "bank_viewer"):
        raise forbidden()
    case = dict(case_sql.require_case(s, case_id))
    if caller.role == "victim" and case["victim_user_id"] != caller.user_id:
        raise not_found()
    return case


def get_thread(caller: Caller, case_id: UUID, *, ai_enabled: bool = True) -> ChatThread:
    """GET victim chat; also safe for Anim's staff GET route (same public transcript)."""
    with db.scoped_session(caller.scope()) as s:
        case = _check_case(s, caller, case_id)
        rows = s.exec(select(messages).where(messages.c.case_id == case_id)
                      .order_by(messages.c.created_at, messages.c.id)).mappings().all()
        return ChatThread(case_reference=case["reference"], messages=[_message(r) for r in rows],
                          victim_question_pending=case["victim_question_pending"],
                          assistant_available=ai_enabled and assistant_available())


def feedback(caller: Caller, case_id: UUID, message_id: UUID, data: ChatFeedback) -> ChatMessage:
    if caller.role != "victim":
        raise forbidden()
    with db.scoped_session(caller.scope()) as s:
        _check_case(s, caller, case_id)
        row = s.exec(select(messages).where(messages.c.id == message_id,
                                             messages.c.case_id == case_id)).mappings().first()
        if row is None:
            raise not_found("Message")
        if row["role"] != "assistant":
            raise validation_error("message_id", "Only assistant answers accept feedback")
        changed = s.exec(update(messages).where(messages.c.id == message_id)
                         .values(feedback=data.feedback).returning(*messages.c)).mappings().one()
        result = _message(changed)
        s.commit()
        return result


def _fallback(passages: list[dict], language: str) -> dict[str, Any]:
    notices = {
        "en": ("The assistant is unavailable. Please read the cited guidance; this is not a payout decision.",
               "I could not find guidance for this question. Staff will reply in this conversation."),
        "ja": ("アシスタントを利用できません。引用された案内をご確認ください。支払いの決定ではありません。",
               "この質問への案内が見つかりませんでした。担当者がこちらで回答します。"),
        "bn": ("সহকারী এখন উপলব্ধ নেই। উদ্ধৃত নির্দেশিকা পড়ুন; এটি অর্থ প্রদানের সিদ্ধান্ত নয়।",
               "এই প্রশ্নের নির্দেশনা পাওয়া যায়নি। একজন কর্মী এখানে উত্তর দেবেন।"),
    }
    return {"answer_type": "passages_only" if passages else "no_answer",
            "body": notices[language][0 if passages else 1],
            "used_passage_ids": [p["passage_id"] for p in passages],
            "confidence": None, "needs_staff": not bool(passages), "model": None, "prompt_version": None}


def _validated(raw: Any, passages: list[dict], language: str) -> dict[str, Any]:
    """Unknown citations, empty output and invalid scores never become a grounded answer."""
    given = {p["passage_id"] for p in passages}
    try:
        kind = raw["answer_type"]
        used = raw["used_passage_ids"]
        confidence = raw["confidence"]
        body = raw["body"]
        if (kind not in ("grounded", "no_answer", "refused") or not isinstance(used, list)
                or not all(isinstance(i, str) and i in given for i in used)
                or not isinstance(body, str) or not body.strip() or len(body) > 8000
                or type(confidence) not in (int, float) or not math.isfinite(confidence)
                or not 0 <= confidence <= 1 or (kind == "grounded" and not used)):
            raise ValueError("Invalid answer")
        return {"answer_type": kind, "body": body, "used_passage_ids": list(dict.fromkeys(used)) if kind == "grounded" else [],
                "confidence": confidence, "needs_staff": kind == "no_answer",
                "model": str(raw.get("model") or "")[:200] or None,
                "prompt_version": str(raw.get("prompt_version") or "")[:100] or None}
    except (KeyError, TypeError, ValueError, OverflowError):
        return _fallback(passages, language)


def ask(caller: Caller, case_id: UUID, data: ChatQuestion,
        settings: ChatSettings = ChatSettings()) -> ChatExchange:
    global _unavailable_until
    if caller.role != "victim":
        raise forbidden()
    started = time.monotonic()
    # Lock only for the count + reservation; no lock or connection during the AI call.
    with db.scoped_session(caller.scope()) as s:
        case = _check_case(s, caller, case_id)
        s.exec(select(case_sql.cases.c.id).where(case_sql.cases.c.id == case_id).with_for_update()).one()
        now = case_sql.now()
        recent = s.exec(select(func.count(), func.min(messages.c.created_at)).where(
            messages.c.case_id == case_id, messages.c.role == "victim",
            messages.c.created_at > now - timedelta(hours=1))).one()
        if recent[0] >= 20:
            retry = max(1, math.ceil((recent[1] + timedelta(hours=1) - now).total_seconds()))
            raise ServiceError(429, "RATE_LIMITED", "At most 20 questions per case per hour",
                               {"retry_after": retry})
        language = data.language or case["preferred_language"]
        history = s.exec(select(messages).where(messages.c.case_id == case_id)
                         .order_by(messages.c.created_at.desc(), messages.c.id.desc()).limit(6)).mappings().all()
        row = s.exec(insert(messages).values(id=uuid4(), case_id=case_id, bank_id=case["bank_id"],
                                             role="victim", body=data.question, language=language)
                     .returning(*messages.c)).mappings().one()
        question = _message(row)
        s.commit()

    safe_question = retrieval.redact(data.question, case)
    safe_history = [{"role": m["role"], "body": retrieval.redact(m["body"], case)} for m in reversed(history)]
    vector = None
    wants_person = bool(_WANTS_PERSON.search(safe_question))
    if settings.ai_enabled and not wants_person:
        try:
            vector = _bounded(settings.embed, safe_question, timeout=min(settings.embedding_timeout, settings.timeout))
        except AIUnavailableError:
            pass  # keyword retrieval remains available
    passages = [] if wants_person else retrieval.retrieve(caller, case_id, safe_question, vector)
    result = _fallback(passages, language)
    if settings.ai_enabled and not wants_person:
        try:
            raw = _bounded(settings.answer, safe_question, retrieval.ai_passages(passages),
                           retrieval.case_context(case), safe_history, language,
                           timeout=settings.timeout - (time.monotonic() - started))
            result = _validated(raw, passages, language)
            _unavailable_until = 0.0
        except AIUnavailableError:
            _unavailable_until = time.monotonic() + 30.0

    with db.scoped_session(replace(caller.scope(), bank_id=case["bank_id"])) as s:
        current = _check_case(s, caller, case_id)
        # A supervisor may archive guidance while the model is answering. Never newly cite it afterward.
        published = set(s.exec(text("SELECT id::text FROM kb_documents WHERE bank_id=:bank "
                                    "AND status='published' AND audience='victim_facing'"),
                               params={"bank": case["bank_id"]}).scalars())
        selected = [p for p in passages if p["passage_id"] in result["used_passage_ids"]]
        if current["bank_id"] != case["bank_id"] or any(p["document_id"] not in published for p in selected):
            result, selected = _fallback([], language), []
        citations = [{"document_id": p["document_id"], "document_title": p["document_title"],
                      "version": p["version"], "section": p["section"], "page": p["page"], "quote": p["text"]}
                     for p in selected]
        answer_row = s.exec(insert(messages).values(
            id=uuid4(), case_id=case_id, bank_id=current["bank_id"], role="assistant",
            body=retrieval.redact(result["body"], case), language=language,
            answer_type=result["answer_type"], citations=citations, confidence=result["confidence"],
            needs_staff=result["needs_staff"], reply_to=UUID(question.id),
            used_passage_ids=[UUID(p["passage_id"]) for p in selected],
            model=result["model"], prompt_version=result["prompt_version"],
            latency_ms=int((time.monotonic() - started) * 1000),
        ).returning(*messages.c)).mappings().one()
        if result["needs_staff"]:
            s.exec(update(case_sql.cases).where(case_sql.cases.c.id == case_id).values(victim_question_pending=True))
            audit.record(s, action="chat.escalated", actor=caller.actor(), case=CaseRef(case_id, current["bank_id"]),
                         summary="Victim question needs a staff reply", metadata={"message_id": str(answer_row["id"])})
        answer = _message(answer_row)
        s.commit()
        return ChatExchange(question=question, answer=answer)
