"""Bluebooks: list, upload, index, publish, archive (owner: Anim; API_SPEC §3.6 and §6.8).

Each bluebook belongs to exactly one bank. The assistant quotes only **published,
victim-facing** documents of the case's own bank (Asif's retrieval and the RLS policies
enforce that); this module only manages the documents' life:

    processing → ready → published → archived        (or processing → failed)

Upload stores the file as ``processing``. Indexing runs after the response (a
background task in the system scope, like any background job): Galib's
``rag.split_bluebook`` splits it into passages and ``rag.embed`` embeds them, with no
transaction open during the embedding call. If embedding is unavailable the passages
are still stored without vectors, and retrieval falls back to keyword search.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from typing import Any, Final
from uuid import UUID

from sqlalchemy import RowMapping, text
from sqlmodel import Session

from app import db
from app.errors import ApiError
from app.models.documents import UserRef
from app.models.kb import KbDocument
from app.security import Principal
from app.services import audit
from app.services.ai_errors import AIUnavailableError
from app.services.document_files import sniff_mime

log = logging.getLogger(__name__)

MAX_BLUEBOOK_BYTES: Final = 20 * 1024 * 1024
ALLOWED_TYPES: Final = frozenset({"application/pdf", "text/plain"})
_SELECT: Final = (
    "select d.id, d.bank_id, b.name as bank_name, d.title, d.version, d.language, d.status, d.audience, "
    "d.passage_count, d.error, d.uploaded_by, u.name as uploaded_by_name, d.uploaded_at, d.published_at "
    "from kb_documents d join banks b on b.id = d.bank_id left join users u on u.id = d.uploaded_by"
)


def _document(row: RowMapping) -> KbDocument:
    return KbDocument(
        id=str(row["id"]),
        bank_id=row["bank_id"],
        bank_name=row["bank_name"],
        title=row["title"],
        version=row["version"],
        language=row["language"],
        status=row["status"],
        audience=row["audience"],
        passage_count=row["passage_count"],
        error=row["error"],
        uploaded_by=UserRef(id=str(row["uploaded_by"]), name=row["uploaded_by_name"] or "Unknown"),
        uploaded_at=row["uploaded_at"],
        published_at=row["published_at"],
    )


def _load(s: Session, document_id: UUID, *, lock: bool = False) -> RowMapping:
    suffix = " for update of d" if lock else ""
    row = s.exec(text(f"{_SELECT} where d.id = :id{suffix}"), params={"id": document_id}).mappings().first()  # type: ignore[call-overload]
    if row is None:
        raise ApiError(404, "RESOURCE_NOT_FOUND", "Bluebook document not found")
    return row


def list_documents(s: Session, who: Principal, *, bank_id: str | None, status: str | None) -> list[KbDocument]:
    clauses, params = ["true"], {}
    if bank_id and who.role != "bank_viewer":  # a viewer's bank comes from RLS
        clauses.append("d.bank_id = :bank_id")
        params["bank_id"] = bank_id
    if status:
        clauses.append("d.status = :status")
        params["status"] = status
    rows = (
        s.exec(  # type: ignore[call-overload]
            text(f"{_SELECT} where {' and '.join(clauses)} order by d.bank_id, d.title, d.uploaded_at desc, d.id"),
            params=params,
        )
        .mappings()
        .all()
    )
    s.rollback()
    return [_document(r) for r in rows]


def upload(
    s: Session,
    who: Principal,
    *,
    data: bytes,
    bank_id: str,
    title: str,
    version: str,
    language: str,
    audience: str,
) -> KbDocument:
    """``POST /api/kb/documents`` → 201 with status ``processing``; the caller schedules ``index_document``."""
    if len(data) > MAX_BLUEBOOK_BYTES:
        raise ApiError(413, "FILE_TOO_LARGE", "A bluebook can be at most 20 MB")
    if not data or sniff_mime(data) not in ALLOWED_TYPES:
        raise ApiError(400, "BAD_REQUEST", "A bluebook must be a PDF or a UTF-8 text file")
    document_id = s.exec(  # type: ignore[call-overload]
        text(
            "insert into kb_documents (bank_id, title, version, language, audience, status, content, sha256, "
            "uploaded_by) values (:bank_id, :title, :version, :language, :audience, 'processing', :content, "
            ":sha256, :uploaded_by) returning id"
        ),
        params={
            "bank_id": bank_id,
            "title": title,
            "version": version,
            "language": language,
            "audience": audience,
            "content": data,
            "sha256": hashlib.sha256(data).hexdigest(),
            "uploaded_by": who.user_id,
        },
    ).scalar_one()
    audit.record(
        s,
        action="kb.document_uploaded",
        actor=who.actor(),
        summary=f"Bluebook uploaded: {title} {version}",
        bank_id=bank_id,
        metadata={"kb_document_id": document_id, "audience": audience, "size_bytes": len(data)},
    )
    s.commit()
    document = _document(_load(s, document_id))
    s.rollback()
    return document


def _vectors(texts: list[str], *, ai_enabled: bool) -> tuple[list[list[float]] | None, str | None]:
    """Embeddings for the passages, or ``(None, None)`` to store them for keyword search only."""
    if not ai_enabled:
        return None, None
    from app.services import rag

    try:
        return rag.embed(texts, task="document"), rag.EMBED_MODEL
    except AIUnavailableError:
        log.warning("bluebook indexing: embeddings unavailable, storing passages for keyword search")
        return None, None


def _mark_failed(document_id: UUID, message: str) -> None:
    with db.system_session() as s:
        s.exec(  # type: ignore[call-overload]
            text("update kb_documents set status = 'failed', error = :error where id = :id and status = 'processing'"),
            params={"id": document_id, "error": message[:500]},
        )
        s.commit()


def index_document(document_id: UUID, *, ai_enabled: bool) -> None:
    """Background job: split, embed (outside any transaction), store passages, mark ``ready`` or ``failed``."""
    from app.services import rag

    with db.system_session() as s:
        row = (
            s.exec(  # type: ignore[call-overload]
                text("select content, bank_id from kb_documents where id = :id and status = 'processing'"),
                params={"id": document_id},
            )
            .mappings()
            .first()
        )
        s.commit()
    if row is None:
        return  # archived (or already indexed) in the meantime
    content, bank_id = bytes(row["content"]), row["bank_id"]
    try:
        passages = rag.split_bluebook(content, sniff_mime(content) or "application/octet-stream")
    except (ValueError, UnicodeDecodeError, AIUnavailableError, RuntimeError) as exc:
        _mark_failed(document_id, f"Couldn't read the document: {type(exc).__name__}")
        return
    if not passages:
        _mark_failed(document_id, "No numbered sections found (e.g. '3.1 Documents you need')")
        return

    vectors, model = _vectors([p["text"] for p in passages], ai_enabled=ai_enabled)
    with db.system_session() as s:
        for position, passage in enumerate(passages):
            vector = json.dumps(vectors[position]) if vectors is not None else None
            s.exec(  # type: ignore[call-overload]
                text(
                    "insert into kb_passages (document_id, bank_id, section, page, text, embedding, embedding_model) "
                    "values (:document_id, :bank_id, :section, :page, :text, cast(:embedding as vector), :model)"
                ),
                params={
                    "document_id": document_id,
                    "bank_id": bank_id,
                    "section": passage.get("section"),
                    "page": passage.get("page"),
                    "text": passage["text"],
                    "embedding": vector,
                    "model": model if vector is not None else None,
                },
            )
        s.exec(  # type: ignore[call-overload]
            text(
                "update kb_documents set status = 'ready', passage_count = :n, error = null "
                "where id = :id and status = 'processing'"
            ),
            params={"id": document_id, "n": len(passages)},
        )
        s.commit()


def _invalid(row: RowMapping, to: str) -> ApiError:
    return ApiError(
        409,
        "INVALID_STATUS_TRANSITION",
        f"Only a ready document can be published; this one is {row['status']}",
        {"from": row["status"], "to": to, "allowed": []},
    )


def publish(s: Session, who: Principal, document_id: UUID, now: datetime) -> KbDocument:
    """Only ``ready`` → ``published``; an older published version with the same title is archived."""
    row = _load(s, document_id, lock=True)
    if row["status"] != "ready":
        raise _invalid(row, "published")
    replaced = (
        s.exec(  # type: ignore[call-overload]
            text(
                "update kb_documents set status = 'archived' where bank_id = :bank_id and title = :title "
                "and status = 'published' and id <> :id returning id"
            ),
            params={"bank_id": row["bank_id"], "title": row["title"], "id": document_id},
        )
        .scalars()
        .all()
    )
    s.exec(  # type: ignore[call-overload]
        text("update kb_documents set status = 'published', published_at = :now where id = :id"),
        params={"id": document_id, "now": now},
    )
    metadata: dict[str, Any] = {"kb_document_id": document_id, "archived_previous": list(replaced)}
    audit.record(
        s,
        action="kb.document_published",
        actor=who.actor(),
        summary=f"Bluebook published: {row['title']} {row['version']}",
        bank_id=row["bank_id"],
        metadata=metadata,
    )
    s.commit()
    document = _document(_load(s, document_id))
    s.rollback()
    return document


def archive(s: Session, who: Principal, document_id: UUID) -> KbDocument:
    """Any status → ``archived``; the assistant stops quoting it. Archiving twice changes nothing."""
    row = _load(s, document_id, lock=True)
    if row["status"] != "archived":
        s.exec(text("update kb_documents set status = 'archived' where id = :id"), params={"id": document_id})  # type: ignore[call-overload]
        audit.record(
            s,
            action="kb.document_archived",
            actor=who.actor(),
            summary=f"Bluebook archived: {row['title']} {row['version']}",
            bank_id=row["bank_id"],
            metadata={"kb_document_id": document_id, "previous_status": row["status"]},
        )
        s.commit()
    document = _document(_load(s, document_id))
    s.rollback()
    return document
