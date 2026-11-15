"""In-memory sliding-window rate limits (owner: Anim; guide §5.4).

One server instance is enough for the hackathon, so counters live in memory.
Each limiter counts events per key (an IP or an email) over a window; once a
key reaches the limit, ``retry_after`` says how many seconds until the oldest
event leaves the window. Tests call ``reset_rate_limits()`` before each test.
"""

from __future__ import annotations

import math
import threading
import time
from collections import deque
from collections.abc import Callable, Iterable
from typing import Final

from app.errors import ApiError


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: float, clock: Callable[[], float] = time.monotonic) -> None:
        self.limit = limit
        self.window = window_seconds
        self._clock = clock
        self._events: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _trim(self, key: str, now: float) -> deque[float]:
        events = self._events.setdefault(key, deque())
        while events and events[0] <= now - self.window:
            events.popleft()
        return events

    def retry_after(self, key: str) -> int | None:
        """Seconds until ``key`` may try again, or None if it's under the limit."""
        with self._lock:
            now = self._clock()
            events = self._trim(key, now)
            if len(events) < self.limit:
                return None
            return max(1, math.ceil(events[0] + self.window - now))

    def hit(self, key: str) -> None:
        with self._lock:
            now = self._clock()
            self._trim(key, now).append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._events.clear()


def rate_limited(retry_after: int) -> ApiError:
    return ApiError(429, "RATE_LIMITED", "Too many attempts; try again later", {"retry_after": retry_after})


def enforce(limiter: SlidingWindowLimiter, keys: Iterable[str]) -> None:
    """Raise ``429 RATE_LIMITED`` (with ``Retry-After``) if any key is over the limit."""
    waits = [wait for key in keys if (wait := limiter.retry_after(key)) is not None]
    if waits:
        raise rate_limited(max(waits))


FIFTEEN_MINUTES: Final = 15 * 60
ONE_HOUR: Final = 60 * 60

# guide §5.4: login 5 failures / 15 min; sign-up, resend and forgot-password 5 / hour (per IP and per email).
login_failures = SlidingWindowLimiter(limit=5, window_seconds=FIFTEEN_MINUTES)
email_requests = SlidingWindowLimiter(limit=5, window_seconds=ONE_HOUR)

ALL_LIMITERS: Final = (login_failures, email_requests)


def reset_rate_limits() -> None:
    for limiter in ALL_LIMITERS:
        limiter.clear()
