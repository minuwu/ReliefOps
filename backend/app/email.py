"""Send an email: console, SMTP, or an in-memory outbox for tests (owner: Anim; guide §3.2, §4.3).

    email.send(to, subject, body)      # matches claims.SendEmail: Callable[[str, str, str], None]

- ``console`` (development): the message, with its link, goes to the ``app.email`` log so a
  developer can copy the link. Only for local use; the request log never sees it.
- ``smtp`` (live demo): STARTTLS + login when a user is set, 10-second timeout.
- ``outbox`` (tests): kept in ``email.outbox``; ``outbox.last_token(to)`` reads the link's token.

``send`` never raises. Callers send after their transaction commits, so a mail
server error must not turn a saved change into a 500; it is logged instead
(recipient domain only).
"""

from __future__ import annotations

import logging
import re
import smtplib
import threading
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Final

from app.config import Settings

log = logging.getLogger("app.email")

SMTP_TIMEOUT_SECONDS: Final = 10
_TOKEN_IN_LINK: Final = re.compile(r"[?&]token=([A-Za-z0-9_\-]+)")


@dataclass(frozen=True, slots=True)
class SentEmail:
    to: str
    subject: str
    body: str


class Outbox:
    """What tests read instead of a real mailbox."""

    def __init__(self) -> None:
        self._messages: list[SentEmail] = []
        self._lock = threading.Lock()

    def add(self, message: SentEmail) -> None:
        with self._lock:
            self._messages.append(message)

    def clear(self) -> None:
        with self._lock:
            self._messages.clear()

    @property
    def messages(self) -> list[SentEmail]:
        with self._lock:
            return list(self._messages)

    def to(self, address: str) -> list[SentEmail]:
        return [m for m in self.messages if m.to == address.lower()]

    def last(self, to: str) -> SentEmail:
        sent = self.to(to)
        if not sent:
            raise LookupError(f"no email was sent to {to}")
        return sent[-1]

    def last_token(self, to: str) -> str:
        match = _TOKEN_IN_LINK.search(self.last(to).body)
        if match is None:
            raise LookupError(f"the last email to {to} has no token link")
        return match.group(1)


outbox = Outbox()
_settings: Settings | None = None


def configure(settings: Settings) -> None:
    """Called by ``create_app``."""
    global _settings
    _settings = settings
    if settings.app_env == "prod" and settings.email_mode == "console":
        log.warning("EMAIL_MODE=console in production: email links are written to the server log")


def _domain(address: str) -> str:
    return address.rsplit("@", 1)[-1] if "@" in address else "?"


def _send_smtp(settings: Settings, message: SentEmail) -> None:
    mail = EmailMessage()
    mail["From"] = settings.email_from
    mail["To"] = message.to
    mail["Subject"] = message.subject
    mail.set_content(message.body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=SMTP_TIMEOUT_SECONDS) as smtp:
        smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password.get_secret_value())
        smtp.send_message(mail)


def send(to: str, subject: str, body: str) -> None:
    message = SentEmail(to=to.strip().lower(), subject=subject, body=body)
    mode = _settings.email_mode if _settings is not None else "console"
    if mode == "outbox":
        outbox.add(message)
        return
    if mode == "console" or _settings is None:
        log.info("email (console mode) to=%s subject=%s\n%s", message.to, message.subject, message.body)
        return
    try:
        _send_smtp(_settings, message)
    except (OSError, smtplib.SMTPException):
        log.exception("email: sending failed (recipient domain %s)", _domain(message.to))
