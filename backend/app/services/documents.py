"""Upload and download case documents (owner: Asif; API_SPEC §6.5).

- Upload: operators and supervisors; the file type comes from its bytes
  (document_files); a closed case is read-only; the case's ``document_count``
  goes up in the same transaction as the insert and the audit entry.
- Download: staff and bank viewers (own bank, RLS); always an attachment.
"""

from __future__ import annotations

from typing import Final, get_args
from uuid import UUID, uuid4

from sqlalchemy import column, table, update
from sqlmodel import Session, select

from app.models.common import DocumentType
from app.models.documents import (
    DocumentContentRow,
    DocumentMeta,
    DocumentRow,
    DownloadedFile,
    ExtractionBrief,
    ExtractionRow,
    UserRef,
)
from app.services import audit, case_sql, document_files
from app.services.caller import Caller, is_staff
from app.services.case_sql import cases
from app.services.service_errors import ServiceError, forbidden, not_found, validation_error

DOWNLOAD_ROLES: Final = frozenset({"operator", "supervisor", "bank_viewer"})
DOCUMENT_TYPES: Final = frozenset(get_args(DocumentType))
_users = table("users", column("id"), column("name"))


class CaseRef:
    """The two things audit needs about a case."""

    __slots__ = ("id", "bank_id")

    def __init__(self, case_id: UUID, bank_id: str) -> None:
        self.id = case_id
        self.bank_id = bank_id


def user_names(s: Session, ids: set[UUID]) -> dict[UUID, str]:
    if not ids:
        return {}
    rows = s.exec(select(_users.c.id, _users.c.name).where(_users.c.id.in_(ids))).all()  # type: ignore[call-overload]
    return {row[0]: row[1] for row in rows}


def _latest_extractions(s: Session, document_ids: list[UUID]) -> dict[UUID, ExtractionRow]:
    if not document_ids:
        return {}
    rows = s.exec(
        select(ExtractionRow).where(ExtractionRow.document_id.in_(document_ids))  # type: ignore[attr-defined]
        .order_by(ExtractionRow.created_at.desc())  # type: ignore[attr-defined]
    ).all()
    latest: dict[UUID, ExtractionRow] = {}
    for row in rows:
        latest.setdefault(row.document_id, row)
    return latest


def to_meta(doc: DocumentRow, uploader_name: str, latest: ExtractionRow | None) -> DocumentMeta:
    return DocumentMeta(
        id=str(doc.id), case_id=str(doc.case_id), filename=doc.filename, doc_type=doc.doc_type,  # type: ignore[arg-type]
        mime_type=doc.mime_type, size_bytes=doc.size_bytes,
        uploaded_by=UserRef(id=str(doc.uploaded_by), name=uploader_name), uploaded_at=doc.uploaded_at,
        latest_extraction=ExtractionBrief(
            id=str(latest.id), status=latest.status,  # type: ignore[arg-type]
            overall_confidence=float(latest.overall_confidence) if latest.overall_confidence is not None else None,
            review_lane=latest.review_lane,  # type: ignore[arg-type]
        ) if latest else None,
    )


def case_documents(s: Session, case_id: UUID) -> list[DocumentMeta]:
    """The documents of a case (for the staff case detail), oldest first."""
    docs = s.exec(
        select(DocumentRow).where(DocumentRow.case_id == case_id).order_by(DocumentRow.uploaded_at)  # type: ignore[arg-type]
    ).all()
    names = user_names(s, {d.uploaded_by for d in docs})
    latest = _latest_extractions(s, [d.id for d in docs])
    return [to_meta(d, names.get(d.uploaded_by, "Unknown"), latest.get(d.id)) for d in docs]


def upload_document(s: Session, caller: Caller, case_id: UUID, *, data: bytes, filename: str | None,
                    doc_type: str) -> DocumentMeta:
    """``POST /api/cases/{id}/documents`` → 201."""
    if not is_staff(caller):
        raise forbidden()
    if doc_type not in DOCUMENT_TYPES:
        raise validation_error("doc_type", "Unknown document type")
    case = case_sql.require_case(s, case_id)
    case_sql.require_open(case)
    try:
        checked = document_files.check_upload(data, filename)
    except document_files.UploadRejected as exc:
        raise ServiceError(exc.status, exc.code, exc.message) from exc

    uploaded_at = case_sql.now()
    doc = DocumentRow(
        id=uuid4(), case_id=case_id, bank_id=case["bank_id"], filename=checked.filename, doc_type=doc_type,
        mime_type=checked.mime_type, size_bytes=checked.size_bytes, sha256=checked.sha256,
        uploaded_by=caller.user_id, uploaded_at=uploaded_at,
    )
    s.add(doc)
    s.flush()  # the document row must exist before its content row
    s.add(DocumentContentRow(document_id=doc.id, bank_id=doc.bank_id, content=data))
    s.exec(  # type: ignore[call-overload]
        update(cases).where(cases.c.id == case_id)
        .values(document_count=cases.c.document_count + 1, updated_at=uploaded_at)
    )
    audit.record(s, action="document.uploaded", actor=caller.actor(), case=case,
                 summary=f"Document uploaded: {checked.filename}",
                 metadata={"document_id": doc.id, "doc_type": doc_type, "size_bytes": checked.size_bytes})
    s.commit()
    return to_meta(doc, caller.name, None)


def download_document(s: Session, caller: Caller, document_id: UUID) -> DownloadedFile:
    """``GET /api/documents/{id}/file``: the bytes and safe headers. Audited."""
    if caller.role not in DOWNLOAD_ROLES:
        raise forbidden()
    doc = s.get(DocumentRow, document_id)
    content = s.get(DocumentContentRow, document_id) if doc is not None else None
    if doc is None or content is None:
        raise not_found("Document")
    audit.record(s, action="document.downloaded", actor=caller.actor(), case=CaseRef(doc.case_id, doc.bank_id),
                 summary=f"Document downloaded: {doc.filename}", metadata={"document_id": doc.id})
    s.commit()
    return DownloadedFile(filename=doc.filename, mime_type=doc.mime_type, content=content.content,
                          headers=document_files.download_headers(doc.filename, doc.mime_type))
