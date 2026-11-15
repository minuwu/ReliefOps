"""Pre-demo check for the AI features (owner: Galib). Uses no model quota.

    cd backend && uv run python scripts/ai_check.py

Checks: the three API keys work (by listing models, which is free), the expected models are offered,
Tesseract with Japanese is installed, the prompt files exist, and every seed document has a replay
recording for the current prompt. Exit code 1 if anything needed for the demo is missing.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.services import ai_extraction, rag  # noqa: E402

ok = True


def report(name: str, good: bool, detail: str = "", *, required: bool = True) -> None:
    global ok
    ok &= good or not required
    print(f"[{'OK' if good else 'MISSING' if required else 'WARN'}] {name}{': ' + detail if detail else ''}")


def models(url: str, headers: dict[str, str]) -> set[str]:
    req = urllib.request.Request(url, headers={"User-Agent": "reliefops-ai-check/1.0", **headers})
    with urllib.request.urlopen(req, timeout=15) as reply:
        data = json.load(reply)
    if "models" in data:  # Gemini: "name" is "models/<id>"
        return {str(m["name"]).removeprefix("models/") for m in data["models"]}
    return {str(m["id"]) for m in data.get("data", [])}  # OpenAI-style (Groq, OpenRouter): "name" is a label


def check_key(name: str, var: str, url: str, header: str, wanted: list[str], *, required: bool) -> None:
    key = os.environ.get(var, "").strip()
    if not key:
        report(name, False, f"{var} is empty", required=required)
        return
    try:
        offered = models(url, {header: key if header != "Authorization" else f"Bearer {key}"})
    except Exception as exc:  # noqa: BLE001
        report(name, False, f"key rejected or service unreachable ({type(exc).__name__})", required=required)
        return
    missing = [m for m in wanted if m not in offered]
    report(name, not missing, "missing models: " + ", ".join(missing) if missing else "key works", required=required)


def main() -> int:
    ai_extraction._load_env()
    gemini_models = sorted({p.model for p in ai_extraction.CHAIN if p.name == "gemini"}
                           | {m.name for m in rag.CHAIN if m.provider == "gemini"} | {rag.EMBED_MODEL})
    check_key("Gemini", "GEMINI_API_KEY", "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
              "x-goog-api-key", gemini_models, required=True)
    check_key("Groq", "GROQ_API_KEY", "https://api.groq.com/openai/v1/models", "Authorization",
              [m.name for m in rag.CHAIN if m.provider == "groq"], required=False)
    check_key("OpenRouter", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1/models", "Authorization",
              [p.model for p in ai_extraction.CHAIN if p.name == "openrouter"], required=False)

    tesseract = os.environ.get("TESSERACT_CMD") or shutil.which("tesseract")
    langs = ""
    if tesseract:
        try:
            langs = subprocess.run([tesseract, "--list-langs"], capture_output=True, text=True, timeout=10).stdout
        except OSError:
            langs = ""
    has_jpn = "jpn" in langs.split()
    report("Tesseract OCR with Japanese", has_jpn,
           "" if has_jpn else "without it AI fields can't be verified and stay in the review lane", required=False)

    for prompt in (ai_extraction.PROMPT_FILE, rag.PROMPT_FILE):
        report(f"prompt {prompt.name}", prompt.exists())

    labels = json.loads((BACKEND / "eval" / "extraction" / "labels.json").read_text(encoding="utf-8"))
    docs = BACKEND / "eval" / "extraction" / "documents"
    uncached = [d["id"] for d in labels if not ai_extraction.cached_result((docs / d["file"]).read_bytes())]
    report(f"replay recordings for {len(labels)} seed documents", not uncached,
           "run scripts/record_ai_cache.py for: " + ", ".join(uncached) if uncached else f"prompt {ai_extraction.PROMPT_VERSION}")
    passages = BACKEND / "seed_data" / "bluebooks" / "kb_passages.json"
    report("bluebook passages with vectors", passages.exists())
    print("\nREADY for the demo" if ok else "\nNOT READY: fix the MISSING items above")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
