"""Documents, AI extraction and human review routes (owner: Asif; API_SPEC §6.5).

HTTP only: the rules, RLS checks and audit entries live in the services. The flow is
upload → extract → a person reviews → only then does the case change.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, Query, Response, UploadFile
from pydantic import BaseModel

from app.config import Settings
from app.models.cases import Case
from app.models.common import BankId, DocumentType, Page, PageParams, ReviewLane
from app.models.documents import DocumentMeta, Extraction
from app.models.review import ReviewQueueItem, ReviewRequest
from app.responses import Envelope, error_responses, ok
from app.security import AnyStaffUser, SessionDep, StaffUser
from app.services import cases, document_files, documents, extraction, review, review_queue


class ReviewResponse(BaseModel):
    """``data`` of ``POST /api/extractions/{id}/review``."""

    extraction: Extraction
    case: Case


def extraction_settings(settings: Settings) -> extraction.ExtractionSettings:
    """The AI budget and on/off switch come from the app settings; the AI caller is the app-wide one."""
    return extraction.ExtractionSettings(timeout=settings.ai_timeout_seconds, ai_enabled=settings.ai_configured)


def _read_upload(file: UploadFile) -> bytes:
    """At most one byte over the limit, so an oversized file is rejected without loading all of it."""
    return file.file.read(document_files.MAX_UPLOAD_BYTES + 1)


def create_router(settings: Settings) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["documents"])
    ai_settings = extraction_settings(settings)

    @router.post(
        "/cases/{case_id}/documents",
        status_code=201,
        response_model=Envelope[DocumentMeta],
        summary="Upload a document (PDF, PNG, JPG or TXT, at most 10 MB)",
        responses=error_responses(400, 401, 403, 404, 409, 413, 422),
    )
    def upload_document(
        case_id: UUID,
        who: StaffUser,
        s: SessionDep,
        file: Annotated[UploadFile, File(description="PDF, PNG, JPG or TXT, at most 10 MB")],
        doc_type: Annotated[DocumentType, Form()],
    ) -> dict:
        meta = documents.upload_document(
            s, who, case_id, data=_read_upload(file), filename=file.filename, doc_type=doc_type
        )
        return ok(meta, "Document uploaded")

    @router.get(
        "/documents/{document_id}/file",
        response_class=Response,
        summary="Download the original file (audited as document.downloaded)",
        responses={200: {"content": {"application/octet-stream": {}}}, **error_responses(401, 403, 404, 422)},
    )
    def download_document(document_id: UUID, who: AnyStaffUser, s: SessionDep) -> Response:
        file = documents.download_document(s, who, document_id)
        return Response(content=file.content, media_type=file.mime_type, headers=file.headers)

    @router.post(
        "/documents/{document_id}/extract",
        status_code=201,
        response_model=Envelope[Extraction],
        summary="Run AI extraction (waits up to 20 s; always 201, even when the AI is down)",
        responses=error_responses(401, 403, 404, 409, 422),
    )
    def extract(document_id: UUID, who: StaffUser, s: SessionDep) -> dict:
        result = extraction.run_extraction(s, who, document_id, ai_settings)
        failed = result.status == "failed"
        return ok(result, "Extraction failed; enter the fields manually" if failed else "Extraction ready for review")

    @router.get(
        "/extractions/{extraction_id}",
        response_model=Envelope[Extraction],
        summary="Get an extraction",
        responses=error_responses(401, 403, 404, 422),
    )
    def get_extraction(extraction_id: UUID, who: StaffUser, s: SessionDep) -> dict:
        return ok(extraction.get_extraction(s, who, extraction_id))

    @router.post(
        "/extractions/{extraction_id}/review",
        response_model=Envelope[ReviewResponse],
        summary="Accept (writes only the listed fields) or reject an extraction",
        responses=error_responses(401, 403, 404, 409, 422),
    )
    def review_extraction(extraction_id: UUID, data: ReviewRequest, who: StaffUser, s: SessionDep) -> dict:
        result = review.review_extraction(s, who, extraction_id, data)
        case = cases.load_case(s, who, result.case["id"], datetime.now(UTC))
        return ok(ReviewResponse(extraction=result.extraction, case=case), "Review saved")

    @router.get(
        "/review-queue",
        response_model=Envelope[Page[ReviewQueueItem]],
        summary="Extractions waiting for a person (low confidence first, then oldest)",
        responses=error_responses(401, 403, 422),
    )
    def get_review_queue(
        who: StaffUser,
        s: SessionDep,
        lane: ReviewLane | None = None,
        bank_id: BankId | None = None,
        page: Annotated[int, Query(ge=1)] = 1,
        page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    ) -> dict:
        paging = PageParams(page=page, page_size=page_size)
        return ok(review_queue.review_queue(s, who, lane=lane, bank_id=bank_id, paging=paging))

    return router
