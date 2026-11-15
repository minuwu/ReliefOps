"""app/services/documents.py: upload and download case documents (API_SPEC §6.5)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from sqlalchemy import Engine, text

from app import db
from app.services import case_sql, documents
from app.services.document_files import MAX_UPLOAD_BYTES
from app.services.service_errors import ServiceError

from .conftest import insert_case, set_scope

RECEIPT = b"Transfer amount: 250,000 yen\nDate: 2026-10-28\n"


def new_case(owner_engine: Engine, bank_id: str = "bank_a", **columns: object) -> UUID:
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        return UUID(insert_case(conn, bank_id, **columns))


def upload(caller, case_id: UUID, data: bytes = RECEIPT, doc_type: str = "transfer_receipt"):  # noqa: ANN001, ANN201
    with db.scoped_session(caller.scope()) as s:
        return documents.upload_document(s, caller, case_id, data=data, filename="receipt.txt", doc_type=doc_type)


def test_upload_stores_the_file_and_counts_it(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    case_id = new_case(owner_engine)
    meta = upload(callers["operator"], case_id)
    assert (meta.filename, meta.mime_type, meta.size_bytes, meta.doc_type) == (
        "receipt.txt", "text/plain", len(RECEIPT), "transfer_receipt")
    assert meta.uploaded_by.name == "operator" and meta.latest_extraction is None
    with db.system_session() as s:
        case = case_sql.require_case(s, case_id)
        stored = s.exec(text("select content from document_contents where document_id = :id")
                        .bindparams(id=UUID(meta.id))).scalar_one()
        entries = s.exec(text("select metadata from audit_log where case_id = :id and action = 'document.uploaded'")
                         .bindparams(id=case_id)).scalars().all()
    assert case["document_count"] == 1 and "document" not in case_sql.missing_fields(case)
    assert case["version"] == 1  # a counter change is not a user edit
    assert bytes(stored) == RECEIPT
    assert entries[0]["document_id"] == meta.id


@pytest.mark.parametrize("who", ["viewer_a", "victim1"])
def test_only_staff_upload(app_db: Engine, owner_engine: Engine, callers: dict, who: str) -> None:
    with pytest.raises(ServiceError) as caught:
        upload(callers[who], new_case(owner_engine))
    assert caught.value.status == 403


def test_upload_to_a_closed_or_unknown_case(app_db: Engine, owner_engine: Engine, callers: dict) -> None:
    closed = new_case(owner_engine, status="closed", closed_at=datetime.now(UTC), closure_reason="withdrawn")
    with pytest.raises(ServiceError) as caught:
        upload(callers["operator"], closed)
    assert caught.value.code == "CASE_CLOSED"
    with pytest.raises(ServiceError) as caught:
        upload(callers["operator"], uuid4())
    assert caught.value.status == 404


@pytest.mark.parametrize(
    ("data", "doc_type", "status", "code"),
    [
        (b"MZ\x90\x00 not a document", "other", 400, "BAD_REQUEST"),
        (b"%PDF-" + b"0" * MAX_UPLOAD_BYTES, "other", 413, "FILE_TOO_LARGE"),
        (RECEIPT, "selfie", 422, "VALIDATION_ERROR"),
    ],
    ids=["executable", "over_10_mb", "unknown_doc_type"],  # short ids: Windows caps env vars at 32 KB
)
def test_bad_uploads_are_refused_and_nothing_is_saved(app_db: Engine, owner_engine: Engine, callers: dict,
                                                      data: bytes, doc_type: str, status: int, code: str) -> None:
    case_id = new_case(owner_engine)
    with pytest.raises(ServiceError) as caught:
        upload(callers["operator"], case_id, data, doc_type)
    assert (caught.value.status, caught.value.code) == (status, code)
    with db.system_session() as s:
        assert case_sql.require_case(s, case_id)["document_count"] == 0


def test_viewer_downloads_own_bank_files_with_safe_headers(app_db: Engine, callers: dict,
                                                           world: dict[str, str]) -> None:
    with db.scoped_session(callers["viewer_a"].scope()) as s:
        file = documents.download_document(s, callers["viewer_a"], UUID(world["doc_a1"]))
    assert file.content == b"hello"
    assert file.headers["X-Content-Type-Options"] == "nosniff"
    assert file.headers["Content-Disposition"].startswith("attachment;")
    with db.system_session() as s:
        actors = s.exec(text("select actor_id::text from audit_log where action = 'document.downloaded' "
                             "and case_id = :id").bindparams(id=UUID(world["case_a1"]))).scalars().all()
    assert world["viewer_a"] in actors


def test_other_banks_file_is_404(app_db: Engine, callers: dict, world: dict[str, str]) -> None:
    with db.scoped_session(callers["viewer_b"].scope()) as s, pytest.raises(ServiceError) as caught:
        documents.download_document(s, callers["viewer_b"], UUID(world["doc_a1"]))
    assert (caught.value.status, caught.value.code) == (404, "RESOURCE_NOT_FOUND")


def test_victims_cannot_download_staff_documents(app_db: Engine, callers: dict, world: dict[str, str]) -> None:
    with db.scoped_session(callers["victim1"].scope()) as s, pytest.raises(ServiceError) as caught:
        documents.download_document(s, callers["victim1"], UUID(world["doc_b1"]))
    assert caught.value.status == 403


def test_case_documents_show_the_latest_extraction(app_db: Engine, callers: dict, world: dict[str, str]) -> None:
    with db.scoped_session(callers["operator"].scope()) as s:
        docs = documents.case_documents(s, UUID(world["case_a1"]))
    [doc] = [d for d in docs if d.id == world["doc_a1"]]
    assert doc.latest_extraction is not None and doc.latest_extraction.status == "pending_review"
    assert doc.uploaded_by.name == "operator"
