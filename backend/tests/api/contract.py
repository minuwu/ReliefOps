"""Validate a real response body against a schema in docs/openapi.yaml (the shared contract)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import jsonschema
import yaml

CONTRACT = Path(__file__).resolve().parents[3] / "docs" / "openapi.yaml"


@lru_cache(maxsize=1)
def _components() -> dict[str, Any]:
    return yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))["components"]


def validate(body: Any, schema_name: str) -> None:
    """Raise ``jsonschema.ValidationError`` if ``body`` doesn't match ``components.schemas[schema_name]``."""
    schema = {"$ref": f"#/components/schemas/{schema_name}", "components": _components()}
    jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker()).validate(body)
