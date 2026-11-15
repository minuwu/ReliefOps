"""Run the AI field extraction safely (owner: Asif; API_SPEC §6.5 and §7.1, guide §4.5).

This module has no database or HTTP code. It turns one document into an
``Outcome`` with the contract's status / source / review_lane rules:

| What happened                                        | status         | source         | lane           |
| AI answered, every field >= threshold (0.75)         | pending_review | llm            | standard       |
| AI answered, some field below threshold              | pending_review | llm            | low_confidence |
| AI down or timed out, rule-based fallback found some | pending_review | rules_fallback | low_confidence |
| AI down and fallback found nothing, unreadable file  | failed         | rules_fallback | None           |
| AI answered with output that breaks the contract     | failed         | llm            | None           |

Protection around the AI call:
- a timeout (the call runs in a worker thread; we stop waiting, we can't kill it);
- at most ``max_concurrent`` calls at once (a slot is held until the call really ends);
- a circuit breaker: after 3 failures or timeouts in a row the AI is skipped for 60 s,
  then one trial call decides. ``ai_status()`` reports it for ``/api/health``.

Never call this while a database transaction is open (guide §4.5): commit first.
An AI failure is never an HTTP error; the caller always saves the Outcome.
"""

from __future__ import annotations

import importlib
import re
import threading
import time
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Final, Literal

from app.services.ai_errors import AIUnavailableError

ExtractFn = Callable[[bytes, str, str], dict[str, Any]]
ErrorReason = Literal["timeout", "ai_unavailable", "unreadable_document", "invalid_ai_output"]

EXTRACTABLE_FIELDS: Final[tuple[str, ...]] = (
    "victim_name", "victim_phone", "victim_email", "amount", "currency",
    "transfer_date", "account_number", "account_holder_name", "scam_type",
)
SCAM_TYPES: Final = frozenset({"phishing", "impersonation", "investment", "romance", "lottery_prize", "job_offer", "other"})
DEFAULT_THRESHOLD: Final = 0.75
FALLBACK_CONFIDENCE: Final = 0.5
MAX_TEXT_VALUE: Final = 200
MAX_EVIDENCE: Final = 200

ERROR_MESSAGES: Final[dict[str, str]] = {
    "timeout": "The AI service took too long.",
    "ai_unavailable": "The AI service is unavailable.",
    "unreadable_document": "The document could not be read.",
    "invalid_ai_output": "The AI returned an answer that could not be used. Enter the fields manually.",
}


@dataclass(frozen=True, slots=True)
class FieldGuess:
    name: str
    value: Any
    confidence: float
    evidence: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {"name": self.name, "value": self.value, "confidence": self.confidence, "evidence": self.evidence}


@dataclass(frozen=True, slots=True)
class Outcome:
    status: Literal["pending_review", "failed"]
    source: Literal["llm", "rules_fallback"]
    fields: tuple[FieldGuess, ...] = ()
    model: str | None = None
    prompt_version: str | None = None
    overall_confidence: float | None = None
    review_lane: Literal["standard", "low_confidence"] | None = None
    error: dict[str, str] | None = None
    missing_fields: tuple[str, ...] = field(default=())


# ------------------------------------------------------------------ circuit breaker


class CircuitBreaker:
    """Skip the AI after ``threshold`` failures in a row, for ``cooldown`` seconds, then allow one trial."""

    def __init__(self, threshold: int = 3, cooldown: float = 60.0, clock: Callable[[], float] = time.monotonic) -> None:
        self._threshold = threshold
        self._cooldown = cooldown
        self._clock = clock
        self._lock = threading.Lock()
        self._failures = 0
        self._opened_at: float | None = None
        self._trial_running = False

    def allow(self) -> bool:
        with self._lock:
            if self._opened_at is None:
                return True
            if self._trial_running or self._clock() - self._opened_at < self._cooldown:
                return False
            self._trial_running = True  # half-open: exactly one trial call
            return True

    def record_success(self) -> None:
        with self._lock:
            self._failures = 0
            self._opened_at = None
            self._trial_running = False

    def record_failure(self) -> None:
        with self._lock:
            self._failures += 1
            self._trial_running = False
            if self._opened_at is not None or self._failures >= self._threshold:
                self._opened_at = self._clock()

    def release(self) -> None:
        """End a half-open trial that never reached the AI, without counting it either way."""
        with self._lock:
            self._trial_running = False

    @property
    def is_open(self) -> bool:
        with self._lock:
            return self._opened_at is not None


class AICaller:
    """Timeout + concurrency limit + circuit breaker around one AI function."""

    def __init__(self, *, max_concurrent: int = 4, breaker: CircuitBreaker | None = None) -> None:
        self.breaker = breaker or CircuitBreaker()
        self._slots = threading.BoundedSemaphore(max_concurrent)
        self._pool = ThreadPoolExecutor(max_workers=max_concurrent * 2, thread_name_prefix="ai-call")

    def call(self, fn: ExtractFn, args: tuple[bytes, str, str], timeout: float) -> dict[str, Any]:
        """Return the AI's answer, or raise TimeoutError / AIUnavailableError."""
        if not self.breaker.allow():
            raise AIUnavailableError("circuit open")
        deadline = time.monotonic() + timeout
        if not self._slots.acquire(timeout=timeout):
            self.breaker.record_failure()
            raise TimeoutError("no free AI slot")
        future: Future[dict[str, Any]] = self._pool.submit(fn, *args)
        future.add_done_callback(lambda _: self._slots.release())  # slot freed only when the call really ends
        try:
            result = future.result(timeout=max(0.0, deadline - time.monotonic()))
        except FutureTimeout:
            self.breaker.record_failure()
            raise TimeoutError("AI call timed out") from None
        except AIUnavailableError:
            self.breaker.record_failure()
            raise
        except Exception as exc:  # any provider crash counts as "unavailable"
            self.breaker.record_failure()
            raise AIUnavailableError(str(exc)) from exc
        self.breaker.record_success()
        return result


_default_caller: AICaller | None = None
_caller_lock = threading.Lock()


def configure(*, max_concurrent: int = 4, breaker: CircuitBreaker | None = None) -> AICaller:
    """Create the process-wide caller (startup, or tests). Returns it."""
    global _default_caller
    with _caller_lock:
        _default_caller = AICaller(max_concurrent=max_concurrent, breaker=breaker)
        return _default_caller


def default_caller() -> AICaller:
    with _caller_lock:
        if _default_caller is None:
            return configure()
        return _default_caller


def ai_status() -> Literal["ok", "unavailable"]:
    """For ``GET /api/health``: ``unavailable`` while the breaker is open."""
    return "unavailable" if default_caller().breaker.is_open else "ok"


def galib_extract_fields(file_bytes: bytes, mime_type: str, doc_type: str) -> dict[str, Any]:
    """Call Galib's ``app.services.ai_extraction.extract_fields`` (imported lazily)."""
    try:
        module = importlib.import_module("app.services.ai_extraction")
    except ModuleNotFoundError as exc:
        raise AIUnavailableError("AI module is not installed") from exc
    return module.extract_fields(file_bytes, mime_type, doc_type)


# ------------------------------------------------------------------ validating the AI's answer


class InvalidOutput(ValueError):
    pass


def _check_value(name: str, value: Any) -> Any:
    if value is None:
        raise InvalidOutput(f"{name} has no value")
    if name == "amount":
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
            raise InvalidOutput("amount must be a number >= 0")
        return value
    if not isinstance(value, str) or not value.strip() or len(value) > MAX_TEXT_VALUE:
        raise InvalidOutput(f"{name} must be a short non-empty string")
    value = value.strip()
    if name == "transfer_date":
        date.fromisoformat(value)  # raises ValueError -> invalid
    elif name == "currency" and not re.fullmatch(r"[A-Z]{3}", value):
        raise InvalidOutput("currency must be 3 capital letters")
    elif name == "scam_type" and value not in SCAM_TYPES:
        raise InvalidOutput("unknown scam_type")
    return value


def parse_ai_output(raw: Any) -> tuple[list[FieldGuess], str | None, str | None]:
    """Validate the AI's dict against API_SPEC §7.1. Raises InvalidOutput."""
    if not isinstance(raw, dict) or not isinstance(raw.get("fields"), list):
        raise InvalidOutput("answer must be a dict with a 'fields' list")
    guesses: dict[str, FieldGuess] = {}
    for item in raw["fields"]:
        if not isinstance(item, dict):
            raise InvalidOutput("each field must be a dict")
        name = item.get("name")
        if name not in EXTRACTABLE_FIELDS:
            raise InvalidOutput(f"{name!r} is not an extractable field")
        confidence = item.get("confidence")
        if isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1:
            raise InvalidOutput(f"{name}: confidence must be between 0 and 1")
        try:
            value = _check_value(name, item.get("value"))
        except ValueError as exc:
            raise InvalidOutput(str(exc)) from exc
        evidence = item.get("evidence")
        evidence = str(evidence)[:MAX_EVIDENCE] if evidence is not None else None
        guess = FieldGuess(name, value, round(float(confidence), 3), evidence)
        if name not in guesses or guess.confidence > guesses[name].confidence:
            guesses[name] = guess
    model, prompt = raw.get("model"), raw.get("prompt_version")
    return list(guesses.values()), str(model) if model else None, str(prompt) if prompt else None


# ------------------------------------------------------------------ rule-based fallback (text only)

_AMOUNT = re.compile(r"(?:amount|transferred|sent|total)\D{0,20}?([¥$৳]?)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(yen|jpy|usd|bdt|taka)?", re.I)
_DATE = re.compile(r"\b(20[0-9]{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12][0-9]|3[01])\b")
_ACCOUNT = re.compile(r"(?:account|a/c)\s*(?:no\.?|number|#)?\s*[:.]?\s*([0-9][0-9-]{4,19})", re.I)
_PHONE = re.compile(r"(\+?[0-9]{1,3}[- ]?[0-9]{1,4}[- ][0-9]{3,4}[- ][0-9]{3,4})")
_EMAIL = re.compile(r"\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b")
_LABELLED = {
    "victim_name": re.compile(r"^\s*(?:victim\s+)?name\s*[:：]\s*(.{1,120})$", re.I | re.M),
    "account_holder_name": re.compile(r"^\s*account\s+holder(?:\s+name)?\s*[:：]\s*(.{1,120})$", re.I | re.M),
}
_CURRENCY_BY_HINT = {"¥": "JPY", "yen": "JPY", "jpy": "JPY", "$": "USD", "usd": "USD", "৳": "BDT", "bdt": "BDT", "taka": "BDT"}


def _snippet(text: str, match: re.Match[str]) -> str:
    return text[match.start():match.end()].strip()[:MAX_EVIDENCE]


def rules_extract(text: str) -> list[FieldGuess]:
    """Simple pattern matching for when the AI is down. Low confidence by design; a person reviews it."""
    guesses: list[FieldGuess] = []

    def add(name: str, value: Any, match: re.Match[str]) -> None:
        guesses.append(FieldGuess(name, value, FALLBACK_CONFIDENCE, _snippet(text, match)))

    if m := _AMOUNT.search(text):
        amount = float(m.group(2).replace(",", ""))
        add("amount", int(amount) if amount.is_integer() else amount, m)
        hint = (m.group(1) or m.group(3) or "").lower()
        if hint in _CURRENCY_BY_HINT:
            add("currency", _CURRENCY_BY_HINT[hint], m)
    if m := _DATE.search(text):
        try:
            add("transfer_date", date(int(m.group(1)), int(m.group(2)), int(m.group(3))).isoformat(), m)
        except ValueError:
            pass
    if m := _ACCOUNT.search(text):
        add("account_number", m.group(1).replace("-", ""), m)
    if m := _PHONE.search(text):
        add("victim_phone", m.group(1), m)
    if m := _EMAIL.search(text):
        add("victim_email", m.group(1).lower(), m)
    for name, pattern in _LABELLED.items():
        if m := pattern.search(text):
            add(name, m.group(1).strip()[:MAX_TEXT_VALUE], m)
    return guesses


# ------------------------------------------------------------------ putting it together


def _missing(guesses: list[FieldGuess] | tuple[FieldGuess, ...]) -> tuple[str, ...]:
    found = {g.name for g in guesses}
    return tuple(name for name in EXTRACTABLE_FIELDS if name not in found)


def _error(reason: ErrorReason) -> dict[str, str]:
    return {"reason": reason, "message": ERROR_MESSAGES[reason]}


def _fallback(file_bytes: bytes, mime_type: str, reason: ErrorReason) -> Outcome:
    guesses: list[FieldGuess] = []
    if mime_type == "text/plain":
        try:
            guesses = rules_extract(file_bytes.decode("utf-8"))
        except UnicodeDecodeError:
            reason = "unreadable_document"
    if not guesses:
        message = ERROR_MESSAGES[reason] + " No fields could be read. Enter the fields manually."
        return Outcome(status="failed", source="rules_fallback", error={"reason": reason, "message": message},
                       missing_fields=EXTRACTABLE_FIELDS)
    return Outcome(
        status="pending_review", source="rules_fallback", fields=tuple(guesses),
        overall_confidence=min(g.confidence for g in guesses), review_lane="low_confidence",
        error=_error(reason), missing_fields=_missing(guesses),
    )


def extract(
    file_bytes: bytes,
    mime_type: str,
    doc_type: str,
    *,
    timeout: float = 20.0,
    threshold: float = DEFAULT_THRESHOLD,
    ai_enabled: bool = True,
    ai: ExtractFn = galib_extract_fields,
    caller: AICaller | None = None,
) -> Outcome:
    """Extract fields from one document. Never raises for AI problems; always returns an Outcome."""
    if not ai_enabled:
        return _fallback(file_bytes, mime_type, "ai_unavailable")
    try:
        raw = (caller or default_caller()).call(ai, (file_bytes, mime_type, doc_type), timeout)
    except TimeoutError:
        return _fallback(file_bytes, mime_type, "timeout")
    except AIUnavailableError:
        return _fallback(file_bytes, mime_type, "ai_unavailable")
    try:
        guesses, model, prompt_version = parse_ai_output(raw)
    except InvalidOutput:
        return Outcome(status="failed", source="llm", error=_error("invalid_ai_output"), missing_fields=EXTRACTABLE_FIELDS)
    if not guesses:
        return _fallback(file_bytes, mime_type, "unreadable_document")
    overall = min(g.confidence for g in guesses)
    return Outcome(
        status="pending_review", source="llm", fields=tuple(guesses), model=model, prompt_version=prompt_version,
        overall_confidence=overall, review_lane="standard" if overall >= threshold else "low_confidence",
        missing_fields=_missing(guesses),
    )
