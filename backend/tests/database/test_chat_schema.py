"""A15: real pgvector, tenant policies and transcript integrity as app_user."""

import pytest
from sqlalchemy.exc import DBAPIError, IntegrityError

from .conftest import set_scope


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
