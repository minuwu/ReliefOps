"""Victim self-service and the case-claim flow (owner: Asif; API_SPEC §6.3, §6.7).

Victims work only on their own cases: RLS hides everyone else's, so another
victim's case is a 404, never a 403. Staff routes stay in ``routers/cases.py``;
the one staff route here, ``victim-invite``, starts the claim flow.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter

from app import email, rate_limit
from app.config import Settings
from app.models.victim_cases import ClaimRequest, VictimCase, VictimCaseUpdate, VictimReport
from app.responses import Envelope, error_responses, ok
from app.security import SessionDep, StaffUser, VictimUser
from app.services import claims, victim_cases


def create_router(settings: Settings) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["victim cases"])

    @router.post(
        "/victim/cases",
        status_code=201,
        response_model=Envelope[VictimCase],
        summary="Report a fraud (creates a case in `received`)",
        responses=error_responses(401, 403, 422, 429),
    )
    def report_case(data: VictimReport, who: VictimUser, s: SessionDep) -> dict:
        key = str(who.user_id)
        rate_limit.enforce(rate_limit.victim_reports, [key])
        case = victim_cases.create_report(s, who, data)
        rate_limit.victim_reports.hit(key)  # only reports that were saved count
        return ok(case, "Report received")

    @router.get(
        "/victim/cases",
        response_model=Envelope[list[VictimCase]],
        summary="My cases, newest first",
        responses=error_responses(401, 403),
    )
    def list_my_cases(who: VictimUser, s: SessionDep) -> dict:
        return ok(victim_cases.list_cases(s, who))

    @router.get(
        "/victim/cases/{case_id}",
        response_model=Envelope[VictimCase],
        summary="One of my cases (audited as case.viewed)",
        responses=error_responses(401, 403, 404, 422),
    )
    def get_my_case(case_id: UUID, who: VictimUser, s: SessionDep) -> dict:
        return ok(victim_cases.get_case(s, who, case_id))

    @router.patch(
        "/victim/cases/{case_id}",
        response_model=Envelope[VictimCase],
        summary="Change what the case status still allows (see editable_fields)",
        responses=error_responses(401, 403, 404, 409, 422),
    )
    def update_my_case(case_id: UUID, data: VictimCaseUpdate, who: VictimUser, s: SessionDep) -> dict:
        return ok(victim_cases.update_case(s, who, case_id, data), "Case updated")

    @router.post(
        "/victim/claims",
        response_model=Envelope[VictimCase],
        summary="Link a phone or paper case to my account with the invite link's token",
        responses=error_responses(400, 401, 403, 422),
    )
    def claim_case(data: ClaimRequest, who: VictimUser, s: SessionDep) -> dict:
        return ok(claims.claim_case(s, who, data.token), "Case linked to your account")

    @router.post(
        "/cases/{case_id}/victim-invite",
        response_model=Envelope[None],
        summary="Email the victim a 7-day link to claim this case",
        responses=error_responses(401, 403, 404, 422),
    )
    def invite_victim(case_id: UUID, who: StaffUser, s: SessionDep) -> dict:
        claims.invite_victim(s, who, case_id, send_email=email.send, frontend_base_url=settings.frontend_base_url)
        return ok(None, "Invitation sent")

    return router
