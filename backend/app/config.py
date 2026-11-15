"""App settings from the environment or ``backend/.env`` (owner: Anim; guide §3.6).

Tests build ``Settings(_env_file=None, ...)`` explicitly so nothing leaks in from a
developer's ``.env`` (guide §8.2). The defaults are the local development values
from ``.env.example``; production must set every connection string explicitly.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from sqlalchemy.engine import make_url

DEV_DATABASE_URL = "postgresql+psycopg://app_user:app_password@localhost:5432/fraud_relief"
DEV_MIGRATIONS_DATABASE_URL = "postgresql+psycopg://migrator:migrator_password@localhost:5432/fraud_relief"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["dev", "test", "prod"] = "dev"
    database_url: str = DEV_DATABASE_URL
    migrations_database_url: str = DEV_MIGRATIONS_DATABASE_URL
    # Without it, a down database can make requests (even /api/health) hang for a long time.
    db_connect_timeout_seconds: int = Field(default=5, ge=1, le=60)

    session_hours: int = Field(default=8, ge=1, le=72)
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000", "http://localhost:5173"]
    frontend_base_url: str = "http://localhost:3000"

    # console: print emails to the log · smtp: send them · outbox: keep them in memory (tests)
    email_mode: Literal["console", "smtp", "outbox"] = "console"
    email_from: str = "no-reply@example.test"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: SecretStr = SecretStr("")

    # live: call the AI providers · off: always use the fallback (tests the AI-down path)
    ai_mode: Literal["live", "off"] = "live"
    ai_timeout_seconds: float = Field(default=20, gt=0)
    ai_max_concurrent: int = Field(default=4, ge=1, le=32)
    # Read by Galib's AI module from the environment; declared here only so health can report `disabled`.
    gemini_api_key: SecretStr = SecretStr("")
    openrouter_api_key: SecretStr = SecretStr("")
    groq_api_key: SecretStr = SecretStr("")

    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def _production_needs_real_urls(self) -> Settings:
        if self.app_env == "prod" and DEV_DATABASE_URL in (self.database_url, self.migrations_database_url):
            raise ValueError("APP_ENV=prod needs DATABASE_URL and MIGRATIONS_DATABASE_URL set explicitly")
        if self.app_env == "prod" and self.email_mode == "outbox":
            raise ValueError("EMAIL_MODE=outbox is for tests only")
        return self

    @property
    def app_database_url(self) -> str:
        """``database_url`` with a connect timeout, unless the URL already sets one."""
        url = make_url(self.database_url)
        if "connect_timeout" in url.query:
            return self.database_url
        return url.update_query_dict({"connect_timeout": str(self.db_connect_timeout_seconds)}).render_as_string(
            hide_password=False
        )

    @property
    def ai_configured(self) -> bool:
        """At least one provider key is set and the AI isn't switched off."""
        keys = (self.gemini_api_key, self.openrouter_api_key, self.groq_api_key)
        return self.ai_mode == "live" and any(key.get_secret_value() for key in keys)


@lru_cache
def get_settings() -> Settings:
    return Settings()
