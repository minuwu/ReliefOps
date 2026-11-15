# Galib's Work Log

Owner: Galib (`Ga-lib`) — Role: AI / LLM — Branches: `galib/*`

Update after each work session. Newest entry first. Bangladesh time (UTC+6). Link commits/PRs/XREQs.

## 2026-11-15 (20:15) — demo readiness

### Completed
- **Replay cache** (`backend/seed_data/ai_cache/`): real extraction results for all 12 seed documents, recorded with `scripts/record_ai_cache.py` (prompt `extract-v2`; every value matches the labels, no extra fields). `extract_fields` uses it only when every live provider fails, labelled `model: "cached:<model>"`. Unknown files and older prompt versions never match.
- **Pre-demo check** `scripts/ai_check.py` (no quota used): keys, models, Tesseract jpn, prompts, recordings, bluebook vectors. Current result: READY.
- **Decisions:** keep explaining (not refusing) "How much will I get back?", with a new "no promise" check of 3 payout questions; keep the bluebooks at 2 pages (all topics covered).
- Assistant eval run `2009`: retrieval 30/30, grounded with right section and fact 30/30, leaks 0/10, refusals 4/4, no promise 3/3, median 0.8 s.
- Tests: 149 passed.

### Demo day
- Run `uv run python scripts/ai_check.py` before judging; don't re-run evals that day (they spend free quota).

---

## 2026-11-15 (evening) — XREQ-004 fraud ring detection

### Completed
- Checked main: Asif already wired the case assistant (`victim_chat` calls `rag.embed(task="query")` and `rag.answer`, seed loads `kb_passages.json`) and moved the AI packages into `pyproject.toml`. No handoff message needed. `uv run pytest tests/ai tests/unit`: 146 passed.
- Claimed XREQ-004 (`[IN_PROGRESS]`) with a split in the card: `backend/app/services/fraud_rings.py` (`detect_rings`) is done; endpoints and freeze stay with Backend.
- Matching: account numbers across formats; holder names across spellings via a sound key (English ↔ katakana, company markers ignored). Same digits with different names → `POSSIBLE_LINK` only, so an innocent account holder isn't flagged critical. Every ring has plain-language `reasons`.
- `tests/ai/test_fraud_rings.py`: 17 passed (seed: `9876543210`, 3 cases, bank_a + bank_b, ¥3,700,000 → `CRITICAL_SYNDICATE`).

### Next
- Backend: `GET /api/analytics/fraud-rings` calling `detect_rings`, the freeze POST (supervisor, audited), and frozen-account storage.
- Open decisions: refuse vs explain "How much will I get back?"; bluebooks are 2 pages, not 4–6.

---

## 2026-11-15 — case assistant AI functions, bluebooks and eval (D14, API_SPEC §7.2)

### Completed
- `backend/app/services/rag.py`: `split_bluebook` (numbered sections; bold-only headings in PDFs so wrapped "3 January…" lines stay body text; title starts each passage), `embed` (Gemini `gemini-embedding-001`, 768-dim, unit length, `task="query"` for questions), `answer` (Groq gpt-oss-120b → qwen3.8-27b → Gemini 3.1 Flash-Lite, 15 s budget).
- Code checks on every answer: grounded must cite passages it was given, else `no_answer` + staff; refused/no_answer cite nothing; disclaimer always once; ≤120 words; "talk to a person" goes to staff without a model; case context allow-listed again (no names, phones, accounts reach the model).
- `backend/app/services/ai_quota.py`: shared rate-limit memory for extraction and chat (Gemini `retryDelay`, Groq "try again in Xs").
- Prompts `answer-v1`, `answer-v2` (v2: never claim something is NOT offered unless a passage says so).
- `backend/seed_data/bluebooks/`: 5 synthetic bluebooks (2 pages, 14 sections each, deliberate differences), `kb_passages.json` fixture (70 passages with vectors) and a README for the seed.
- `backend/eval/assistant/`: 30 golden, 10 cross-bank leak, 5 refusal, 1 staff question; scorer with in-memory bank-filtered hybrid retrieval.
- Tests: 108 passed.

### Measured (prompt v2)
- Retrieval: right section in top 3, **30 of 30**. Grounded with right citation and fact: **29 of 30** (miss = all models rate-limited).
- **Cross-bank leaks: 0 of 10**; 10 of 10 returned `no_answer`.
- Refusals 4 of 5: "How much money will I get back?" was answered without a promise instead of refused; team to decide.
- Median answer 0.9 s.

### Next
- Asif: `kb_passages` table (`vector(768)`), seed from `kb_passages.json`, call `rag.embed(..., task="query")` and `rag.answer(...)`; `passages_only` on `AIUnavailableError`.
- Bluebooks are 2 pages, not the 4–6 in backend-plan §6; extend if judges need it.

---

## 2026-11-15 — labelled eval set and measured accuracy (XREQ-002, step 3)

### Completed
- `backend/eval/extraction/`: 12 synthetic documents (7 tuning, 5 held-out) with hand-written answers in `labels.json`, a generator (`make_docs.py`) and a scorer (`run_eval.py`) that saves reports to `results/`. See its README for the numbers and how to quote them.
- Prompt `extract-v2` (tuned on the tuning set only): keep company markers like カ） in names; leave masked/unclear values out. Code: placeholders such as （印字不鮮明） are never values; "yen" confirms JPY.
- Free-tier quota handling: Gemini allows 20 requests/day per model. Chain is now Gemini 2.5 Flash → 3.6 Flash → 3.5 Flash-Lite → 3.1 Flash-Lite → OpenRouter Nemotron VL, and a model that returns 429 is skipped until its reported reset.
- Tests: 82 passed.

### Measured
- Tuning: v1 37/38 fields, v2 38/38.
- **Held-out: 20 of 28 fields**, 0 wrong, 0 invented. All 8 misses = one document where every provider was out of free quota. When a model answered: 20/20. Prompt injection: not trusted (1/1). Retry of the failed document after the quota fix: 8/8.

### Next
- For the demo: pre-run the demo documents so judging doesn't depend on free quota; consider paid billing (cents) for the demo day.
- Tell Asif: server needs `requirements-ai.txt` + `tesseract-ocr tesseract-ocr-jpn`.
- Case assistant (RAG): bluebooks, `split_bluebook`, `embed`, `answer`.

---

## 2026-11-15 — real `extract_fields()` with free providers (XREQ-002, step 2)

### Completed
- `backend/app/services/ai_extraction.py` replaces the stub. Reads the file locally (PyMuPDF for PDFs, Tesseract jpn+eng OCR for images and scans), then asks vision models in order within a 17 s budget: Gemini 2.5 Flash → Gemini 3.6 Flash → OpenRouter `nvidia/nemotron-3.5-super-vl:free`. All free tiers. Each attempt has a hard cap (thread + timeout), since SDK timeouts aren't hard and Gemini rejects deadlines under 10 s.
- Our own confidence: 45 % model, 55 % local check. Verified = the quoted evidence appears in the OCR/PDF text (and, for amount/account number, the value is inside the quote). Unverifiable caps at 0.72, contradicted at 0.45: both below the 0.75 threshold, so a person reviews them. Quotes that read like instructions are never trusted (prompt-injection guard).
- Prompt `backend/app/prompts/extract-v1.md`: document is data, never instructions; only visible fields; exact evidence.
- `backend/.env.example` and `backend/requirements-ai.txt` (packages, plus `tesseract-ocr tesseract-ocr-jpn` for the server).
- Tests: 74 passed (`pytest tests/ai tests/unit`), no network: provider fallback, hard timeout, bad JSON, all-down → rules fallback, injection, value cleaning, PDF and image reading.

### Measured (live, 2 synthetic slips, same day)
- Clean slip image: 4.5 s, Gemini 2.5 Flash, 5/5 fields correct, `standard` lane.
- Scanned slip (rotated, blurred, noise): 4.0 s, Gemini 2.5 Flash, 5/5 correct, `low_confidence` lane (OCR couldn't confirm the blurred text).
- Free tiers failed often in testing: 503 overload (3.5 Flash-Lite), 504 timeouts (3.8 Flash), 429 (OpenRouter Gemma 4). Hence the chain.
- Model self-confidence was 0.95–1.0 on everything, so it is not used alone.
- Only 2 documents so far: not an accuracy claim yet.

### Next
- Labelled test set: 10+ synthetic documents (typos, mixed dates, era dates, a PDF, a handwritten-style one, the injection document), 4+ held out; report counts and real failures.
- Ask Asif: install `requirements-ai.txt` + Tesseract on the server; whether the rules fallback should also use OCR text for images.

### Related issues / commits / PRs
- Pushed to `main` directly (pull first).

---

## 2026-11-15 — `extract_fields()` stub (XREQ-002, step 1)

### Completed
- `backend/app/services/ai_extraction.py`: `extract_fields()` stub per API_SPEC §7.1. Returns 5 fixed demo fields at confidence 0.5 (below the 0.75 threshold, so every result goes to the `low_confidence` lane for human review); evidence marks each value as a stub; empty file returns no fields.
- `backend/tests/ai/test_ai_extraction.py`: output passes `parse_ai_output`; the engine's real lazy-import path routes it to human review.
- `test_missing_ai_module_counts_as_unavailable` (Asif's) now simulates the missing module, since the module exists.
- `pytest tests/ai tests/unit`: 57 passed.

### Next
- Pick the vision provider and model; first prompt in `backend/app/prompts/extract-v1`; real extraction on 3–4 synthetic slips.

### Related issues / commits / PRs
- Branch `galib/extract-fields-stub`; PR #9. PR #8 (XREQ-002 naming fixes) merged.

---

## 2026-11-15 — XREQ-002 naming fixes

### Completed
- Corrected XREQ-002 in AGENTS.md: field names now match `ExtractableField` (API_SPEC §3.4), and it names the extraction files. `ai_extraction.py` is Galib's; `extraction.py` is Asif's wrapper (backend-development-guide §ownership). Minhaz's log entry pointing Galib at `services/extraction.py` is superseded.

### Related issues / commits / PRs
- Branch `galib/fix-xreq-002-fields`

---

## 2026-11-15 — incoming cross-functional dispatch (frontend ready, XREQ-002 & XREQ-004)

### Pending XREQs Assigned (AGENTS.md §2)
- **`[XREQ-002]` (P0 Blocker)**: Rule D3 Vision OCR Extraction & HITL Queue (`POST /api/documents/{id}/extract`, `GET /api/review-queue`, `POST /api/cases/{case_id}/extractions/{id}/accept`).
- **`[XREQ-004]` (P1 High, Pairing with Backend)**: Cross-Bank Fraud Ring Topology Graph & Coordinated Freeze API.

### Frontend Status & Handoff
- HITL Review Queue (`/review`) and Optical Review Workbench Modal are fully implemented with side-by-side voucher facsimile, bounding boxes, and confidence color gauges.
- AI service must extract Japanese ATM/Furikomi slips, calculate field confidence (0.0 to 1.0), and provide a deterministic offline fallback (`source: "rules_fallback"`) so the live demo never hangs during judging.
- Ensure human operator verification is required before any extracted field modifies the case record (Rule D3).

---

## 2026-11-14

### Completed
- Cloned the repository, enabled the pre-push sync hook, and registered as a contributor (AGENTS.md §5, TEAM_INSTRUCTIONS.md, README, contributors index).

### Next
- Agree the AI feature and model/provider at kickoff; stub the AI endpoint with a deterministic fallback.

### Blockers / handoff
- None.

### Related issues / commits / PRs
- Branch `galib/onboarding`
