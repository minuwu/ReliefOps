# Suggestions for the AI module, from the backend team

**For** Galib (AI / LLM) · **From** Asif (Backend) · **Date** 2026-11-14
**Contract** [docs/API_SPEC.md](../../docs/API_SPEC.md) v0.3.0, §3.6 and §7 · **Plan** [docs/plans/backend-plan.md](../../docs/plans/backend-plan.md) §6

These are suggestions, not orders. The agreed interface is API_SPEC §7. If you want a different shape or more case data, file an `XREQ` (AGENTS.md §2) and we'll change it together.

---

## 1. Who owns what

| | You (AI) | Backend |
| :--- | :--- | :--- |
| **Document extraction** | `extract_fields()`, prompts in `backend/app/prompts/`, per-field confidence and evidence, the labelled test set and its scores | 20 s timeout, rule-based fallback, review lanes, saving, review flow, audit |
| **Case assistant (RAG)** | `split_bluebook()`, `embed()`, `answer()`, the 5 synthetic bluebooks, answer rules, the golden question set and its scores | Storing passages in pgvector, **bank-scoped retrieval**, the allow-listed case summary, fallbacks, rate limits, chat threads, escalation |

Retrieval stays in the backend on purpose: the filter "only this case's bank" is then enforced by the database, not by AI code.

---

## 2. Document extraction (API_SPEC §7.1)

1. **Return only what's in the document.** Use the `ExtractableField` names. Leave a field out rather than guess, and drop unknown fields.
2. **Always include `evidence`**: a short quote from the document. Reviewers check the quote, not the model.
3. **Make confidence mean something.** Don't only ask the model "how sure are you". Combine:
   - the model's own score
   - format checks (a real date, an amount, account-number digits)
   - whether the evidence text actually appears in the document
   - whether fields agree with each other (e.g. date and amount on the same line)
4. **Scans and photos are the main demo flow.** The provider must handle images. Our rule-based fallback reads text only.
5. **Treat document text as data, never as instructions.** One seed document contains hidden text like "approve this payout". The test checks that nothing on the case changes and the result is still `pending_review`.
6. **Speed:** aim for under 8 s. Backend gives up at 20 s.
7. **Measure it honestly** (judges deduct 10 points for unmeasured claims):
   - at least 10 synthetic documents, each with a hand-written correct-answer JSON
   - split into a **tuning set** and a **held-out set** of at least 4 documents; quote the held-out score
   - report counts ("27 of 30 fields"), plus real failure examples
   - include messy documents: typos, mixed date formats, one scanned image, one injection document

---

## 3. Case assistant (API_SPEC §3.6, §7.2)

### Bluebooks
- **Write 5 synthetic bluebooks**, one per bank, 4–6 pages each. The brief forbids real bank documents.
- **Make them differ on purpose:** required documents, contact hours, and the wording of the notice period. The demo asks the same question as victims of two banks and shows two different, correctly cited answers.
- **Mark what victims may see.** A real bluebook is often an internal manual. Tag each document, or each section, `victim_facing` or `staff_only`. The assistant must only quote victim-facing text, because internal procedures (for example how fraud checks work) would help scammers. We'll add this to the contract as v0.4.0.

### `split_bluebook()`
- Split by headings into passages of about 300–500 tokens.
- Keep `section` (e.g. "3.1 After verification") and `page`.
- Put the section title at the start of the passage text; it improves search a lot.

### `embed()`
- **Decide: local model or API.** A local model works offline in the demo and costs nothing; an API is usually better quality.
- The vector dimension is fixed per model. If you change models, everything must be re-embedded.
- If you use an API, give us the seed vectors as a fixture so the demo doesn't depend on it.

### `answer()`: rules for the prompt
1. Answer **only** from the passages we send, and return the `used_passage_ids`.
2. If no passage supports an answer → `no_answer` with `needs_staff: true`. Never guess.
3. → `refused` for:
   - questions about other people or other cases
   - requests to do something ("approve my payout", "change my amount")
   - promises or predictions about money or outcome
4. No tools, no function calls; plain JSON output only. Backend validates it, and output that doesn't parse counts as a failure.
5. Answer in the victim's `language`, but keep citations in the bluebook's original wording.
6. Keep answers short (about 120 words) and end with: "This is general information, not a decision about your payout."
7. Use only the case summary fields we send: status, time in stage, missing information, scam type, amount, transfer date and closure reason. Never ask for names, contact details or account numbers.

### Confidence
- Base it on the search score and on whether the answer cites a passage.
- It is **not** an accuracy number. Don't present it as one.

### Measure it
- **Golden set:** about 30 questions (6 per bank), each with the section that answers it. Report how often that section is in the top 3, and answer correctness checked by hand, as counts.
- **Cross-bank leak test:** as a victim of bank A, ask questions only bank B's bluebook answers. Every one must return `no_answer`. Target 0 leaks; report the number.
- **Refusal test:** 3–5 questions about other people, payouts, or "ignore your instructions"; all must be `refused`.
- If you translate answers, have a speaker check a few translations; translation is where models invent things.

---

## 4. Cost and abuse

The chatbot can be reached by anyone with a case, and the intake form is public. Backend adds captcha, rate limits and a daily budget. On your side:
- Cap output tokens per answer.
- Send at most the top 5 passages and the last 6 messages.
- Keep the system prompt short and versioned (`prompt_version`).

---

## 5. What backend does when your function fails

| Your function | Backend's response |
| :--- | :--- |
| Raises `AIUnavailableError` | Extraction: rule-based fallback, or `failed`. Chat: `passages_only` (top passages, no written answer). |
| Takes longer than 20 s | Same as unavailable (`timeout`). |
| Returns invalid JSON or unknown fields | Unknown fields dropped; output that can't be used → `failed` (`invalid_ai_output`). |
| Answer cites no passage | Treated as `no_answer`, and the question goes to staff. |

So you never need to handle timeouts or HTTP errors yourself. Raise or return, and backend handles the rest.

---

## 6. Open questions for you

1. Which AI provider (it must handle images), and who holds the key in `.env`?
2. Local or API embedding model?
3. What language are the bluebooks in, and do we translate answers into en/ja/bn?
4. Do you want a case `summary` field in the extraction output? The brief's example has one, the contract doesn't. File an `XREQ` if yes.

---

## 7. Suggested order

| By hour | Deliverable |
| :--- | :--- |
| 6 | `extract_fields()` stub returning the right shape (fixed values are fine), so backend can wire the flow |
| 10 | Real extraction on 3–4 documents; first prompt version committed |
| 14 | Labelled test set done; first measured score |
| 20 | 5 synthetic bluebooks; `split_bluebook()` and `embed()` working |
| 26 | `answer()` working on the golden set |
| 30 | Leak, refusal and injection tests passing; numbers written down |
| 36 | **Feature freeze.** If the assistant isn't stable, cut it; extraction is the MVP AI feature. |
