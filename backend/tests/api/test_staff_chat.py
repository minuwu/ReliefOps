"""N17: staff read the victim's case chat and reply (API_SPEC §6.8)."""

from __future__ import annotations

from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text

from app.config import Settings
from app.seed import CASE_42_ID

from .contract import validate

Login = Callable[[str], dict[str, str]]
CASE = str(CASE_42_ID)  # bank_b, owned by victim1


@pytest.fixture(scope="module")
def owner(settings: Settings) -> Iterator[Engine]:
    engine = create_engine(settings.migrations_database_url)
    yield engine
    engine.dispose()


def _ask_for_a_person(client: TestClient, login_as: Login) -> dict:
    r = client.post(
        f"/api/victim/cases/{CASE}/chat/messages",
        headers=login_as("victim1"),
        json={"question": "Can I talk to a person at the operations center, please?"},
    )
    assert r.status_code == 201, r.text
    return r.json()["data"]


def test_escalated_question_is_answered_by_staff_and_the_flag_clears(
    client: TestClient, login_as: Login, owner: Engine
) -> None:
    exchange = _ask_for_a_person(client, login_as)
    assert exchange["answer"]["needs_staff"] is True

    thread = client.get(f"/api/cases/{CASE}/chat", headers=login_as("operator"))
    assert thread.status_code == 200
    validate(thread.json(), "ChatThreadResponse")
    assert thread.json()["data"]["victim_question_pending"] is True
    assert thread.json()["data"]["case_reference"] == "RFR-2026-00042"
    staff_ids = {m["id"] for m in thread.json()["data"]["messages"]}
    victim_ids = {
        m["id"]
        for m in client.get(f"/api/victim/cases/{CASE}/chat", headers=login_as("victim1")).json()["data"]["messages"]
    }
    assert staff_ids == victim_ids  # staff see exactly what the victim saw

    r = client.post(
        f"/api/cases/{CASE}/chat/reply",
        headers=login_as("operator"),
        json={"body": " Hello, this is the operations center. We'll call you today. "},
    )
    assert r.status_code == 201, r.text
    validate(r.json(), "ChatMessageResponse")
    message = r.json()["data"]
    assert (message["role"], message["author"]["name"], message["language"]) == ("staff", "Operator One", "ja")
    assert message["body"] == "Hello, this is the operations center. We'll call you today."
    assert (message["answer_type"], message["citations"], message["needs_staff"]) == (None, [], False)

    after = client.get(f"/api/cases/{CASE}/chat", headers=login_as("operator")).json()["data"]
    assert after["victim_question_pending"] is False
    victim_view = client.get(f"/api/victim/cases/{CASE}/chat", headers=login_as("victim1")).json()["data"]
    assert victim_view["messages"][-1]["id"] == message["id"]
    case = client.get(f"/api/cases/{CASE}", headers=login_as("operator")).json()["data"]
    assert case["flags"]["victim_question_pending"] is False

    with owner.begin() as conn:
        conn.execute(text("select set_config('app.role', 'system', true)"))
        actions = (
            conn.execute(
                text("select action from audit_log where case_id = :id order by at desc limit 5"), {"id": CASE_42_ID}
            )
            .scalars()
            .all()
        )
    assert "chat.staff_replied" in actions


def test_who_may_read_and_reply(client: TestClient, login_as: Login) -> None:
    url = f"/api/cases/{CASE}/chat"
    assert client.get(url, headers=login_as("viewer_b")).status_code == 200
    assert client.get(url, headers=login_as("viewer_a")).status_code == 404  # another bank's case
    assert client.get(url, headers=login_as("victim1")).status_code == 403  # victims use /api/victim/...
    assert client.post(f"{url}/reply", headers=login_as("viewer_b"), json={"body": "x"}).status_code == 403
    assert client.post(f"{url}/reply", headers=login_as("operator"), json={"body": "  "}).status_code == 422
    assert (
        client.post(f"{url}/reply", headers=login_as("operator"), json={"body": "x", "role": "assistant"}).status_code
        == 422
    )
    missing = "/api/cases/00000000-0000-4000-8000-000000000000/chat/reply"
    assert client.post(missing, headers=login_as("operator"), json={"body": "x"}).status_code == 404


def test_staff_can_still_reply_on_a_closed_case(client: TestClient, login_as: Login) -> None:
    closed = client.get("/api/cases", headers=login_as("operator"), params={"status": "closed"}).json()["data"]
    case_id = closed["items"][0]["id"]
    r = client.post(f"/api/cases/{case_id}/chat/reply", headers=login_as("supervisor"), json={"body": "Following up."})
    assert r.status_code == 201
