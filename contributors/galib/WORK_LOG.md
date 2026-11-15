# Galib's Work Log

Owner: Galib (`Ga-lib`) — Role: AI / LLM — Branches: `galib/*`

Update after each work session. Newest entry first. Bangladesh time (UTC+6). Link commits/PRs/XREQs.

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
