from uuid import UUID

import pytest

from app.services import retrieval
from app.services.service_errors import ServiceError


def test_keyword_fallback_only_own_published_public_guide(app_db, callers, world, knowledge):
    result = retrieval.retrieve(callers["victim1"], UUID(world["case_b1"]), "report documents")
    assert [p["passage_id"] for p in result] == [str(knowledge["public_b"][1])]
    assert result[0]["score"] > 0


def test_vector_retrieval_enforces_same_filter(app_db, callers, world, knowledge):
    result = retrieval.retrieve(callers["victim1"], UUID(world["case_b1"]), "unrelated",
                                [1.0] + [0.0] * 767)
    assert [p["passage_id"] for p in result] == [str(knowledge["public_b"][1])]


def test_unrelated_question_has_no_keyword_hits(app_db, callers, world, knowledge):
    assert retrieval.retrieve(callers["victim1"], UUID(world["case_b1"]), "unfindable") == []


def test_cannot_choose_another_victims_bank(app_db, callers, world, knowledge):
    with pytest.raises(ServiceError) as caught:
        retrieval.retrieve(callers["victim1"], UUID(world["case_a2"]), "report")
    assert caught.value.status == 404


def test_model_context_and_text_redaction(app_db, callers, world):
    case = retrieval.own_case(callers["victim1"], UUID(world["case_b1"]))
    case.update(victim_name="Private Person", victim_email="private@example.test", account_number="9876543210")
    context = retrieval.case_context(case)
    assert set(context) == {"status", "time_in_stage", "missing_information", "scam_type", "amount",
                            "transfer_date", "closure_reason"}
    assert "Private Person" not in str(context) and "9876543210" not in str(context)
    safe = retrieval.redact("Private Person private@example.test 9876543210 extra@other.test +81 90 1234 5678", case)
    assert "Private" not in safe and "@" not in safe and "9876543210" not in safe and "5678" not in safe


def test_redaction_keeps_dates_and_case_references():
    case = {"victim_name": "Rina Example", "victim_phone": "+81-90-0000-0042"}
    text = "I sent money on 2026-10-28 for RFR-2026-00042; call me on +81-90-0000-0042 or 03 1234 5678"
    safe = retrieval.redact(text, case)
    assert "2026-10-28" in safe and "RFR-2026-00042" in safe
    assert "0042" not in safe.replace("RFR-2026-00042", "") and "1234 5678" not in safe


def test_shown_answers_keep_guidance_numbers_but_not_case_identifiers():
    case = {"victim_name": "Rina Example", "account_number": "0012345"}
    answer = "Rina Example, call the bank hotline 0120-000-000 by 2026-11-16 about account 0012345."
    shown = retrieval.redact(answer, case, generic=False)
    assert "0120-000-000" in shown and "2026-11-16" in shown  # what the bluebook told the victim
    assert "Rina Example" not in shown and "0012345" not in shown


@pytest.mark.parametrize("vector", [[0.0] * 768, [float("nan")] * 768, [1.0], None])
def test_bad_vectors_still_use_keywords(app_db, callers, world, knowledge, vector):
    result = retrieval.retrieve(callers["victim1"], UUID(world["case_b1"]), "report", vector)
    assert [p["passage_id"] for p in result] == [str(knowledge["public_b"][1])]
