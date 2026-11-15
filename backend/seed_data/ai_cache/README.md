# AI demo replay cache

Real extraction results for the 12 synthetic seed documents (`eval/extraction/documents/`), recorded with `scripts/record_ai_cache.py`. Owner: Galib.

**When it is used:** only when every live provider fails (free-tier quota, overload, no Wi-Fi). Live models always go first. A replayed result says `model: "cached:<model>"`, so the review screen and the audit trail show it is a replay, not a live call. Files that aren't in the cache, even one byte different, never match, and recordings made with an older prompt version are ignored.

**Recorded 2026-11-15, prompt `extract-v2`:** 12 of 12 documents; checked against the hand-written answers with the eval's comparison: every recorded value matches, no extra fields.

## Before the demo

```
cd backend
uv run python scripts/ai_check.py          # keys, models, Tesseract, prompts, recordings; uses no quota
uv run python scripts/record_ai_cache.py   # only if ai_check says recordings are missing
```

Gemini's free tier allows 20 requests per day **per model**; the extraction chain uses four Gemini models plus OpenRouter. Don't re-run evals on demo day: they spend that quota.
