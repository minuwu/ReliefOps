"""The app framework without a database (N1): envelope, errors, request log, CORS, health."""

from __future__ import annotations

import logging
from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, ConfigDict, Field, SecretStr, ValidationError

from app.config import Settings
from app.errors import ApiError
from app.main import create_app
from app.routers.reference import health_status
from app.services import extraction_engine

UNREACHABLE_DB = "postgresql+psycopg://app_user:app_password@127.0.0.1:1/nothing_test"
ORIGIN = "http://localhost:5173"


class Body(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1)
    amount: int = Field(ge=0)


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "app_env": "test",
        "database_url": UNREACHABLE_DB,
        "db_connect_timeout_seconds": 1,
        "email_mode": "outbox",
    }
    return Settings(_env_file=None, **(values | overrides))  # type: ignore[call-arg]


def _add_probe_routes(app: FastAPI) -> None:
    @app.post("/probe/body")
    def body(data: Body) -> dict:
        return {"success": True, "data": data.model_dump(), "message": "ok"}

    @app.get("/probe/api-error")
    def api_error() -> None:
        raise ApiError(409, "STALE_CASE", "This case changed; reload it", {"current_version": 4})

    @app.get("/probe/rate-limited")
    def rate_limited() -> None:
        raise ApiError(429, "RATE_LIMITED", "Too many attempts", {"retry_after": 42})

    @app.get("/probe/crash")
    def crash() -> None:
        raise RuntimeError("boom")


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app(make_settings())
    _add_probe_routes(app)
    with TestClient(app) as c:
        yield c


def test_unknown_route_is_a_404_envelope(client: TestClient) -> None:
    r = client.get("/api/does-not-exist")
    assert r.status_code == 404
    assert r.json() == {
        "success": False,
        "error": {"code": "RESOURCE_NOT_FOUND", "message": "Not found", "details": {}},
    }


def test_validation_errors_use_the_envelope_with_field_names(client: TestClient) -> None:
    r = client.post("/probe/body", json={"name": "", "amount": -1, "role": "supervisor"})
    assert r.status_code == 422
    error = r.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["message"] == "Request has invalid fields"
    fields = {f["field"]: f["message"] for f in error["details"]["fields"]}
    assert set(fields) == {"name", "amount", "role"}
    assert fields["role"] == "Unknown field"


def test_malformed_json_is_400_bad_request(client: TestClient) -> None:
    r = client.post("/probe/body", content=b'{"name": ', headers={"Content-Type": "application/json"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "BAD_REQUEST"


def test_api_error_keeps_status_code_and_details(client: TestClient) -> None:
    r = client.get("/probe/api-error")
    assert r.status_code == 409
    assert r.json()["error"] == {
        "code": "STALE_CASE",
        "message": "This case changed; reload it",
        "details": {"current_version": 4},
    }


def test_rate_limited_error_sends_retry_after(client: TestClient) -> None:
    r = client.get("/probe/rate-limited")
    assert r.status_code == 429
    assert r.headers["Retry-After"] == "42"


def test_unexpected_error_is_a_500_envelope_with_cors(client: TestClient) -> None:
    r = client.get("/probe/crash", headers={"Origin": ORIGIN})
    assert r.status_code == 500
    assert r.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "boom" not in r.text
    assert r.headers["access-control-allow-origin"] == ORIGIN


def test_every_response_has_a_request_id_and_reuses_a_safe_one(client: TestClient) -> None:
    assert len(client.get("/api/does-not-exist").headers["X-Request-ID"]) == 32
    mine = "proxy-id-1234567"
    assert client.get("/probe/api-error", headers={"X-Request-ID": mine}).headers["X-Request-ID"] == mine
    assert client.get("/probe/api-error", headers={"X-Request-ID": "bad id!"}).headers["X-Request-ID"] != "bad id!"


def test_request_log_has_route_but_never_the_query_string(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="app.request"):
        client.get("/probe/api-error?token=super-secret-value")
    lines = [rec.getMessage() for rec in caplog.records if rec.name == "app.request"]
    assert any("route=/probe/api-error status=409" in line for line in lines)
    assert all("super-secret-value" not in line for line in lines)


def test_cors_preflight_allows_the_frontend_origin(client: TestClient) -> None:
    r = client.options("/api/health", headers={"Origin": ORIGIN, "Access-Control-Request-Method": "GET"})
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == ORIGIN


def test_health_reports_database_down_without_failing(client: TestClient) -> None:
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["status"] == "healthy"
    assert data["db"] == "unavailable"
    assert data["ai"] == "disabled"  # no provider key in these settings
    assert data["rag"] == "disabled"


def test_health_shows_ai_unavailable_while_the_breaker_is_open() -> None:
    settings = make_settings(gemini_api_key=SecretStr("test-key"))
    breaker = extraction_engine.CircuitBreaker()
    extraction_engine.configure(breaker=breaker)
    try:
        assert health_status(settings, db_ok=True).ai == "available"
        for _ in range(3):
            breaker.record_failure()
        status = health_status(settings, db_ok=True)
        assert (status.ai, status.rag) == ("unavailable", "degraded")
    finally:
        extraction_engine.configure()


def test_ai_mode_off_reports_disabled_even_with_a_key() -> None:
    settings = make_settings(gemini_api_key=SecretStr("test-key"), ai_mode="off")
    assert health_status(settings, db_ok=True).ai == "disabled"


def test_app_database_url_adds_a_connect_timeout_once() -> None:
    assert make_settings().app_database_url.endswith("?connect_timeout=1")
    explicit = UNREACHABLE_DB + "?connect_timeout=9"
    assert make_settings(database_url=explicit).app_database_url == explicit


def test_cors_origins_accept_a_comma_separated_string() -> None:
    assert make_settings(cors_origins="http://a.test, http://b.test,").cors_origins == [
        "http://a.test",
        "http://b.test",
    ]


def test_production_refuses_the_development_database_urls() -> None:
    with pytest.raises(ValidationError, match="APP_ENV=prod"):
        make_settings(
            app_env="prod", database_url="postgresql+psycopg://app_user:app_password@localhost:5432/fraud_relief"
        )


def test_openapi_schema_builds(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    assert {"/api/health", "/api/banks"} <= set(paths)
