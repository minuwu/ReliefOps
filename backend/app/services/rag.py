"""Case assistant AI functions (owner: Galib; API_SPEC §3.6 and §7.2, D14).

Retrieval is NOT here: the backend runs it inside the bank-scoped database session, so "only this
case's bank" is enforced by the database. This module only:
- splits a bluebook into passages (``split_bluebook``),
- turns texts into vectors (``embed``),
- writes an answer from the passages it is given (``answer``).

``answer`` never sees other banks' passages or identifying case data, has no tools, and its output is
checked in code: a grounded answer must cite passages it was given, otherwise it becomes ``no_answer``
and goes to staff. Raise AIUnavailableError when no model answers; the backend then returns
``passages_only``.
"""

from __future__ import annotations

import json
import math
import os
import re
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any, Final

from app.services import ai_quota
from app.services.ai_errors import AIUnavailableError

PROMPT_VERSION: Final = "answer-v2"  # v2: no claims that something is NOT offered unless a passage says so
MAX_OUTPUT_TOKENS: Final = 600  # ~120 words of JSON; Groq counts this against its tokens-per-minute limit
PROMPT_FILE: Final = Path(__file__).resolve().parents[1] / "prompts" / f"{PROMPT_VERSION}.md"

EMBED_MODEL: Final = "gemini-embedding-001"
EMBED_DIM: Final = 768  # fixed per model; changing model or size means re-embedding every passage
EMBED_BATCH: Final = 100

MAX_PASSAGE_CHARS: Final = 1800  # ~450 tokens
MAX_PASSAGES: Final = 5
MAX_HISTORY: Final = 6
MAX_BODY_WORDS: Final = 120
BUDGET_SECONDS: Final = 15.0
MIN_ATTEMPT_SECONDS: Final = 2.0

ANSWER_TYPES: Final = ("grounded", "no_answer", "refused")
CASE_FIELDS: Final = ("status", "time_in_stage", "missing_information", "scam_type", "amount", "transfer_date",
                      "closure_reason")

# Fixed texts, so the important ones never depend on a model.
TEXT: Final = {
    "disclaimer": {
        "en": "This is general information, not a decision about your payout.",
        "ja": "これは一般的な情報であり、お支払いに関する決定ではありません。",
        "bn": "এটি সাধারণ তথ্য, আপনার অর্থ প্রদানের বিষয়ে কোনো সিদ্ধান্ত নয়।",
    },
    "no_answer": {
        "en": "I couldn't find this in your bank's guide. A staff member will reply to you here.",
        "ja": "銀行のガイドにこの情報が見つかりませんでした。担当者がこちらで回答します。",
        "bn": "আপনার ব্যাংকের নির্দেশিকায় এটি খুঁজে পাইনি। একজন কর্মী এখানে আপনাকে উত্তর দেবেন।",
    },
    "staff": {
        "en": "I've asked a staff member to contact you. They will reply in this conversation.",
        "ja": "担当者に連絡するよう依頼しました。このやり取りの中で回答します。",
        "bn": "আমি একজন কর্মীকে আপনার সাথে যোগাযোগ করতে বলেছি। তারা এই কথোপকথনে উত্তর দেবেন।",
    },
    "refused": {
        "en": "I can only explain the relief process for your own case. I can't act on it, promise an amount, or "
              "talk about other people.",
        "ja": "ご自身のケースの手続きについてのみ説明できます。手続きの実行、金額の約束、他の方についての回答はできません。",
        "bn": "আমি শুধু আপনার নিজের মামলার প্রক্রিয়া ব্যাখ্যা করতে পারি। আমি কোনো পদক্ষেপ নিতে, অর্থের পরিমাণের "
              "প্রতিশ্রুতি দিতে বা অন্য কারও বিষয়ে কথা বলতে পারি না।",
    },
}

# "Let me talk to a person" always reaches staff, whatever the model thinks.
_WANTS_PERSON: Final = re.compile(
    r"\b(talk|speak|chat)\s+(to|with)\s+(a\s+|an?\s+)?(person|human|staff|someone|officer|agent|real)"
    r"|\bcall me\b|担当者|人と話|オペレーター|কর্মীর সাথে|মানুষের সাথে", re.IGNORECASE)


def _text(key: str, language: str) -> str:
    return TEXT[key].get(language, TEXT[key]["en"])


def _load_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)


# ------------------------------------------------------------------ split_bluebook

_HEADING: Final = re.compile(r"^\d+(\.\d+)*\s+\S.{0,70}$")


def _pages(file_bytes: bytes, mime_type: str) -> list[list[tuple[str, bool]]]:
    """Each page as (line, is_heading). A heading is a numbered line: in a PDF it must also be bold,
    in a TXT it must follow a blank line. That keeps wrapped lines like "3 January) ..." as body text."""
    if mime_type == "text/plain":
        pages = []
        for page in file_bytes.decode("utf-8").split("\f"):  # form feed = page break
            lines, previous = [], ""
            for line in page.splitlines():
                lines.append((line, bool(_HEADING.match(line.strip())) and not previous.strip()))
                previous = line
            pages.append(lines)
        return pages
    if mime_type == "application/pdf":
        try:
            import pymupdf
        except ImportError as exc:
            raise AIUnavailableError("pymupdf is not installed") from exc
        pages = []
        with pymupdf.open(stream=file_bytes, filetype="pdf") as pdf:
            for page in pdf:
                lines = []
                for block in page.get_text("dict")["blocks"]:
                    for line in block.get("lines", []):
                        spans = [s for s in line["spans"] if s["text"].strip()]
                        text = "".join(s["text"] for s in line["spans"])
                        bold = bool(spans) and all(s["flags"] & 16 or "bold" in s["font"].lower() for s in spans)
                        lines.append((text, bold and bool(_HEADING.match(text.strip()))))
                    lines.append(("", False))  # block end = paragraph break
                pages.append(lines)
        return pages
    raise ValueError(f"unsupported bluebook type {mime_type}")


def _join_lines(lines: list[str]) -> str:
    """Undo PDF line wrapping, but keep list items and blank-line paragraphs."""
    out: list[str] = []
    for line in lines:
        line = line.strip()
        if not line:
            if out and out[-1]:
                out.append("")
        elif out and out[-1] and not line.startswith(("- ", "• ")):
            out[-1] += " " + line
        else:
            out.append(line)
    return "\n".join(out).strip()


def _chunks(section: str, body: str) -> list[str]:
    if len(body) <= MAX_PASSAGE_CHARS:
        return [body]
    parts, current = [], ""
    for para in re.split(r"\n(?=- )|\n\n|(?<=\.) (?=[A-Z])", body):
        if current and len(current) + len(para) > MAX_PASSAGE_CHARS:
            parts.append(current)
            current = ""
        current = f"{current} {para}".strip() if current else para
    return [*parts, current] if current else parts


def split_bluebook(file_bytes: bytes, mime_type: str) -> list[dict[str, Any]]:
    """API_SPEC §7.2: ``[{"text", "section", "page"}, ...]`` in reading order.

    One passage per numbered section ("3.1 Documents you need"), split further if it is long. The
    section title starts each passage's text, which helps search a lot. Text before the first heading
    (title page) is dropped.
    """
    sections: list[tuple[str, int, list[str]]] = []
    for number, page_lines in enumerate(_pages(file_bytes, mime_type), start=1):
        for raw, is_heading in page_lines:
            if is_heading:
                sections.append((raw.strip(), number, []))
            elif sections:
                sections[-1][2].append(raw)
    passages = []
    for title, page, lines in sections:
        body = _join_lines(lines)
        if not body:
            continue
        passages += [{"text": f"{title}\n{chunk}", "section": title, "page": page} for chunk in _chunks(title, body)]
    return passages


# ------------------------------------------------------------------ embed


def _unit(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [v / norm for v in vector]


def embed(texts: list[str], *, task: str = "document") -> list[list[float]]:
    """API_SPEC §7.2: one unit-length vector (EMBED_DIM) per text, same order.

    ``task`` is "document" for passages and "query" for questions (the model embeds them slightly
    differently). Raises AIUnavailableError if the embedding service fails; the backend then searches
    by keyword only.
    """
    if not texts:
        return []
    _load_env()
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise AIUnavailableError("google-genai is not installed") from exc
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise AIUnavailableError("GEMINI_API_KEY not set")
    client = genai.Client(api_key=key, http_options=types.HttpOptions(
        api_version="v1beta", timeout=20_000, retry_options=types.HttpRetryOptions(attempts=2)))
    config = types.EmbedContentConfig(output_dimensionality=EMBED_DIM,
                                      task_type="RETRIEVAL_QUERY" if task == "query" else "RETRIEVAL_DOCUMENT")
    vectors: list[list[float]] = []
    try:
        for start in range(0, len(texts), EMBED_BATCH):
            batch = texts[start:start + EMBED_BATCH]
            reply = client.models.embed_content(model=EMBED_MODEL, contents=batch, config=config)
            if len(reply.embeddings or []) != len(batch):
                raise AIUnavailableError("embedding count mismatch")
            vectors += [_unit(list(e.values or [])) for e in reply.embeddings]
    except AIUnavailableError:
        raise
    except Exception as exc:
        raise AIUnavailableError(f"embedding failed: {type(exc).__name__} {str(exc)[:80]}") from exc
    return vectors


# ------------------------------------------------------------------ answer


@dataclass(frozen=True, slots=True)
class Model:
    provider: str  # "groq" | "gemini"
    name: str
    timeout: float


# Measured 2026-11-15: Groq gpt-oss-120b 0.7 s, qwen3.8-27b 0.1 s (JSON, Japanese OK). Groq free: ~1,000
# requests/day per model. Gemini Flash-Lite as the backup (20/day per model).
CHAIN: Final = (
    Model("groq", "openai/gpt-oss-120b", 8.0),
    Model("groq", "qwen/qwen3.8-27b", 6.0),
    Model("gemini", "gemini-3.1-flash-lite", 8.0),
)


@cache
def _prompt() -> str:
    return PROMPT_FILE.read_text(encoding="utf-8")


def _ask_groq(model: str, system: str, user: str, timeout: float) -> str:
    from openai import OpenAI

    key = os.environ.get("GROQ_API_KEY")
    if not key:
        raise AIUnavailableError("GROQ_API_KEY not set")
    client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=key, timeout=timeout, max_retries=0)
    reply = client.chat.completions.create(
        model=model, temperature=0, max_tokens=MAX_OUTPUT_TOKENS, response_format={"type": "json_object"},
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}])
    return reply.choices[0].message.content or ""


def _ask_gemini(model: str, system: str, user: str, timeout: float) -> str:
    from google import genai
    from google.genai import types

    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise AIUnavailableError("GEMINI_API_KEY not set")
    client = genai.Client(api_key=key, http_options=types.HttpOptions(
        api_version="v1beta", timeout=int(max(timeout, 10.0) * 1000), retry_options=types.HttpRetryOptions(attempts=1)))
    reply = client.models.generate_content(model=model, contents=user, config=types.GenerateContentConfig(
        system_instruction=system, response_mime_type="application/json", temperature=0, max_output_tokens=MAX_OUTPUT_TOKENS,
        thinking_config=types.ThinkingConfig(thinking_level="low")))
    return reply.text or ""


ASKERS: dict[str, Callable[[str, str, str, float], str]] = {"groq": _ask_groq, "gemini": _ask_gemini}
_POOL: Final = ThreadPoolExecutor(max_workers=8, thread_name_prefix="rag-model")


def _user_message(question: str, passages: list[dict[str, Any]], case_context: dict[str, Any],
                  history: list[dict[str, Any]], language: str) -> str:
    context = {k: case_context.get(k) for k in CASE_FIELDS if case_context.get(k) is not None}  # allow-list again
    blocks = [f'[{p["passage_id"]}] {p.get("section", "")} (page {p.get("page", "?")})\n{p["text"]}'
              for p in passages[:MAX_PASSAGES]]
    recent = [{"role": m.get("role"), "body": str(m.get("body", ""))[:1000]} for m in history[-MAX_HISTORY:]]
    return "\n\n".join([
        f"Requested language: {language}",
        "Case summary:\n" + json.dumps(context, ensure_ascii=False, default=str),
        "Bluebook passages (the victim's own bank):\n" + ("\n\n".join(blocks) or "(none)"),
        "Recent conversation:\n" + json.dumps(recent, ensure_ascii=False),
        f"Question:\n<<<\n{question[:1000]}\n>>>",
    ])


def _parse(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`").removeprefix("json").strip()
    data = json.loads(text)
    if not isinstance(data, dict) or data.get("answer_type") not in ANSWER_TYPES:
        raise TypeError("answer_type missing or unknown")
    return data


def _trim_words(body: str, limit: int) -> str:
    words = body.split()
    if len(words) <= limit:
        return body.strip()
    cut = " ".join(words[:limit])
    end = max(cut.rfind(". "), cut.rfind("。"))
    return (cut[:end + 1] if end > len(cut) // 2 else cut + "…").strip()


def _result(answer_type: str, body: str, used: list[str], confidence: float, needs_staff: bool,
            model: str | None) -> dict[str, Any]:
    return {"answer_type": answer_type, "body": body, "used_passage_ids": used, "confidence": round(confidence, 3),
            "needs_staff": needs_staff, "model": model, "prompt_version": PROMPT_VERSION}


def finish(raw: dict[str, Any], passages: list[dict[str, Any]], language: str, model: str) -> dict[str, Any]:
    """Check the model's answer in code and turn it into the §7.2 result."""
    given = {str(p["passage_id"]): p for p in passages[:MAX_PASSAGES]}
    used = [str(i) for i in raw.get("used_passage_ids") or [] if str(i) in given]  # drop invented ids
    answer_type = raw["answer_type"]
    body = str(raw.get("body") or "").strip()
    if answer_type == "grounded" and not used:
        answer_type = "no_answer"  # a grounded answer with no real citation is treated as no answer (§7.2)
    if answer_type == "no_answer":
        # Fixed text: it promises a staff reply, and an uncited model guess must never reach the victim.
        return _result("no_answer", _text("no_answer", language), [], 0.0, True, model)
    if answer_type == "refused":
        return _result("refused", body or _text("refused", language), [], 0.0, False, model)
    disclaimer = _text("disclaimer", language)
    body = _trim_words(body.replace(disclaimer, "").strip(), MAX_BODY_WORDS)
    best = max(float(given[i].get("score") or 0.0) for i in used)
    return _result("grounded", f"{body} {disclaimer}", used, min(1.0, 0.3 + 0.7 * max(0.0, best)), False, model)


def answer(question: str, passages: list[dict[str, Any]], case_context: dict[str, Any],
           history: list[dict[str, Any]], language: str) -> dict[str, Any]:
    """API_SPEC §7.2. ``passages`` are already limited to the case's bank by the backend.

    Returns {"answer_type", "body", "used_passage_ids", "confidence", "needs_staff", "model",
    "prompt_version"}. ``confidence`` comes from the search score of the cited passages; it is not an
    accuracy figure. Raises AIUnavailableError if no model answers (backend returns passages_only).
    """
    started = time.monotonic()
    if _WANTS_PERSON.search(question):
        return _result("no_answer", _text("staff", language), [], 0.0, True, None)
    if not passages:
        return _result("no_answer", _text("no_answer", language), [], 0.0, True, None)
    _load_env()
    system, user = _prompt(), _user_message(question, passages, case_context, history, language)
    errors: list[str] = []
    for model in CHAIN:
        if wait := ai_quota.seconds_left(model.name):  # rate-limited earlier: skip, don't spend budget
            errors.append(f"{model.name}: rate-limited, {int(wait)} s left")
            continue
        left = BUDGET_SECONDS - (time.monotonic() - started)
        if left < MIN_ATTEMPT_SECONDS:
            errors.append("time budget used up")
            break
        cap = min(model.timeout, left)
        try:
            raw = _parse(_POOL.submit(ASKERS[model.provider], model.name, system, user, cap).result(timeout=cap))
        except AIUnavailableError as exc:
            errors.append(f"{model.name}: {exc}")
            continue
        except Exception as exc:  # noqa: BLE001 - rate limit, overload, timeout, bad JSON: next model
            ai_quota.note_failure(model.name, str(exc))
            errors.append(f"{model.name}: {type(exc).__name__} {str(exc)[:60]}".rstrip())
            continue
        return finish(raw, passages, language, model.name)
    raise AIUnavailableError("; ".join(errors) or "no model configured")
