# Extraction eval: heldout-h04_victim_report_typos-retry set (2026-11-15_1439)

**8 of 8 expected fields correct** across 1 documents (100%; small sample, quote the counts). Extra fields not in the answer: 0.
Prompt `extract-v2`. Time per document: median 5.6 s, max 5.6 s. Models used: {'gemini-3.1-flash-lite': 1}. Lanes: {'standard': 1}.

| Field | Correct | Wrong | Missing |
| :--- | ---: | ---: | ---: |
| account_holder_name | 1 | 0 | 0 |
| account_number | 1 | 0 | 0 |
| amount | 1 | 0 | 0 |
| currency | 1 | 0 | 0 |
| scam_type | 1 | 0 | 0 |
| transfer_date | 1 | 0 | 0 |
| victim_name | 1 | 0 | 0 |
| victim_phone | 1 | 0 | 0 |

| Document | Fields | Lane | Model | Time | Note |
| :--- | :---: | :--- | :--- | ---: | :--- |
| h04_victim_report_typos | 8/8 | standard | gemini-3.1-flash-lite | 5.6 s | Informal English, typos, lowercase, international phone. |

## Failures (real examples)

- none
