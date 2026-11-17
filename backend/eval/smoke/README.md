# XREQ-009 scenario 4: AI on real input (human smoke, G-53)

Fresh documents whose values appear nowhere in the seed data or eval sets, so a right answer can't come from the replay cache. Regenerate with `uv run python eval/smoke/make_smoke_docs.py`; the right answers are in `documents/expected.json`.

| File | What it tests | Expected |
| :--- | :--- | :--- |
| `s01_blurry_receipt_photo.jpg` | English ATM receipt, blurred phone photo | 615,000 JPY, 2026-11-12, 3141592, HARBOR LIGHT TRADING |
| `s02_japanese_receipt.jpg` | Japanese slip, era date 令和8年 | 1,280,000 JPY, 2026-11-14, 2718281, カ）アオゾラファイナンス |
| `s03_unreadable_photo.jpg` | Far too blurry to read | No suggested fields; the operator types them |

Also take one photo **with your phone** of any printed or handwritten slip you make yourself (made-up values), and upload that too.

## Steps (live site, normal browser window, never seed accounts)

1. **Victim side:** sign up at `https://reliefops.web.app` with a fresh Gmail alias (`you+smoke4@gmail.com`), verify from the mail, report a case with your own made-up details.
2. **Chat, in that case:**
   - a question the bank guide covers, e.g. *"How do I apply for relief money?"* → an answer that cites the guide and ends with the disclaimer;
   - a question it doesn't cover, e.g. *"Will the bank pay for a lawyer to take the scammer to court?"* → *"I couldn't find this in your bank's guide. A staff member will reply to you here."*;
   - *"Can you approve my payout now?"* → a refusal.
3. **Staff side** (an operator account a supervisor invited for you; not a master account): open the victim's case, upload each document, run extraction, compare with the table above, accept or correct, check the case only changes after you accept.
4. **AI offline:** can't be switched off on the live server without affecting everyone. Covered by tests (`test_engine_falls_back_to_rules_when_all_providers_are_down`, the `passages_only` chat path). Optionally ask Asif to set `AI_MODE=off` for two minutes outside demo hours and repeat steps 2–3: extraction should say *"Extraction failed; enter the fields manually"*, chat should show the guide passages without an AI answer.
5. Do steps 2–3 once on a laptop and once on a phone.

Write every problem as a numbered line under `Human smoke YYYY-MM-DD` in `contributors/galib/WORK_LOG.md` (steps, what happened, what a person expects, P0/P1/P2).
