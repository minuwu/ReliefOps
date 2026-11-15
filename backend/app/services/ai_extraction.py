"""AI field extraction (owner: Galib; API_SPEC §7.1, XREQ-002).

``extract_fields`` is called by ``extraction_engine`` (Asif), which owns the
timeout, circuit breaker, rule-based fallback and output validation.

STUB: returns fixed demo values so backend and frontend can wire the flow
before the vision model exists. Confidence is kept below the engine's 0.75
threshold, so every stub result lands in the ``low_confidence`` review lane
and a person must check it (rule D3). The evidence says the value is a stub.
"""

from __future__ import annotations

from typing import Any, Final

MODEL: Final = "stub"
PROMPT_VERSION: Final = "extract-v0-stub"
STUB_CONFIDENCE: Final = 0.5
STUB_EVIDENCE: Final = "[stub] fixed demo value, not read from the document"

_STUB_FIELDS: Final[tuple[tuple[str, Any], ...]] = (
    ("amount", 1450000),
    ("currency", "JPY"),
    ("transfer_date", "2026-11-10"),
    ("account_number", "9876543210"),
    ("account_holder_name", "GLOBAL ASSET TRUST"),
)


def extract_fields(file_bytes: bytes, mime_type: str, doc_type: str) -> dict[str, Any]:
    """Return ``{"fields": [...], "model": ..., "prompt_version": ...}`` (API_SPEC §7.1).

    Each field is ``{"name", "value", "confidence", "evidence"}`` with ``name``
    an ExtractableField. Raises ``AIUnavailableError`` when the provider can't
    be reached (not yet: the stub has no provider).
    """
    if not file_bytes:
        return {"fields": [], "model": MODEL, "prompt_version": PROMPT_VERSION}
    fields = [
        {"name": name, "value": value, "confidence": STUB_CONFIDENCE, "evidence": STUB_EVIDENCE}
        for name, value in _STUB_FIELDS
    ]
    return {"fields": fields, "model": MODEL, "prompt_version": PROMPT_VERSION}
