"""A15: real pgvector, tenant policies and transcript integrity as app_user."""

import pytest
from sqlalchemy.exc import DBAPIError, IntegrityError

from .conftest import set_scope


@pytest.fixture(scope="module")
def knowledge(owner_engine, world):
    result = {}
    with owner_engine.begin() as c:
        set_scope(c, "system")
        for key, bank, status, audience in (
            ("public_b", "bank_b", "published", "victim_facing"),
            ("private_b", "bank_b", "published", "staff_only"),
            ("draft_b", "bank_b", "ready", "victim_facing"),
            ("public_a", "bank_a", "published", "victim_facing"),
        ):
            doc = c.exec_driver_sql(
                "insert into kb_documents (bank_id,title,version,language,audience,status,content,sha256,uploaded_by) "
                "values (%s,%s,'1','en',%s,%s,'x'::bytea,repeat('a',64),%s) returning id",
                (bank, key, audience, status, world["supervisor"]),
            ).scalar_one()
            passage = c.exec_driver_sql(
                "insert into kb_passages (document_id,bank_id,text,embedding,embedding_model) "
                "values (%s,%s,'report documents help',%s::vector,'gemini-embedding-001') returning id",
                (doc, bank, '[' + ','.join(['1'] + ['0'] * 767) + ']'),
            ).scalar_one()
            result[key] = (doc, passage)
        for key, bank in (("case_a2", "bank_a"), ("case_b1", "bank_b")):
            c.exec_driver_sql(
                "insert into chat_messages (case_id,bank_id,role,body,language,answer_type) "
                "values (%s,%s,'assistant','Test answer','en','no_answer')", (world[key], bank),
            )
    return result


@pytest.mark.parametrize("role,bank,user,expected", [
    ("victim", "bank_b", "victim1", {"public_b"}),
    ("victim", "bank_a", "victim1", set()),
    ("bank_viewer", "bank_b", "viewer_b", {"public_b", "private_b", "draft_b"}),
    ("operator", None, "operator", {"public_b", "private_b", "draft_b", "public_a"}),
    (None, None, None, set()),
])
def test_knowledge_scope(app_conn, world, knowledge, role, bank, user, expected):
    set_scope(app_conn, role, world[user] if user else None, bank)
    ids = set(app_conn.exec_driver_sql("select id from kb_passages").scalars())
    assert ids == {knowledge[key][1] for key in expected}


def test_victim_cannot_read_other_thread_or_rewrite_answer(app_conn, world, knowledge):
    set_scope(app_conn, "victim", world["victim1"], "bank_b")
    rows = app_conn.exec_driver_sql("select id,case_id::text from chat_messages").all()
    assert rows and {case for _, case in rows} == {world["case_b1"]}
    message = rows[0][0]
    app_conn.exec_driver_sql("update chat_messages set feedback='helpful' where id=%s", (message,))
    nested = app_conn.begin_nested()
    with pytest.raises(DBAPIError):
        app_conn.exec_driver_sql("update chat_messages set body='Changed' where id=%s", (message,))
    nested.rollback()


def test_case_bank_foreign_key_and_vector_dimension(owner_tx, world, knowledge):
    for statement, params in (
        ("insert into chat_messages (case_id,bank_id,role,body,language) values (%s,'bank_a','victim','Hi','en')",
         (world["case_b1"],)),
        ("insert into kb_passages(document_id,bank_id,text) values (%s,'bank_a','oops')",
         (knowledge["public_b"][0],)),
    ):
        nested = owner_tx.begin_nested()
        with pytest.raises(IntegrityError):
            owner_tx.exec_driver_sql(statement, params)
        nested.rollback()
    nested = owner_tx.begin_nested()
    with pytest.raises(DBAPIError):
        owner_tx.exec_driver_sql("update kb_passages set embedding='[1,0]'::vector where id=%s",
                                (knowledge["public_b"][1],))
    nested.rollback()


def test_chat_tables_force_rls_and_no_delete(app_conn, knowledge):
    rows = app_conn.exec_driver_sql("select relname,relrowsecurity,relforcerowsecurity from pg_class "
                                   "where relname in ('kb_documents','kb_passages','chat_messages')").all()
    assert len(rows) == 3 and all(enabled and forced for _, enabled, forced in rows)
    for table in ("kb_documents", "kb_passages", "chat_messages"):
        assert not app_conn.exec_driver_sql("select has_table_privilege(current_user,%s,'DELETE')", (table,)).scalar()
