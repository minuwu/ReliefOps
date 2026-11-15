"""app/services/extraction_engine.py: AI failures (guide §8.6) and the API_SPEC §6.5 outcome table."""

from __future__ import annotations

import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import pytest

from app.services import extraction_engine as engine
from app.services.ai_errors import AIUnavailableError

RECEIPT = (
    "Transfer receipt\n"
    "Name: Rina Example\n"
    "Date: 2026/10/28\n"
    "Transfer amount: ¥250,000\n"
    "Account No. 0012345\n"
    "Account holder: Sample Trading LLC\n"
    "Phone: +81-90-0000-0042\n"
).encode()


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def caller(clock: FakeClock) -> engine.AICaller:
    return engine.AICaller(max_concurrent=2, breaker=engine.CircuitBreaker(threshold=3, cooldown=60, clock=clock))


def ai_answer(*fields: tuple[str, Any, float]) -> Any:
    def fake(file_bytes: bytes, mime_type: str, doc_type: str) -> dict[str, Any]:
        return {
            "fields": [{"name": n, "value": v, "confidence": c, "evidence": f"{n} on page 1"} for n, v, c in fields],
            "model": "example-model",
            "prompt_version": "extract-v1",
        }
    return fake


def ai_down(file_bytes: bytes, mime_type: str, doc_type: str) -> dict[str, Any]:
    raise AIUnavailableError("provider unreachable")


def ai_slow(file_bytes: bytes, mime_type: str, doc_type: str) -> dict[str, Any]:
    time.sleep(1.5)
    return {"fields": []}


# ---------------------------------------------------------------- the outcome table


def test_confident_answer_goes_to_the_standard_lane(caller: engine.AICaller) -> None:
    out = engine.extract(b"%PDF", "application/pdf", "transfer_receipt", caller=caller,
                         ai=ai_answer(("amount", 250000, 0.95), ("transfer_date", "2026-10-28", 0.91)))
    assert (out.status, out.source, out.review_lane) == ("pending_review", "llm", "standard")
    assert out.overall_confidence == 0.91  # the lowest field confidence
    assert (out.model, out.prompt_version, out.error) == ("example-model", "extract-v1", None)
    assert "account_number" in out.missing_fields and "amount" not in out.missing_fields


def test_one_weak_field_sends_it_to_the_low_confidence_lane(caller: engine.AICaller) -> None:
    out = engine.extract(b"%PDF", "application/pdf", "transfer_receipt", caller=caller,
                         ai=ai_answer(("amount", 250000, 0.95), ("account_number", "0012345", 0.62)))
    assert (out.status, out.review_lane, out.overall_confidence) == ("pending_review", "low_confidence", 0.62)


def test_threshold_is_configurable(caller: engine.AICaller) -> None:
    out = engine.extract(b"%PDF", "application/pdf", "other", caller=caller, threshold=0.6,
                         ai=ai_answer(("amount", 1, 0.62)))
    assert out.review_lane == "standard"


def test_ai_down_on_text_uses_the_rules_fallback(caller: engine.AICaller) -> None:
    out = engine.extract(RECEIPT, "text/plain", "transfer_receipt", caller=caller, ai=ai_down)
    assert (out.status, out.source, out.review_lane) == ("pending_review", "rules_fallback", "low_confidence")
    assert out.error and out.error["reason"] == "ai_unavailable"
    assert out.model is None
    values = {g.name: g.value for g in out.fields}
    assert values["amount"] == 250000 and values["currency"] == "JPY"
    assert values["transfer_date"] == "2026-10-28" and values["account_number"] == "0012345"


def test_ai_down_on_an_image_fails_cleanly(caller: engine.AICaller) -> None:
    out = engine.extract(b"\x89PNG", "image/png", "transfer_receipt", caller=caller, ai=ai_down)
    assert (out.status, out.source, out.review_lane, out.fields) == ("failed", "rules_fallback", None, ())
    assert out.error["reason"] == "ai_unavailable" and "manually" in out.error["message"]
    assert out.overall_confidence is None


def test_timeout_falls_back_in_about_the_timeout(caller: engine.AICaller) -> None:
    started = time.monotonic()
    out = engine.extract(RECEIPT, "text/plain", "transfer_receipt", caller=caller, ai=ai_slow, timeout=0.3)
    assert time.monotonic() - started < 1.0
    assert (out.source, out.error["reason"]) == ("rules_fallback", "timeout")


@pytest.mark.parametrize(
    "bad",
    [
        "not a dict",
        {"fields": "nope"},
        {"fields": [{"name": "status", "value": "closed", "confidence": 0.99}]},  # prompt injection asks to close
        {"fields": [{"name": "amount", "value": 1, "confidence": 1.5}]},
        {"fields": [{"name": "amount", "value": "250,000", "confidence": 0.9}]},
        {"fields": [{"name": "transfer_date", "value": "28 Oct", "confidence": 0.9}]},
        {"fields": [{"name": "scam_type", "value": "wire_fraud", "confidence": 0.9}]},
        {"fields": [{"name": "currency", "value": "yen", "confidence": 0.9}]},
    ],
)
def test_bad_ai_output_fails_with_invalid_ai_output(caller: engine.AICaller, bad: Any) -> None:
    out = engine.extract(RECEIPT, "text/plain", "other", caller=caller, ai=lambda *_: bad)
    assert (out.status, out.source, out.review_lane) == ("failed", "llm", None)
    assert out.error["reason"] == "invalid_ai_output"
    assert out.fields == ()


def test_ai_off_never_calls_the_ai(caller: engine.AICaller) -> None:
    called = threading.Event()

    def spy(*_: Any) -> dict[str, Any]:
        called.set()
        return {"fields": []}

    out = engine.extract(RECEIPT, "text/plain", "other", caller=caller, ai=spy, ai_enabled=False)
    assert not called.is_set()
    assert out.source == "rules_fallback"


def test_text_that_is_not_utf8_is_unreadable(caller: engine.AICaller) -> None:
    out = engine.extract(b"\xff\xfe\xfa", "text/plain", "other", caller=caller, ai=ai_down)
    assert (out.status, out.error["reason"]) == ("failed", "unreadable_document")


def test_empty_ai_answer_on_text_tries_the_rules(caller: engine.AICaller) -> None:
    out = engine.extract(RECEIPT, "text/plain", "other", caller=caller, ai=lambda *_: {"fields": []})
    assert out.source == "rules_fallback" and out.status == "pending_review"


def test_duplicate_fields_keep_the_most_confident(caller: engine.AICaller) -> None:
    out = engine.extract(b"%PDF", "application/pdf", "other", caller=caller,
                         ai=ai_answer(("amount", 100, 0.5), ("amount", 250000, 0.9)))
    assert [(g.value, g.confidence) for g in out.fields] == [(250000, 0.9)]


# ---------------------------------------------------------------- circuit breaker


def test_three_failures_open_the_breaker_and_skip_the_ai(caller: engine.AICaller, clock: FakeClock) -> None:
    calls: list[int] = []

    def counting_down(*_: Any) -> dict[str, Any]:
        calls.append(1)
        raise AIUnavailableError("down")

    for _ in range(3):
        engine.extract(RECEIPT, "text/plain", "other", caller=caller, ai=counting_down)
    assert caller.breaker.is_open and len(calls) == 3

    started = time.monotonic()
    out = engine.extract(RECEIPT, "text/plain", "other", caller=caller, ai=counting_down)
    assert time.monotonic() - started < 0.1  # falls back at once
    assert len(calls) == 3 and out.source == "rules_fallback"


def test_breaker_allows_one_trial_after_the_cooldown(caller: engine.AICaller, clock: FakeClock) -> None:
    for _ in range(3):
        engine.extract(RECEIPT, "text/plain", "other", caller=caller, ai=ai_down)
    clock.now += 61
    out = engine.extract(b"%PDF", "application/pdf", "other", caller=caller, ai=ai_answer(("amount", 1, 0.9)))
    assert out.source == "llm" and not caller.breaker.is_open


def test_failed_trial_reopens_the_breaker(caller: engine.AICaller, clock: FakeClock) -> None:
    for _ in range(3):
        engine.extract(RECEIPT, "text/plain", "other", caller=caller, ai=ai_down)
    clock.now += 61
    engine.extract(RECEIPT, "text/plain", "other", caller=caller, ai=ai_down)
    assert caller.breaker.is_open
    assert not caller.breaker.allow()  # a fresh cooldown started


def test_timeouts_count_as_failures(caller: engine.AICaller) -> None:
    for _ in range(3):
        engine.extract(RECEIPT, "text/plain", "other", caller=caller, ai=ai_slow, timeout=0.05)
    assert caller.breaker.is_open


def test_a_success_resets_the_failure_count(caller: engine.AICaller) -> None:
    engine.extract(RECEIPT, "text/plain", "other", caller=caller, ai=ai_down)
    engine.extract(RECEIPT, "text/plain", "other", caller=caller, ai=ai_down)
    engine.extract(b"%PDF", "application/pdf", "other", caller=caller, ai=ai_answer(("amount", 1, 0.9)))
    engine.extract(RECEIPT, "text/plain", "other", caller=caller, ai=ai_down)
    assert not caller.breaker.is_open


def test_provider_crashes_count_as_unavailable(caller: engine.AICaller) -> None:
    def crash(*_: Any) -> dict[str, Any]:
        raise RuntimeError("HTTP 500 from provider")

    out = engine.extract(RECEIPT, "text/plain", "other", caller=caller, ai=crash)
    assert out.error["reason"] == "ai_unavailable"


def test_health_reports_the_breaker(clock: FakeClock) -> None:
    caller = engine.configure(max_concurrent=1, breaker=engine.CircuitBreaker(threshold=1, clock=clock))
    assert engine.ai_status() == "ok"
    engine.extract(RECEIPT, "text/plain", "other", caller=caller, ai=ai_down)
    assert engine.ai_status() == "unavailable"
    engine.configure()  # leave a fresh default for other tests


# ---------------------------------------------------------------- concurrency


def test_at_most_max_concurrent_calls_run_at_once(caller: engine.AICaller) -> None:
    running, peak, lock = 0, 0, threading.Lock()

    def tracked(*_: Any) -> dict[str, Any]:
        nonlocal running, peak
        with lock:
            running += 1
            peak = max(peak, running)
        time.sleep(0.2)
        with lock:
            running -= 1
        return {"fields": [{"name": "amount", "value": 1, "confidence": 0.9}]}

    with ThreadPoolExecutor(5) as pool:
        outs = list(pool.map(lambda _: engine.extract(b"%PDF", "application/pdf", "other",
                                                      caller=caller, ai=tracked, timeout=5), range(5)))
    assert peak <= 2
    assert all(o.source == "llm" for o in outs)


def test_missing_ai_module_counts_as_unavailable(caller: engine.AICaller) -> None:
    out = engine.extract(RECEIPT, "text/plain", "other", caller=caller)  # default: Galib's module, not installed yet
    assert out.error["reason"] == "ai_unavailable"


# ---------------------------------------------------------------- rules fallback


def test_rules_fallback_reads_labelled_fields() -> None:
    found = {g.name: g for g in engine.rules_extract(RECEIPT.decode())}
    assert found["victim_name"].value == "Rina Example"
    assert found["account_holder_name"].value == "Sample Trading LLC"
    assert found["victim_phone"].value == "+81-90-0000-0042"
    assert all(g.confidence == engine.FALLBACK_CONFIDENCE for g in found.values())
    assert found["amount"].evidence == "amount: ¥250,000"


def test_rules_fallback_ignores_impossible_dates() -> None:
    assert "transfer_date" not in {g.name for g in engine.rules_extract("Date: 2026-02-31")}
