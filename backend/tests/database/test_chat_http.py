"""Real HTTP adapters against PostgreSQL. Only authentication and AI are test doubles."""

from pathlib import Path
from uuid import UUID, uuid4

import jsonschema
import pytest
import yaml
from fastapi import FastAPI, Header
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.routers.victim_chat import create_router
from app.services.caller import StaticCaller
from app.services.service_errors import ServiceError
from app.services.victim_chat import ChatSettings
from .conftest import insert_case, insert_user, set_scope


@pytest.fixture
def http_chat(app_db, owner_engine, knowledge, callers):
    with owner_engine.begin() as c:
        set_scope(c, "system")
        user = insert_user(c, f"http-{uuid4().hex}@test.test", "victim")
        case_id = insert_case(c, "bank_b", victim_user_id=user)
    accounts = {"own": StaticCaller(UUID(user), "Test victim", "victim"), **callers}
    def authenticate(authorization: str | None = Header(default=None)):
        key = (authorization or "").removeprefix("Bearer ")
        if key not in accounts:
            raise ServiceError(401, "UNAUTHORIZED", "Authentication required")
        return accounts[key]
    app = FastAPI()
    @app.exception_handler(ServiceError)
    async def service_error(request, exc):
        return JSONResponse(status_code=exc.status, content={"success": False,
                            "error": {"code": exc.code, "message": exc.message, "details": exc.details}})
    @app.exception_handler(RequestValidationError)
    async def invalid(request, exc):
        return JSONResponse(status_code=422, content={"success": False,
                            "error": {"code": "VALIDATION_ERROR", "message": "Invalid input", "details": {}}})
    app.include_router(create_router(authenticate, ChatSettings(ai_enabled=False)))
    with TestClient(app) as client:
        yield client, case_id


def validate(body, schema_name):
    spec = yaml.safe_load((Path(__file__).resolve().parents[3] / "docs/openapi.yaml").read_text(encoding="utf-8"))
    # Local references only; keep the canonical contract's complete components.
    schema = {"$ref": f"#/components/schemas/{schema_name}", "components": spec["components"]}
    jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker()).validate(body)


def test_http_exchange_and_feedback_match_canonical_contract(http_chat):
    client, case_id = http_chat
    headers = {"Authorization": "Bearer own"}
    path = f"/api/victim/cases/{case_id}/chat"
    empty = client.get(path, headers=headers)
    assert empty.status_code == 200
    validate(empty.json(), "ChatThreadResponse")
    response = client.post(path + "/messages", headers=headers, json={"question": "report documents"})
    assert response.status_code == 201
    validate(response.json(), "ChatExchangeResponse")
    message_id = response.json()["data"]["answer"]["id"]
    response = client.post(path + f"/messages/{message_id}/feedback", headers=headers, json={"feedback": "helpful"})
    assert response.status_code == 200
    validate(response.json(), "ChatMessageResponse")
    validate(client.get(path, headers=headers).json(), "ChatThreadResponse")
    assert client.get("/openapi.json").status_code == 200


@pytest.mark.parametrize("who,status", [(None, 401), ("victim1", 404), ("operator", 403), ("viewer_b", 403)])
def test_http_auth_and_ownership(http_chat, who, status):
    client, case_id = http_chat
    response = client.get(f"/api/victim/cases/{case_id}/chat",
                          headers={"Authorization": f"Bearer {who}"} if who else {})
    assert response.status_code == status and response.json()["success"] is False


def test_http_429_header_and_validation(http_chat, owner_engine):
    client, case_id = http_chat
    path = f"/api/victim/cases/{case_id}/chat/messages"
    headers = {"Authorization": "Bearer own"}
    assert client.post(path, headers=headers, json={"question": ""}).status_code == 422
    assert client.post(path, headers=headers, json={"question": "report", "language": None}).status_code == 422
    assert client.post(path, headers=headers, json={"question": "x", "bank_id": "bank_a"}).status_code == 422
    with owner_engine.begin() as c:
        set_scope(c, "system")
        c.exec_driver_sql("insert into chat_messages(case_id,bank_id,role,body,language) "
                          "select %s,'bank_b','victim','old','en' from generate_series(1,20)", (case_id,))
    response = client.post(path, headers=headers, json={"question": "report"})
    assert response.status_code == 429 and 1 <= int(response.headers["Retry-After"]) <= 3600
    assert response.json()["error"]["code"] == "RATE_LIMITED"
