"""Bluebook routes (owner: Anim; API_SPEC §6.8)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, File, Form, Request, UploadFile

from app.models.common import BankId, Language
from app.models.kb import KbAudience, KbDocument, KbDocumentStatus
from app.responses import Envelope, error_responses, ok
from app.security import AnyStaffUser, SessionDep, SupervisorUser
from app.services import kb

router = APIRouter(prefix="/api/kb/documents", tags=["bluebooks"])


@router.get(
    "",
    response_model=Envelope[list[KbDocument]],
    summary="Bluebook documents (staff: all banks; bank viewers: own bank)",
    responses=error_responses(401, 403, 422),
)
def list_documents(
    who: AnyStaffUser, s: SessionDep, bank_id: BankId | None = None, status: KbDocumentStatus | None = None
) -> dict:
    return ok(kb.list_documents(s, who, bank_id=bank_id, status=status))


@router.post(
    "",
    status_code=201,
    response_model=Envelope[KbDocument],
    summary="Upload a synthetic bluebook (PDF or TXT, at most 20 MB); indexing runs in the background",
    responses=error_responses(400, 401, 403, 413, 422),
)
def upload_document(
    request: Request,
    background: BackgroundTasks,
    who: SupervisorUser,
    s: SessionDep,
    file: Annotated[UploadFile, File(description="PDF or TXT, at most 20 MB")],
    bank_id: Annotated[BankId, Form()],
    title: Annotated[str, Form(min_length=1, max_length=200)],
    version: Annotated[str, Form(min_length=1, max_length=40)],
    language: Annotated[Language, Form()],
    audience: Annotated[KbAudience, Form()] = "victim_facing",
) -> dict:
    data = file.file.read(kb.MAX_BLUEBOOK_BYTES + 1)  # sync route: runs in the threadpool, never blocks the loop
    document = kb.upload(
        s,
        who,
        data=data,
        bank_id=bank_id,
        title=title.strip(),
        version=version.strip(),
        language=language,
        audience=audience,
    )
    background.add_task(kb.index_document, UUID(document.id), ai_enabled=request.app.state.settings.ai_configured)
    return ok(document, "Bluebook uploaded; indexing has started")


@router.post(
    "/{kb_document_id}/publish",
    response_model=Envelope[KbDocument],
    summary="Publish a ready document (archives the older version with the same title)",
    responses=error_responses(401, 403, 404, 409, 422),
)
def publish_document(kb_document_id: UUID, who: SupervisorUser, s: SessionDep) -> dict:
    return ok(kb.publish(s, who, kb_document_id, datetime.now(UTC)), "Bluebook published")


@router.post(
    "/{kb_document_id}/archive",
    response_model=Envelope[KbDocument],
    summary="Archive a document; the assistant stops using it",
    responses=error_responses(401, 403, 404, 422),
)
def archive_document(kb_document_id: UUID, who: SupervisorUser, s: SessionDep) -> dict:
    return ok(kb.archive(s, who, kb_document_id), "Bluebook archived")
