"""N8: the case lifecycle rules (API_SPEC §3.1–3.3), as pure functions."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import pytest

from app.errors import ApiError
from app.services.case_workflow import (
    Transition,
    allowed_closure_reasons,
    allowed_transitions,
    check_transition,
    deadline_state,
    transition_values,
)

NOW = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)


@dataclass(frozen=True)
class Who:
    role: str


OPERATOR, SUPERVISOR, VIEWER, VICTIM = Who("operator"), Who("supervisor"), Who("bank_viewer"), Who("victim")


def complete_case(status: str = "received", **overrides: Any) -> dict[str, Any]:
    case = {
        "status": status,
        "victim_phone": "+81-90-0000-0001",
        "victim_email": None,
        "amount": Decimal("1000"),
        "transfer_date": NOW.date(),
        "account_number": "0012345",
        "scam_type": "phishing",
        "document_count": 1,
        "deadline": NOW + timedelta(days=5),
        "status_changed_at": NOW - timedelta(days=2),
    }
    return case | overrides


def error_of(case: dict[str, Any], who: Who, req: Transition) -> tuple[int, str, dict[str, Any]]:
    with pytest.raises(ApiError) as caught:
        check_transition(case, who, req)
    return caught.value.status, caught.value.code, caught.value.details


# ------------------------------------------------------------------ what the buttons show


def test_allowed_transitions_match_the_contract_example() -> None:
    assert allowed_transitions(complete_case("verified"), OPERATOR) == ["account_check", "received", "closed"]
    assert allowed_closure_reasons(complete_case("verified"), OPERATOR) == ["withdrawn"]


@pytest.mark.parametrize(
    ("status", "expected"),
    [
        ("received", ["verified", "closed"]),
        ("account_check", ["notice_published", "verified", "closed"]),
        ("payout_review", ["notice_published", "closed"]),
        ("closed", []),
    ],
)
def test_allowed_transitions_per_status(status: str, expected: list[str]) -> None:
    assert allowed_transitions(complete_case(status), SUPERVISOR) == expected


def test_supervisor_closure_reasons_include_paid_out_only_in_payout_review() -> None:
    assert allowed_closure_reasons(complete_case("verified"), SUPERVISOR) == ["rejected", "withdrawn"]
    assert allowed_closure_reasons(complete_case("payout_review"), SUPERVISOR) == ["paid_out", "rejected", "withdrawn"]


def test_viewers_victims_and_closed_cases_get_no_buttons() -> None:
    for who in (VIEWER, VICTIM):
        assert allowed_transitions(complete_case("verified"), who) == []
        assert allowed_closure_reasons(complete_case("verified"), who) == []
    assert allowed_closure_reasons(complete_case("closed"), SUPERVISOR) == []


# ------------------------------------------------------------------ check_transition


def test_forward_with_complete_information_is_allowed() -> None:
    check_transition(complete_case("received"), OPERATOR, Transition("verified"))
    check_transition(complete_case("payout_review"), SUPERVISOR, Transition("closed", "Paid", "paid_out", Decimal(5)))


def test_leaving_received_without_the_required_information_lists_what_is_missing() -> None:
    case = complete_case(victim_phone=None, account_number=None, document_count=0)
    status, code, details = error_of(case, OPERATOR, Transition("verified"))
    assert (status, code) == (422, "MISSING_REQUIRED_INFO")
    assert details == {"missing_fields": ["victim_contact", "account_number", "document"]}
    check_transition(case, OPERATOR, Transition("closed", "Victim withdrew", "withdrawn"))  # closing needs no facts


def test_skipping_a_step_is_an_invalid_transition_with_the_allowed_list() -> None:
    status, code, details = error_of(complete_case("received"), OPERATOR, Transition("account_check"))
    assert (status, code) == (409, "INVALID_STATUS_TRANSITION")
    assert details == {"from": "received", "to": "account_check", "allowed": ["verified", "closed"]}


def test_moving_back_or_closing_needs_a_note() -> None:
    for req in (Transition("received"), Transition("closed", "  ", "withdrawn")):
        status, code, details = error_of(complete_case("verified"), OPERATOR, req)
        assert (status, code, details["fields"][0]["field"]) == (422, "VALIDATION_ERROR", "note")
    check_transition(complete_case("verified"), OPERATOR, Transition("received", "Wrong amount on the receipt"))


def test_closing_needs_a_reason_and_money_closures_need_a_supervisor() -> None:
    case = complete_case("payout_review")
    assert error_of(case, OPERATOR, Transition("closed", "x"))[2]["fields"][0]["field"] == "closure_reason"
    for reason in ("paid_out", "rejected"):
        status, code, _ = error_of(case, OPERATOR, Transition("closed", "x", reason, Decimal(1)))
        assert (status, code) == (403, "FORBIDDEN")


def test_paid_out_only_from_payout_review_and_only_with_an_amount() -> None:
    status, code, details = error_of(
        complete_case("verified"), SUPERVISOR, Transition("closed", "x", "paid_out", Decimal(1))
    )
    assert (status, code, details["to"]) == (409, "INVALID_STATUS_TRANSITION", "closed")
    missing = error_of(complete_case("payout_review"), SUPERVISOR, Transition("closed", "x", "paid_out"))
    assert missing[2]["fields"][0]["field"] == "payout_amount"
    extra = error_of(complete_case("verified"), SUPERVISOR, Transition("closed", "x", "withdrawn", Decimal(1)))
    assert extra[2]["fields"][0]["field"] == "payout_amount"


def test_closure_fields_are_refused_on_a_normal_move() -> None:
    _, code, details = error_of(complete_case("received"), OPERATOR, Transition("verified", closure_reason="withdrawn"))
    assert (code, details["fields"][0]["field"]) == ("VALIDATION_ERROR", "closure_reason")


def test_closed_cases_are_read_only_and_other_roles_are_forbidden() -> None:
    assert error_of(complete_case("closed"), SUPERVISOR, Transition("received", "x"))[:2] == (409, "CASE_CLOSED")
    for who in (VIEWER, VICTIM):
        assert error_of(complete_case("received"), who, Transition("verified"))[:2] == (403, "FORBIDDEN")


# ------------------------------------------------------------------ deadlines


@pytest.mark.parametrize(
    ("days_left", "stage_days", "expected"),
    [
        (5, 7, "on_track"),
        (1, 7, "due_soon"),  # 20% of 7 days is 1.4 days
        (1.5, 7, "on_track"),
        (17, 90, "due_soon"),  # 20% of 90 days is 18 days
        (20, 90, "on_track"),
        (0.5, 2, "due_soon"),  # at least 1 day of warning
        (-0.1, 7, "overdue"),
    ],
)
def test_deadline_state(days_left: float, stage_days: int, expected: str) -> None:
    deadline = NOW + timedelta(days=days_left)
    case = complete_case("verified", deadline=deadline, status_changed_at=deadline - timedelta(days=stage_days))
    assert deadline_state(case, NOW) == expected


def test_closed_cases_have_no_deadline_state() -> None:
    assert deadline_state(complete_case("closed", deadline=None), NOW) == "none"


def test_transition_values_set_the_new_stage_deadline_or_close_the_case() -> None:
    forward = transition_values(Transition("account_check"), NOW)
    assert forward["deadline"] == NOW + timedelta(days=45) and forward["closed_at"] is None
    closing = transition_values(Transition("closed", "x", "paid_out", Decimal(900)), NOW)
    assert (closing["deadline"], closing["closed_at"], closing["payout_amount"]) == (None, NOW, Decimal(900))
