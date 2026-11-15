"""app/services/ai_extraction.py: the stub honours API_SPEC §7.1 and the engine accepts it."""

from __future__ import annotations

from app.services import ai_extraction
from app.services import extraction_engine as engine

SLIP = b"\x89PNG\r\n\x1a\n fake ATM slip image"


def test_output_passes_the_engine_contract_check() -> None:
    raw = ai_extraction.extract_fields(SLIP, "image/png", "transfer_receipt")

    guesses, model, prompt_version = engine.parse_ai_output(raw)

    assert {g.name for g in guesses} <= set(engine.EXTRACTABLE_FIELDS)
    assert len(guesses) == 5
    assert all(g.evidence for g in guesses)
    assert (model, prompt_version) == ("stub", "extract-v0-stub")


def test_engine_routes_stub_results_to_human_review() -> None:
    caller = engine.AICaller(max_concurrent=1)

    outcome = engine.extract(SLIP, "image/png", "transfer_receipt", caller=caller)  # real lazy import path

    assert outcome.status == "pending_review"
    assert outcome.source == "llm"
    assert outcome.review_lane == "low_confidence"
    assert outcome.overall_confidence is not None and outcome.overall_confidence < engine.DEFAULT_THRESHOLD


def test_empty_file_returns_no_fields() -> None:
    assert ai_extraction.extract_fields(b"", "image/png", "transfer_receipt")["fields"] == []
