"""Remember which free-tier models are rate-limited, so callers skip them until they recover (owner: Galib).

Free tiers cap requests per model: Gemini 20/day, Groq a few thousand tokens per minute. Calling a model
that is certain to answer 429 wastes seconds of the request's time budget. Per process; resets on restart.
"""

from __future__ import annotations

import re
import threading
import time
from typing import Final

DEFAULT_WAIT: Final = 60.0
MAX_WAIT: Final = 24 * 3600.0

_lock = threading.Lock()
_until: dict[str, float] = {}

_GEMINI_DELAY: Final = re.compile(r"retryDelay'?\"?:\s*'?\"?(\d+(?:\.\d+)?)s")
_GROQ_DELAY: Final = re.compile(r"try again in (?:(\d+)h)?(?:(\d+)m)?(\d+(?:\.\d+)?)s")


def wait_seconds(message: str) -> float | None:
    """Seconds to skip a model after this error, or None if it isn't a rate limit."""
    lowered = message.lower()
    if "request too large" in lowered:
        return None  # this request is too big; the model itself is fine
    if "429" not in message and "resource_exhausted" not in lowered and "rate limit" not in lowered:
        return None
    if m := _GEMINI_DELAY.search(message):
        return min(float(m.group(1)), MAX_WAIT)
    if m := _GROQ_DELAY.search(message):
        hours, minutes, seconds = (float(g) if g else 0.0 for g in m.groups())
        return min(hours * 3600 + minutes * 60 + seconds, MAX_WAIT)
    return DEFAULT_WAIT


def note_failure(model: str, message: str) -> None:
    if (wait := wait_seconds(message)) is not None:
        with _lock:
            _until[model] = time.monotonic() + wait


def seconds_left(model: str) -> float:
    with _lock:
        return max(0.0, _until.get(model, 0.0) - time.monotonic())


def reset() -> None:
    with _lock:
        _until.clear()
