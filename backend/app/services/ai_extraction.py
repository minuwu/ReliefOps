"""AI field extraction (owner: Galib; API_SPEC §7.1, XREQ-002).

``extract_fields`` is called by ``extraction_engine`` (Asif), which owns the
overall 20 s timeout, the circuit breaker, the rule-based fallback and output
validation. This module only reads the document and asks the models.

Flow for one document:
1. Read its text locally: PDF text layer (PyMuPDF), or OCR for images and
   scanned PDFs (Tesseract, jpn+eng). Free, offline, unlimited.
2. Ask a vision model for the fields, trying free providers in order
   (``CHAIN``) within one time budget. Free tiers fail often (429/503/504),
   so the next one takes over.
3. Score each field ourselves. The models say ~1.0 for everything, so their
   number is only one part: format checks and "does the quoted evidence really
   appear in the OCR text" decide most of it. A field we can't verify stays
   below the review threshold, so a person checks it (rule D3).

If every provider fails, raise AIUnavailableError: the engine then uses its
rules fallback. Document text is treated as data (see prompts/extract-v1.md);
nothing here acts on it.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import re
import time
import unicodedata
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date
from functools import cache
from pathlib import Path
from typing import Any, Final

from app.services import ai_quota
from app.services.ai_errors import AIUnavailableError

PROMPT_VERSION: Final = "extract-v2"  # v2: keep company markers in names; masked/unclear values left out
PROMPT_FILE: Final = Path(__file__).resolve().parents[1] / "prompts" / f"{PROMPT_VERSION}.md"

BUDGET_SECONDS: Final = 17.0  # engine gives up at 20 s
MIN_ATTEMPT_SECONDS: Final = 3.0  # don't start a provider with less time than this
MAX_IMAGE_SIDE: Final = 2000
MIN_PDF_TEXT: Final = 20  # fewer characters than this = scanned PDF, use OCR

FIELDS: Final = (
    "victim_name", "victim_phone", "victim_email", "amount", "currency",
    "transfer_date", "account_number", "account_holder_name", "scam_type",
)
SCAM_TYPES: Final = ("phishing", "impersonation", "investment", "romance", "lottery_prize", "job_offer", "other")


@dataclass(frozen=True, slots=True)
class Provider:
    name: str  # "gemini" | "openrouter"
    model: str
    timeout: float  # seconds, capped by what's left of the budget


# Measured 2026-11-15 on synthetic slips, thinking off/low: 2.5 Flash ~3-5 s, 3.6 Flash ~4-10 s,
# 3.5 Flash-Lite 3.3 s, 3.1 Flash-Lite 2.9 s, Nemotron VL ~11-21 s. Gemini free tier = 20 requests/day
# per model, so several models give ~80/day before OpenRouter (50/day). 3.7/3.8 Flash timed out on free tier.
CHAIN: Final = (
    Provider("gemini", "gemini-2.5-flash", 7.0),
    Provider("gemini", "gemini-3.6-flash", 9.0),
    Provider("gemini", "gemini-3.5-flash-lite", 6.0),
    Provider("gemini", "gemini-3.1-flash-lite", 6.0),
    Provider("openrouter", "nvidia/nemotron-3.5-super-vl:free", 14.0),
)


@dataclass(frozen=True, slots=True)
class Page:
    """What we send to a model: one image, or text when the file has no image."""

    image_png: bytes | None
    text: str  # local text (PDF layer or OCR), "" when unavailable


# ------------------------------------------------------------------ reading the document locally


def _load_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)


def normalize(text: str) -> str:
    """NFKC (full-width and circled digits → ASCII), and drop the spaces OCR puts between CJK characters."""
    text = unicodedata.normalize("NFKC", text)
    return re.sub(r"(?<=[^\x00-\x7f]) (?=[^\x00-\x7f])", "", text)


def _ocr(png: bytes) -> str:
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        return ""
    if cmd := os.environ.get("TESSERACT_CMD"):
        pytesseract.pytesseract.tesseract_cmd = cmd
    try:
        return pytesseract.image_to_string(Image.open(io.BytesIO(png)), lang="jpn+eng", timeout=5)
    except Exception:  # noqa: BLE001 - OCR is a helper; without it fields just stay unverified
        return ""


def _shrink(png_or_jpeg: bytes) -> bytes:
    """Re-encode as PNG, at most MAX_IMAGE_SIDE px: faster upload, fewer tokens, one format downstream."""
    from PIL import Image

    img = Image.open(io.BytesIO(png_or_jpeg))
    img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
    out = io.BytesIO()
    img.convert("RGB").save(out, "PNG")
    return out.getvalue()


def read_document(file_bytes: bytes, mime_type: str) -> Page:
    """Turn the upload into one image and/or local text. Raises AIUnavailableError if it can't be read."""
    try:
        if mime_type == "text/plain":
            return Page(None, normalize(file_bytes.decode("utf-8")))
        if mime_type in ("image/png", "image/jpeg"):
            png = _shrink(file_bytes)
            return Page(png, normalize(_ocr(png)))
        if mime_type == "application/pdf":
            import pymupdf

            with pymupdf.open(stream=file_bytes, filetype="pdf") as pdf:
                first = pdf[0]  # slips are one page; later pages are ignored
                text = first.get_text()
                png = first.get_pixmap(dpi=200).tobytes("png")
            png = _shrink(png)
            if len(text.strip()) < MIN_PDF_TEXT:
                text = _ocr(png)
            return Page(png, normalize(text))
    except ImportError as exc:
        raise AIUnavailableError(f"document library missing: {exc.name}") from exc
    except Exception as exc:  # corrupt file
        raise AIUnavailableError(f"could not read the document: {type(exc).__name__}") from exc
    raise AIUnavailableError(f"unsupported file type {mime_type}")


# ------------------------------------------------------------------ asking the models


@cache
def _prompt() -> str:
    return PROMPT_FILE.read_text(encoding="utf-8")


_SCHEMA: Final = {
    "type": "object",
    "properties": {"fields": {"type": "array", "items": {"type": "object", "properties": {
        "name": {"type": "string", "enum": list(FIELDS)},
        "value": {"type": "string"},
        "confidence": {"type": "number"},
        "evidence": {"type": "string"},
    }, "required": ["name", "value", "confidence", "evidence"]}}},
    "required": ["fields"],
}


# Models without schema support copy a schema back instead of filling it, so they get an example.
_EXAMPLE: Final = json.dumps({"fields": [
    {"name": "amount", "value": "250000", "confidence": 0.9, "evidence": "振込金額 ¥250,000"},
    {"name": "transfer_date", "value": "2026-10-28", "confidence": 0.9, "evidence": "お取扱日 2026年10月28日"},
]}, ensure_ascii=False)


def _ask_gemini(model: str, page: Page, timeout: float) -> str:
    from google import genai
    from google.genai import types

    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise AIUnavailableError("GEMINI_API_KEY not set")
    client = genai.Client(api_key=key, http_options=types.HttpOptions(
        # Gemini rejects deadlines under 10 s; our own shorter cap is enforced in extract_fields.
        api_version="v1beta", timeout=int(max(timeout, 10.0) * 1000),
        retry_options=types.HttpRetryOptions(attempts=1)))
    parts: list[Any] = [_prompt()]
    parts.append(types.Part.from_bytes(data=page.image_png, mime_type="image/png") if page.image_png
                 else f"Document text:\n<<<\n{page.text}\n>>>")
    # Thinking eats the output budget and time; this is reading, not reasoning. 2.x takes a budget, 3.x a level.
    thinking = (types.ThinkingConfig(thinking_budget=0) if model.startswith("gemini-2")
                else types.ThinkingConfig(thinking_level="low"))
    reply = client.models.generate_content(model=model, contents=parts, config=types.GenerateContentConfig(
        response_mime_type="application/json", response_schema=_SCHEMA, temperature=0, max_output_tokens=2048,
        thinking_config=thinking))
    return reply.text or ""


def _ask_openrouter(model: str, page: Page, timeout: float) -> str:
    from openai import OpenAI

    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise AIUnavailableError("OPENROUTER_API_KEY not set")
    client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=key, timeout=timeout, max_retries=0)
    instructions = _prompt() + "\nReply with JSON only, filled in like this example:\n" + _EXAMPLE
    content: list[dict[str, Any]] = [{"type": "text", "text": instructions}]
    if page.image_png:
        url = "data:image/png;base64," + base64.b64encode(page.image_png).decode()
        content.append({"type": "image_url", "image_url": {"url": url}})
    else:
        content.append({"type": "text", "text": f"Document text:\n<<<\n{page.text}\n>>>"})
    reply = client.chat.completions.create(model=model, temperature=0, max_tokens=4096,
                                           response_format={"type": "json_object"},
                                           messages=[{"role": "user", "content": content}])
    return reply.choices[0].message.content or ""


ASKERS: dict[str, Callable[[str, Page, float], str]] = {"gemini": _ask_gemini, "openrouter": _ask_openrouter}


# ------------------------------------------------------------------ cleaning and scoring the answer


def _json_from(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`").removeprefix("json").strip()
    data = json.loads(text)
    if not isinstance(data, dict) or not isinstance(data.get("fields"), list):
        raise TypeError("no fields list")
    return data


_PLACEHOLDER: Final = re.compile(
    r"[*＊●○×]{2,}|不鮮明|不明|判読|unreadable|illegible|unknown|^n/?a$|^none$|^-+$", re.IGNORECASE)


def clean_value(name: str, raw: Any) -> Any:
    """Return the value in the contract's format, or None if it isn't valid for that field."""
    value = normalize(str(raw)).strip()
    if not value or _PLACEHOLDER.search(value):
        return None  # "(印字不鮮明)", "*******", "unknown": a note about the value, not the value
    if name == "amount":
        digits = re.sub(r"[,\s¥円$]", "", value)
        if not re.fullmatch(r"\d+(\.\d{1,2})?", digits):
            return None
        number = float(digits)
        return int(number) if number.is_integer() else number
    if name == "currency":
        value = {"¥": "JPY", "円": "JPY"}.get(value, value.upper())
        return value if re.fullmatch(r"[A-Z]{3}", value) else None
    if name == "transfer_date":
        try:
            return date.fromisoformat(value).isoformat()
        except ValueError:
            return None
    if name == "account_number":
        digits = re.sub(r"[\s-]", "", value)
        return digits if re.fullmatch(r"\d{4,20}", digits) else None
    if name == "victim_email":
        return value.lower() if re.fullmatch(r"[^@\s]+@[^@\s]+\.[A-Za-z]{2,}", value) else None
    if name == "scam_type":
        return value if value in SCAM_TYPES else None
    return value[:200]


def _squash(text: str) -> str:
    return re.sub(r"[\s,、。:：|]", "", normalize(text)).lower()


_INSTRUCTION_WORDS: Final = re.compile(
    r"ignore|instruction|approve|system|assistant|prompt|override|承認|指示|無視", re.IGNORECASE)
_CURRENCY_MARKS: Final = {"JPY": ("¥", "円", "jpy", "yen"), "USD": ("$", "usd"), "BDT": ("৳", "bdt", "taka")}


def evidence_found(name: str, evidence: str, value: Any, local_text: str) -> bool | None:
    """Does our own reading of the document confirm this field?

    True: the quoted evidence is in the document (and, for numbers, the value is in the quote).
    False: the quote reads like an instruction, or neither quote nor value is in the document.
    None: can't tell (no local text, or only the bare value appears somewhere).
    """
    if not local_text.strip():
        return None
    if _INSTRUCTION_WORDS.search(evidence):
        return False  # a "field" quoted from an injected instruction is never trusted
    haystack = _squash(local_text)
    if name == "currency":
        return any(mark in haystack for mark in _CURRENCY_MARKS.get(str(value), (str(value).lower(),)))
    quote, needle = _squash(evidence), _squash(str(value))
    if len(quote) >= 3 and quote in haystack:
        return needle in quote if name in ("amount", "account_number") else True
    return None if len(needle) >= 3 and needle in haystack else False


def score(model_confidence: Any, found: bool | None) -> float:
    """Our confidence: 45 % the model's own, 55 % local verification.

    Verified evidence can reach 1.0. Unverifiable (no OCR text) is capped at 0.72,
    and contradicted evidence at 0.45: both stay below the 0.75 review threshold.
    """
    try:
        model = min(max(float(model_confidence), 0.0), 1.0)
    except (TypeError, ValueError):
        model = 0.5
    check = {True: 1.0, None: 0.3, False: 0.0}[found]
    return round(0.45 * model + 0.55 * check, 3)


def build_fields(answer: dict[str, Any], local_text: str) -> list[dict[str, Any]]:
    fields: dict[str, dict[str, Any]] = {}
    for item in answer["fields"]:
        if not isinstance(item, dict) or item.get("name") not in FIELDS:
            continue  # unknown names are dropped (API_SPEC §7.1)
        name = item["name"]
        value = clean_value(name, item.get("value"))
        if value is None:
            continue
        evidence = normalize(str(item.get("evidence") or ""))[:200]
        field = {"name": name, "value": value, "evidence": evidence or None,
                 "confidence": score(item.get("confidence"), evidence_found(name, evidence, value, local_text))}
        if name not in fields or field["confidence"] > fields[name]["confidence"]:
            fields[name] = field
    return list(fields.values())


# ------------------------------------------------------------------ entry point


# SDK timeouts aren't hard caps (Gemini's minimum is 10 s), so each attempt runs here and we stop waiting
# at its cap. An abandoned call finishes in the background; its answer is discarded.
_POOL: Final = ThreadPoolExecutor(max_workers=8, thread_name_prefix="ai-provider")

def extract_fields(file_bytes: bytes, mime_type: str, doc_type: str) -> dict[str, Any]:
    """API_SPEC §7.1. Returns {"fields": [...], "model": ..., "prompt_version": ...}.

    Raises AIUnavailableError when the file can't be read or every provider fails.
    """
    started = time.monotonic()
    if not file_bytes:
        return {"fields": [], "model": None, "prompt_version": PROMPT_VERSION}
    _load_env()
    page = read_document(file_bytes, mime_type)
    errors: list[str] = []
    for provider in CHAIN:
        if wait := ai_quota.seconds_left(provider.model):  # rate-limited earlier: skip, don't spend budget
            errors.append(f"{provider.model}: quota used up, {int(wait)} s left")
            continue
        left = BUDGET_SECONDS - (time.monotonic() - started)
        if left < MIN_ATTEMPT_SECONDS:
            errors.append("time budget used up")
            break
        try:
            cap = min(provider.timeout, left)
            answer = _json_from(_POOL.submit(ASKERS[provider.name], provider.model, page, cap).result(timeout=cap))
        except AIUnavailableError as exc:
            errors.append(f"{provider.model}: {exc}")
            continue
        except Exception as exc:  # noqa: BLE001 - rate limit, overload, timeout, bad JSON: try the next one
            ai_quota.note_failure(provider.model, str(exc))
            errors.append(f"{provider.model}: {type(exc).__name__} {str(exc)[:60]}".rstrip())
            continue
        return {"fields": build_fields(answer, page.text), "model": provider.model, "prompt_version": PROMPT_VERSION}
    if cached := cached_result(file_bytes):
        return cached  # every provider failed: replay the recorded real result, labelled as such
    raise AIUnavailableError("; ".join(errors) or "no provider configured")


# ------------------------------------------------------------------ demo replay cache

# Real results recorded earlier for the synthetic seed documents (scripts/record_ai_cache.py). Used only
# when every live provider fails, so a demo survives free-tier quotas or no Wi-Fi. The model name is
# prefixed "cached:" so nobody mistakes a replay for a live call. Unknown files never hit the cache.
CACHE_DIR: Final = Path(__file__).resolve().parents[2] / "seed_data" / "ai_cache" / "extraction"


def file_key(file_bytes: bytes) -> str:
    """SHA-256 of the file. Text files are hashed with LF line endings, so the same document matches on
    Windows (CRLF checkout) and on the Linux server (git stores LF); binary files are hashed as they are."""
    if b"\0" not in file_bytes:
        try:
            file_bytes = file_bytes.decode("utf-8").replace("\r\n", "\n").encode("utf-8")
        except UnicodeDecodeError:
            pass  # binary (images, most PDFs)
    return hashlib.sha256(file_bytes).hexdigest()


def cached_result(file_bytes: bytes) -> dict[str, Any] | None:
    path = CACHE_DIR / f"{file_key(file_bytes)}.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if data.get("prompt_version") != PROMPT_VERSION or not isinstance(data.get("fields"), list):
        return None  # recorded with another prompt: don't pretend it is current
    return {"fields": data["fields"], "model": f"cached:{data.get('model')}", "prompt_version": PROMPT_VERSION}


def record_result(file_bytes: bytes, result: dict[str, Any], source: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{file_key(file_bytes)}.json"
    path.write_text(json.dumps({**result, "source_file": source}, ensure_ascii=False, indent=1) + "\n",
                    encoding="utf-8")
    return path
