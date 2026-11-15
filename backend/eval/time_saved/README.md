# Time saved per case (judge question 4)

Backend-plan §6: *"Time one case entered by hand against one entered with AI extraction, and quote only those timings, with the number of cases timed."* This needs a person; `timer.py` only records the times.

**Use English documents** unless the person timing reads and types Japanese: decoding katakana would make the "by hand" time unrealistically slow and inflate the saving. `documents/` holds three extra English receipts (answers in `documents/answers.json`), so each half gets a matching mix.

| Half | Documents |
| :--- | :--- |
| By hand | `documents/e01_receipt.png`, `documents/e02_receipt.png`, `../extraction/documents/h04_victim_report_typos.txt` |
| With AI review | `documents/e03_receipt.png`, `../extraction/documents/t02_netbank.pdf`, `../extraction/documents/t04_victim_report.txt` |

## By hand (can be done now)

For each document: open it, then type into Notepad the fields the case form needs, one per line: amount (digits only), currency, transfer date (YYYY-MM-DD), account number, account holder name; for the victim report also the victim's name, phone, email and the scam type.

```
cd backend
uv run python eval/time_saved/timer.py manual e01_receipt
uv run python eval/time_saved/timer.py manual e02_receipt
uv run python eval/time_saved/timer.py manual h04_victim_report_typos
```

Press Enter to start, type the fields, press Enter to stop.

## With AI review (needs the deployed app)

In the app: upload the document to a case, run extraction, check each suggested field against the document and accept or correct it. Start the timer when you click "extract" and stop it when the case is saved.

```
uv run python eval/time_saved/timer.py ai e03_receipt
uv run python eval/time_saved/timer.py ai t02_netbank
uv run python eval/time_saved/timer.py ai t04_victim_report
```

## Result

`uv run python eval/time_saved/timer.py report`. The times are kept in `timings.csv`; commit it. Say it as counts: *"Median 95 s by hand vs 30 s with AI review, 3 documents each"*, never as a general percentage. Note that the "by hand" half was typed into a text editor, not the case form.
