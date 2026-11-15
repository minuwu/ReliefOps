"""N4: email modes (outbox, console, SMTP) without a network."""

from __future__ import annotations

import logging
import smtplib
from collections.abc import Iterator

import pytest
from pydantic import SecretStr

from app import email
from app.config import Settings


def _settings(**overrides: object) -> Settings:
    return Settings(_env_file=None, app_env="test", **overrides)  # type: ignore[call-arg]


@pytest.fixture(autouse=True)
def _reset() -> Iterator[None]:
    email.outbox.clear()
    yield
    email.outbox.clear()
    email.configure(_settings(email_mode="outbox"))


def test_outbox_keeps_messages_and_finds_the_link_token() -> None:
    email.configure(_settings(email_mode="outbox"))
    email.send(" Victim@Mail.Test ", "Verify your email", "Open http://localhost:3000/verify-email?token=abc_DEF-123\n")
    sent = email.outbox.last("victim@mail.test")
    assert (sent.to, sent.subject) == ("victim@mail.test", "Verify your email")
    assert email.outbox.last_token("VICTIM@mail.test") == "abc_DEF-123"
    with pytest.raises(LookupError):
        email.outbox.last("nobody@mail.test")


def test_console_mode_logs_the_message_for_developers(caplog: pytest.LogCaptureFixture) -> None:
    email.configure(_settings(email_mode="console"))
    with caplog.at_level(logging.INFO, logger="app.email"):
        email.send("dev@mail.test", "Reset your password", "link: http://x.test/reset?token=t1")
    assert "token=t1" in caplog.text and "dev@mail.test" in caplog.text
    assert email.outbox.messages == []


class _FakeSMTP:
    instances: list[_FakeSMTP] = []
    fail_with: Exception | None = None

    def __init__(self, host: str, port: int, timeout: float) -> None:
        self.args = (host, port, timeout)
        self.calls: list[str] = []
        self.sent: list[object] = []
        _FakeSMTP.instances.append(self)
        if _FakeSMTP.fail_with is not None:
            raise _FakeSMTP.fail_with

    def __enter__(self) -> _FakeSMTP:
        return self

    def __exit__(self, *exc: object) -> None:
        self.calls.append("quit")

    def starttls(self) -> None:
        self.calls.append("starttls")

    def login(self, user: str, password: str) -> None:
        self.calls.append(f"login:{user}:{password}")

    def send_message(self, message: object) -> None:
        self.sent.append(message)


@pytest.fixture
def fake_smtp(monkeypatch: pytest.MonkeyPatch) -> type[_FakeSMTP]:
    _FakeSMTP.instances, _FakeSMTP.fail_with = [], None
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)
    return _FakeSMTP


def test_smtp_mode_uses_starttls_login_and_timeout(fake_smtp: type[_FakeSMTP]) -> None:
    email.configure(
        _settings(
            email_mode="smtp",
            smtp_host="smtp.example.test",
            smtp_port=2525,
            smtp_user="mailer",
            smtp_password=SecretStr("pw"),
            email_from="no-reply@example.test",
        )
    )
    email.send("victim@mail.test", "Hello", "Body")
    smtp = fake_smtp.instances[-1]
    assert smtp.args == ("smtp.example.test", 2525, email.SMTP_TIMEOUT_SECONDS)
    assert smtp.calls[:2] == ["starttls", "login:mailer:pw"]
    message = smtp.sent[0]
    assert (message["To"], message["From"], message["Subject"]) == (
        "victim@mail.test",
        "no-reply@example.test",
        "Hello",
    )


def test_smtp_failure_is_logged_without_the_address_and_never_raises(
    fake_smtp: type[_FakeSMTP], caplog: pytest.LogCaptureFixture
) -> None:
    email.configure(_settings(email_mode="smtp", smtp_host="smtp.example.test"))
    fake_smtp.fail_with = ConnectionRefusedError("refused")
    with caplog.at_level(logging.ERROR, logger="app.email"):
        email.send("private.person@mail.test", "Hello", "Body with ?token=secret")
    assert "mail.test" in caplog.text
    assert "private.person" not in caplog.text and "secret" not in caplog.text
