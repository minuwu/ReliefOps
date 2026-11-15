# Extraction eval

Field-level accuracy of `app/services/ai_extraction.extract_fields` on 12 synthetic, hand-labelled documents (backend-plan §6). All banks, people and accounts are made up.

```
cd backend
python eval/extraction/make_docs.py                    # regenerate documents/ and labels.json (already committed)
python eval/extraction/run_eval.py --split tuning      # while changing the prompt
python eval/extraction/run_eval.py --split heldout     # the headline number: never tune on it
```

Each run calls the live free-tier providers and saves a report and the raw output in `results/`. **Quote only numbers from a saved report, as counts.** 12 documents is a small sample.

## Documents

| Set | Documents | What they test |
| :--- | :--- | :--- |
| Tuning (7) | `t01`–`t07` | Clean ATM slip, English text-layer PDF, scanned JPEG, victim report with typos, Reiwa era date with full-width digits, masked fields, handwriting-style form |
| Held-out (5) | `h01`–`h05` | Different slip layout, scanned image-only PDF, **prompt injection in faint small print**, informal victim report, phone photo |

## Results so far (2026-11-15, prompt `extract-v2`)

| Run | Result | Report |
| :--- | :--- | :--- |
| Tuning, prompt v1 | 37 of 38 fields; 1 extra field | `results/2026-11-15_1433_tuning.md` |
| Tuning, prompt v2 | 38 of 38 fields; 0 extra | `results/2026-11-15_1435_tuning.md` |
| **Held-out (headline)** | **20 of 28 fields**; 0 wrong, 0 extra. All 8 misses are one document where every provider was out of free quota (Gemini 429 ×2, OpenRouter timeout). On the 4 documents a model answered: 20 of 20. Injection: 1 of 1 not trusted. Median 9.8 s, max 15.3 s. | `results/2026-11-15_1436_heldout.md` |
| Held-out retry of that document (after adding more models and quota skipping; prompt unchanged) | 8 of 8, 5.6 s | `results/2026-11-15_1439_heldout-h04_victim_report_typos-retry.md` |

How to say it honestly: *"On 5 held-out documents the extractor got 20 of 28 fields; every miss was one document where all free providers were rate-limited. When a model answered, it got 20 of 20, with 0 invented fields, and it ignored the hidden injection."*

## Real failures seen

- Prompt v1 dropped the company marker カ） from a holder name, and copied the note （印字不鮮明） ("print unclear") as a name. Fixed in v2 (prompt) and in code (placeholders are never values).
- Free-tier quota: Gemini allows 20 requests per day **per model**. Gemini 2.5 Flash ran out during this eval. The chain now uses four Gemini models plus OpenRouter, and skips a used-up model until its reset.
- Blurred, scanned and handwriting-style documents land in `low_confidence`: OCR can't confirm the quoted evidence, so a person checks them. Correct values, but on purpose not auto-trusted.
