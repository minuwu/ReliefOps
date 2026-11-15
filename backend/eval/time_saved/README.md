# Time saved per case (judge question 4)

Backend-plan §6: *"Time one case entered by hand against one entered with AI extraction, and quote only those timings, with the number of cases timed."* This needs a person; `timer.py` only records the times.

## How to measure (about 10 minutes)

Use different documents for the two modes, so you don't remember the answers from the first round. Ideally a teammate who hasn't seen the documents does it.

1. **By hand (3 documents):** open the document (e.g. `eval/extraction/documents/t01_atm_clean.png`) and an empty case, type the amount, currency, date, account number and holder name.
   ```
   cd backend
   python eval/time_saved/timer.py manual t01_atm_clean
   python eval/time_saved/timer.py manual t05_reiwa_fullwidth
   python eval/time_saved/timer.py manual h02_scanned
   ```
2. **With AI (3 other documents):** in the app, run extraction on the document, then check each suggested field against the document in the review screen and accept or correct it.
   ```
   python eval/time_saved/timer.py ai h01_atm_other_layout
   python eval/time_saved/timer.py ai t03_scanned
   python eval/time_saved/timer.py ai h05_phone_photo
   ```
   Start the timer when you click "extract", stop it when the case is saved.
3. **Result:** `python eval/time_saved/timer.py report`. The times are kept in `timings.csv`; commit it.

Say it as counts: *"Median 95 s by hand vs 30 s with AI review, 3 cases each"*, never as a general percentage.
