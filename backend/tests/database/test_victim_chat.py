"""A15 service integration: persistence, privacy, failure and concurrent rate limits."""

import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import text

from app import db
from app.models.chat import ChatFeedback, ChatQuestion
from app.services import retrieval, victim_chat as chat
from app.services.ai_errors import AIUnavailableError
from app.services.caller import StaticCaller
from app.services.service_errors import ServiceError
from .conftest import insert_case, insert_user, set_scope


@pytest.fixture
def chat_case(app_db, owner_engine, knowledge):
    with owner_engine.begin() as c:
        set_scope(c, "system")
        user = insert_user(c, f"chat-{uuid4().hex}@test.test", "victim")
        case = insert_case(c, "bank_b", victim_user_id=user, victim_name="Secret Name",
                           victim_email="secret@example.test", account_number="8765432100")
    return StaticCaller(UUID(user), "Chat victim", "victim"), UUID(case)


def no_embedding(_):
    raise AIUnavailableError("offline")


def grounded(question, passages, context, history, language):
    return {"answer_type": "grounded", "body": "Read the report guidance.",
            "used_passage_ids": [passages[0]["passage_id"]], "confidence": .8, "needs_staff": False,
            "model": "test", "prompt_version": "test"}


SETTINGS = chat.ChatSettings(embed=no_embedding, answer=grounded)


def test_persisted_exchange_citations_feedback_and_case_unchanged(chat_case):
    caller, case_id = chat_case
    before = retrieval.own_case(caller, case_id)
    exchange = chat.ask(caller, case_id, ChatQuestion(question="report documents", language="en"), SETTINGS)
    assert exchange.answer.answer_type == "grounded" and len(exchange.answer.citations) == 1
    thread = chat.get_thread(caller, case_id)
    assert [m.id for m in thread.messages] == [exchange.question.id, exchange.answer.id]
    assert thread.messages[0].author is None and not thread.victim_question_pending
    changed = chat.feedback(caller, case_id, UUID(exchange.answer.id), ChatFeedback(feedback="helpful"))
    assert changed.feedback == "helpful"
    after = retrieval.own_case(caller, case_id)
    assert {k: before[k] for k in ("status", "amount", "version")} == {k: after[k] for k in ("status", "amount", "version")}
    with db.scoped_session(caller.scope()) as s:
        assert s.exec(text("select cardinality(used_passage_ids) from chat_messages where id=:id"),
                      params={"id": exchange.answer.id}).scalar() == 1


def test_offline_has_citations_or_escalates(chat_case):
    caller, case_id = chat_case
    offline = chat.ChatSettings(ai_enabled=False)
    cited = chat.ask(caller, case_id, ChatQuestion(question="report"), offline)
    assert cited.answer.answer_type == "passages_only" and cited.answer.citations
    unknown = chat.ask(caller, case_id, ChatQuestion(question="unfindable"), offline)
    assert unknown.answer.answer_type == "no_answer" and unknown.answer.needs_staff
    assert chat.get_thread(caller, case_id, ai_enabled=False).victim_question_pending
    with db.system_session() as s:
        assert s.exec(text("select count(*) from audit_log where case_id=:id and action='chat.escalated'"),
                      params={"id": case_id}).scalar() == 1


def test_person_request_escalates_without_model_even_offline(chat_case):
    caller, case_id = chat_case
    answer = chat.ask(caller, case_id, ChatQuestion(question="Please talk to a person about my report"),
                      chat.ChatSettings(ai_enabled=False)).answer
    assert answer.needs_staff and answer.answer_type == "no_answer" and not answer.citations


def test_redacted_input_and_no_transaction_during_models(chat_case, owner_engine):
    caller, case_id = chat_case
    def assert_no_transaction():
        with owner_engine.connect() as c:
            assert c.exec_driver_sql("select count(*) from pg_stat_activity where datname=current_database() "
                                    "and usename='app_user' and state='idle in transaction'").scalar() == 0
    def embed(question):
        assert_no_transaction()
        assert "Secret Name" not in question and "@" not in question and "8765432100" not in question
        raise AIUnavailableError("offline")
    def answer(question, passages, context, history, language):
        assert_no_transaction()
        assert "Secret Name" not in str((question, context, history))
        assert "@" not in str((question, context, history))
        assert "account_number" not in context and "victim_name" not in context
        assert len(history) <= 6
        return grounded(question, passages, context, history, language)
    for _ in range(4):
        chat.ask(caller, case_id, ChatQuestion(question="Secret Name secret@example.test 8765432100 report"),
                 chat.ChatSettings(embed=embed, answer=answer))


def test_saved_answer_keeps_the_hotline_and_deadline(chat_case):
    caller, case_id = chat_case

    def with_hotline(question, passages, context, history, language):
        return {**grounded(question, passages, context, history, language),
                "body": "Secret Name, call the hotline 0120-000-000 before 2026-11-16."}

    answer = chat.ask(caller, case_id, ChatQuestion(question="report documents"),
                      replace(SETTINGS, answer=with_hotline)).answer
    assert "0120-000-000" in answer.body and "2026-11-16" in answer.body
    assert "Secret Name" not in answer.body


@pytest.mark.parametrize("bad", [
    {}, {"answer_type": "grounded", "body": "Invented", "used_passage_ids": ["other-bank"], "confidence": .9},
    {"answer_type": "grounded", "body": "Invented", "used_passage_ids": [], "confidence": float("nan")},
])
def test_invalid_model_answers_fall_back_to_real_citations(chat_case, bad):
    caller, case_id = chat_case
    answer = chat.ask(caller, case_id, ChatQuestion(question="report"),
                      replace(SETTINGS, answer=lambda *args: bad)).answer
    assert answer.answer_type == "passages_only" and answer.body != "Invented"


def test_model_timeout_is_bounded(chat_case):
    caller, case_id = chat_case
    def slow(*args):
        time.sleep(.3)
        return {}
    started = time.monotonic()
    answer = chat.ask(caller, case_id, ChatQuestion(question="report"),
                      replace(SETTINGS, answer=slow, timeout=.05)).answer
    assert answer.answer_type == "passages_only" and time.monotonic() - started < .25
    assert not chat.get_thread(caller, case_id).assistant_available


def test_foreign_case_message_and_wrong_role(chat_case, callers, world):
    caller, case_id = chat_case
    exchange = chat.ask(caller, case_id, ChatQuestion(question="report"), SETTINGS)
    for fn in (
        lambda: chat.get_thread(callers["victim1"], case_id),
        lambda: chat.ask(callers["victim1"], case_id, ChatQuestion(question="hello"), SETTINGS),
        lambda: chat.feedback(callers["victim1"], UUID(world["case_b1"]), UUID(exchange.answer.id),
                              ChatFeedback(feedback="helpful")),
    ):
        with pytest.raises(ServiceError) as e:
            fn()
        assert e.value.status == 404
    with pytest.raises(ServiceError) as e:
        chat.ask(callers["operator"], case_id, ChatQuestion(question="hello"), SETTINGS)
    assert e.value.status == 403
    with pytest.raises(ServiceError) as e:
        chat.feedback(caller, case_id, UUID(exchange.question.id), ChatFeedback(feedback="helpful"))
    assert e.value.status == 422


def test_concurrent_twentieth_question_one_wins(chat_case, owner_engine):
    caller, case_id = chat_case
    with owner_engine.begin() as c:
        set_scope(c, "system")
        c.exec_driver_sql("insert into chat_messages(case_id,bank_id,role,body,language) "
                          "select %s,'bank_b','victim','prior question','en' from generate_series(1,19)", (case_id,))
    def run():
        try:
            chat.ask(caller, case_id, ChatQuestion(question="report"), chat.ChatSettings(ai_enabled=False))
            return 201
        except ServiceError as e:
            assert 1 <= e.details["retry_after"] <= 3600
            return e.status
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(lambda _: run(), range(2))) == [201, 429]


def test_archived_during_answer_is_not_cited(chat_case, owner_engine, knowledge):
    caller, case_id = chat_case
    def archive_then_answer(*args):
        with owner_engine.begin() as c:
            set_scope(c, "system")
            c.exec_driver_sql("update kb_documents set status='archived' where id=%s", (knowledge["public_b"][0],))
        return grounded(*args)
    try:
        answer = chat.ask(caller, case_id, ChatQuestion(question="report"),
                          replace(SETTINGS, answer=archive_then_answer)).answer
        assert answer.answer_type == "no_answer" and not answer.citations and answer.needs_staff
    finally:
        with owner_engine.begin() as c:
            set_scope(c, "system")
            c.exec_driver_sql("update kb_documents set status='published' where id=%s", (knowledge["public_b"][0],))


@pytest.mark.parametrize("value", ["", "   ", "x" * 1001])
def test_question_validation(value):
    with pytest.raises(ValidationError):
        ChatQuestion(question=value)
