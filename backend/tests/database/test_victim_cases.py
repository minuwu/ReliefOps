"""app/services/victim_cases.py: report, list, view and edit own cases (API_SPEC §3.5, §6.7)."""

from __future__ import annotations

import json
import re
from datetime import date
from decimal import Decimal
from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy import Engine, text

from app import db
from app.models.victim_cases import ALL_EDITABLE_FIELDS, CONTACT_FIELDS, VictimCaseUpdate, VictimReport
from app.services import victim_cases
from app.services.service_errors import ServiceError

from .conftest import insert_case, set_scope

REPORT = {
    "bank_id": "bank_b",
    "victim": {"name": "Victim One", "phone": "+81-90-0000-0101", "preferred_language": "ja"},
    "amount": 120000, "currency": "JPY", "transfer_date": "2026-11-01", "scam_type": "phishing",
    "consent": True,
}


def report(caller, **changes):  # noqa: ANN001, ANN201
    with db.scoped_session(caller.scope()) as s:
        return victim_cases.create_report(s, caller, VictimReport.model_validate({**REPORT, **changes}))


def edit(caller, case_id: str, body: dict):  # noqa: ANN001, ANN201
    with db.scoped_session(caller.scope()) as s:
        return victim_cases.update_case(s, caller, UUID(case_id), VictimCaseUpdate.model_validate(body))


def own_case(owner_engine: Engine, victim_id: str, status: str = "verified", **columns: object) -> str:
    with owner_engine.begin() as conn:
        set_scope(conn, "system")
        return insert_case(conn, "bank_b", victim_user_id=victim_id, status=status,
                           victim_phone="+81-90-0000-0001", amount="1000.00", **columns)


def audit_entries(case_id: str, action: str) -> list[dict]:
    with db.system_session() as s:
        rows = s.exec(text("select actor_type, changes, metadata from audit_log where case_id = :id and action = :a")
                      .bindparams(id=UUID(case_id), a=action)).mappings().all()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------- report


def test_report_creates_a_received_web_case(app_db: Engine, callers: dict) -> None:
    case = report(callers["victim1"])
    assert re.fullmatch(r"RFR-\d{4}-\d{5}", case.reference)
    assert (case.status, case.version, case.bank_name) == ("received", 1, "Birch Test Bank")
    assert case.victim.email == "victim1@test.test"  # defaults to the account's verified email
    assert case.editable_fields == list(ALL_EDITABLE_FIELDS)
    assert set(case.missing_fields) == {"account_number", "document"}
    data = json.loads(case.model_dump_json())
    assert data["amount"] == 120000.0 and isinstance(data["amount"], float)  # money as a JSON number
    [entry] = audit_entries(case.id, "case.created")
    assert entry["actor_type"] == "victim" and entry["metadata"]["channel"] == "web_form"
    with db.system_session() as s:
        row = s.exec(text("select channel, consent_at, deadline - created_at as stage from cases where id = :id")
                     .bindparams(id=UUID(case.id))).mappings().one()
    assert row["channel"] == "web_form" and row["consent_at"] is not None and row["stage"].days == 7


def test_a_given_email_is_kept(app_db: Engine, callers: dict) -> None:
    case = report(callers["victim1"], victim={**REPORT["victim"], "email": "Other@Mail.test"})
    assert case.victim.email == "other@mail.test"


def test_repeated_report_is_flagged_as_possible_duplicate(app_db: Engine, callers: dict) -> None:
    first = report(callers["victim2"], amount=777, transfer_date="2026-10-01")
    second = report(callers["victim2"], amount=777, transfer_date="2026-10-01")
    with db.system_session() as s:
        flags = dict(s.exec(text("select id::text, possible_duplicate from cases where id in (:a, :b)")
                            .bindparams(a=UUID(first.id), b=UUID(second.id))).all())
    assert flags == {first.id: False, second.id: True}


def test_only_victims_can_report(app_db: Engine, callers: dict) -> None:
    with pytest.raises(ServiceError) as caught:
        report(callers["operator"])
    assert caught.value.status == 403


@pytest.mark.parametrize(
    "bad",
    [
        {"consent": False},
        {"amount": -1},
        {"amount": 1.001},
        {"bank_id": "bank_z"},
        {"scam_type": "wire_fraud"},
        {"victim": {"name": "  "}},
        {"victim": {"name": "X", "phone": "call me"}},
        {"role": "supervisor"},
        {"status": "closed"},
    ],
)
def test_bad_reports_are_rejected_by_the_schema(bad: dict) -> None:
    with pytest.raises(ValidationError):
        VictimReport.model_validate({**REPORT, **bad})


# ---------------------------------------------------------------- list and view


def test_victims_list_only_their_own_cases(app_db: Engine, callers: dict, world: dict[str, str]) -> None:
    with db.scoped_session(callers["victim1"].scope()) as s:
        mine = victim_cases.list_cases(s, callers["victim1"])
    assert world["case_b1"] in {c.id for c in mine}
    assert world["case_a2"] not in {c.id for c in mine}  # victim2's case
    assert [c.submitted_at for c in mine] == sorted((c.submitted_at for c in mine), reverse=True)


def test_viewing_is_audited_and_others_cases_are_404(app_db: Engine, callers: dict, world: dict[str, str]) -> None:
    with db.scoped_session(callers["victim1"].scope()) as s:
        case = victim_cases.get_case(s, callers["victim1"], UUID(world["case_b1"]))
    assert case.id == world["case_b1"]
    assert "victim" in [e["actor_type"] for e in audit_entries(world["case_b1"], "case.viewed")]
    with db.scoped_session(callers["victim1"].scope()) as s, pytest.raises(ServiceError) as caught:
        victim_cases.get_case(s, callers["victim1"], UUID(world["case_a2"]))
    assert (caught.value.status, caught.value.code) == (404, "RESOURCE_NOT_FOUND")


def test_staff_cannot_use_victim_routes(app_db: Engine, callers: dict, world: dict[str, str]) -> None:
    with db.scoped_session(callers["operator"].scope()) as s, pytest.raises(ServiceError) as caught:
        victim_cases.list_cases(s, callers["operator"])
    assert caught.value.status == 403


def test_victim_case_hides_staff_only_data(app_db: Engine, callers: dict, world: dict[str, str]) -> None:
    with db.scoped_session(callers["victim1"].scope()) as s:
        data = victim_cases.get_case(s, callers["victim1"], UUID(world["case_b1"])).model_dump()
    for hidden in ("assigned_operator_id", "deadline", "notes", "documents", "victim_user_id", "bank_id"):
        assert hidden not in data


# ---------------------------------------------------------------- edit


def test_contact_can_change_after_verification(app_db: Engine, owner_engine: Engine, callers: dict,
                                               world: dict[str, str]) -> None:
    case_id = own_case(owner_engine, world["victim1"])
    updated = edit(callers["victim1"], case_id, {"expected_version": 1,
                                                 "victim": {"phone": "+81-90-0000-0099", "preferred_language": "ja"}})
    assert (updated.version, updated.victim.phone, updated.victim.preferred_language) == (2, "+81-90-0000-0099", "ja")
    assert updated.editable_fields == list(CONTACT_FIELDS)
    [entry] = audit_entries(case_id, "case.updated")
    assert entry["actor_type"] == "victim"
    assert entry["changes"] == {
        "victim.phone": {"from": "+81-90-0000-0001", "to": "+81-90-0000-0099"},
        "victim.preferred_language": {"from": "en", "to": "ja"},
    }


def test_report_facts_are_locked_after_verification(app_db: Engine, owner_engine: Engine, callers: dict,
                                                    world: dict[str, str]) -> None:
    case_id = own_case(owner_engine, world["victim1"])
    with pytest.raises(ServiceError) as caught:
        edit(callers["victim1"], case_id, {"expected_version": 1, "amount": 999999, "victim": {"name": "New"}})
    assert (caught.value.status, caught.value.code) == (409, "CASE_LOCKED")
    assert caught.value.details == {"locked_fields": ["amount", "victim.name"]}


def test_report_facts_can_change_while_received(app_db: Engine, owner_engine: Engine, callers: dict,
                                                world: dict[str, str]) -> None:
    case_id = own_case(owner_engine, world["victim1"], status="received")
    updated = edit(callers["victim1"], case_id, {"expected_version": 1, "amount": 95000,
                                                 "transfer_date": "2026-10-30", "description": "Corrected."})
    assert (updated.amount, updated.transfer_date, updated.description) == (Decimal("95000"), date(2026, 10, 30), "Corrected.")
    [entry] = audit_entries(case_id, "case.updated")
    assert entry["changes"]["amount"] == {"from": 1000.0, "to": 95000.0}


def test_null_clears_an_optional_field(app_db: Engine, owner_engine: Engine, callers: dict,
                                       world: dict[str, str]) -> None:
    case_id = own_case(owner_engine, world["victim1"], victim_email="v1@test.test", victim_address="Tokyo")
    updated = edit(callers["victim1"], case_id, {"expected_version": 1, "victim": {"address": None}})
    assert updated.victim.address is None and updated.victim.email == "v1@test.test"


def test_a_phone_or_email_must_remain(app_db: Engine, owner_engine: Engine, callers: dict,
                                      world: dict[str, str]) -> None:
    case_id = own_case(owner_engine, world["victim1"])
    with pytest.raises(ServiceError) as caught:
        edit(callers["victim1"], case_id, {"expected_version": 1, "victim": {"phone": None}})
    assert (caught.value.status, caught.value.code) == (422, "VALIDATION_ERROR")


def test_stale_version_is_rejected(app_db: Engine, owner_engine: Engine, callers: dict, world: dict[str, str]) -> None:
    case_id = own_case(owner_engine, world["victim1"])
    edit(callers["victim1"], case_id, {"expected_version": 1, "victim": {"phone": "+81-90-1111-1111"}})
    with pytest.raises(ServiceError) as caught:
        edit(callers["victim1"], case_id, {"expected_version": 1, "victim": {"phone": "+81-90-2222-2222"}})
    assert (caught.value.code, caught.value.details) == ("STALE_CASE", {"current_version": 2})


def test_closed_cases_are_read_only(app_db: Engine, owner_engine: Engine, callers: dict, world: dict[str, str]) -> None:
    case_id = own_case(owner_engine, world["victim1"], status="closed", closed_at="2026-11-10T00:00:00Z",
                       closure_reason="withdrawn")
    with pytest.raises(ServiceError) as caught:
        edit(callers["victim1"], case_id, {"expected_version": 1, "victim": {"phone": "+81-90-3333-3333"}})
    assert caught.value.code == "CASE_CLOSED"


def test_unchanged_values_make_no_new_version(app_db: Engine, owner_engine: Engine, callers: dict,
                                              world: dict[str, str]) -> None:
    case_id = own_case(owner_engine, world["victim1"])
    same = edit(callers["victim1"], case_id, {"expected_version": 1, "victim": {"phone": "+81-90-0000-0001"}})
    assert same.version == 1
    assert audit_entries(case_id, "case.updated") == []


def test_cannot_edit_another_victims_case(app_db: Engine, owner_engine: Engine, callers: dict,
                                          world: dict[str, str]) -> None:
    case_id = own_case(owner_engine, world["victim2"])
    with pytest.raises(ServiceError) as caught:
        edit(callers["victim1"], case_id, {"expected_version": 1, "victim": {"phone": "+81-90-4444-4444"}})
    assert caught.value.status == 404


@pytest.mark.parametrize(
    "bad",
    [
        {"expected_version": 1, "status": "closed"},
        {"expected_version": 1, "bank_id": "bank_a"},
        {"expected_version": 1, "victim": {"name": None}},
        {"expected_version": 1, "amount": None},
        {"victim": {"phone": "+81-90-0000-0000"}},
        {"expected_version": 0},
    ],
)
def test_bad_edits_are_rejected_by_the_schema(bad: dict) -> None:
    with pytest.raises(ValidationError):
        VictimCaseUpdate.model_validate(bad)
