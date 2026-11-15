# Synthetic bluebooks (case assistant, D14)

Five invented, victim-facing fraud relief guides, one per demo bank. Not real bank documents (the brief forbids those). Owner: Galib.

| File | What |
| :--- | :--- |
| `bank_a_bluebook.pdf` … `bank_e_bluebook.pdf` | The bluebooks (14 numbered sections each). Upload with `audience=victim_facing`, `language=en`, `version=2026.1`. |
| `bluebooks.json` | Title, version, language and audience per bank. |
| `kb_passages.json` | **Seed fixture:** 70 passages, already split (`rag.split_bluebook`) and embedded (`rag.embed`), so seeding and the demo never call the embedding service. |
| `make_bluebooks.py`, `build_index.py` | Regenerate the PDFs and the fixture. |

The banks differ on purpose (required documents, contact hours, notice-period wording, payment timing, review window, one unique service each), so the demo can ask two banks the same question and get two different, correctly cited answers.

## For the backend seed (Asif / Anim)

Each row of `kb_passages.json`:

```json
{"passage_id": "bank_b-03", "bank_id": "bank_b", "file": "bank_b_bluebook.pdf",
 "document_title": "Birch Regional Bank — Fraud Relief Bluebook", "version": "2026.1",
 "text": "3.1 Documents you need\n...", "section": "3.1 Documents you need", "page": 1,
 "embedding_model": "gemini-embedding-001", "embedding": [768 floats, unit length]}
```

- `kb_passages.embedding` is `vector(768)`. Vectors are unit length, so cosine distance (`<=>`) works directly.
- Embed questions with `rag.embed([question], task="query")` (same model and size). If it raises `AIUnavailableError`, search by keyword only.
- Pass the top 5 passages to `rag.answer(...)` as `{"passage_id", "text", "section", "page", "score"}` with `score` in 0–1 (the eval uses 0.7 × cosine + 0.3 × keyword overlap).
