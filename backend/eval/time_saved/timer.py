"""Stopwatch for the "time saved per case" measurement (backend-plan §6, judge question 4).

A person enters the fields of one document into a case, once by hand and once by checking the AI's
suggestions, and this records how long each took. Only quote numbers this file produced.

    cd backend
    python eval/time_saved/timer.py manual t01_atm_clean     # Enter to start, Enter to stop
    python eval/time_saved/timer.py ai h01_atm_other_layout
    python eval/time_saved/timer.py report
"""

from __future__ import annotations

import csv
import statistics
import sys
import time
from datetime import datetime
from pathlib import Path

RESULTS = Path(__file__).resolve().parent / "timings.csv"


def record(mode: str, document: str) -> None:
    input(f"[{mode}] {document}: press Enter when you START entering the fields...")
    started = time.monotonic()
    input("Press Enter when every field is entered and saved...")
    seconds = round(time.monotonic() - started, 1)
    new = not RESULTS.exists()
    with RESULTS.open("a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if new:
            writer.writerow(["recorded_at", "mode", "document", "seconds"])
        writer.writerow([datetime.now().isoformat(timespec="seconds"), mode, document, seconds])
    print(f"Saved: {mode} {document} {seconds} s")


def report() -> None:
    if not RESULTS.exists():
        print("No timings yet.")
        return
    rows = list(csv.DictReader(RESULTS.open(encoding="utf-8")))
    for mode in ("manual", "ai"):
        times = [float(r["seconds"]) for r in rows if r["mode"] == mode]
        if times:
            print(f"{mode:6}: {len(times)} cases, median {statistics.median(times):.0f} s "
                  f"(min {min(times):.0f}, max {max(times):.0f})")
    manual = [float(r["seconds"]) for r in rows if r["mode"] == "manual"]
    ai = [float(r["seconds"]) for r in rows if r["mode"] == "ai"]
    if manual and ai:
        saved = statistics.median(manual) - statistics.median(ai)
        print(f"Median time saved per document: {saved:.0f} s "
              f"({len(manual)} manual vs {len(ai)} AI-assisted cases timed; small sample, quote the counts)")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "report":
        report()
    elif len(sys.argv) == 3 and sys.argv[1] in ("manual", "ai"):
        record(sys.argv[1], sys.argv[2])
    else:
        print(__doc__)
        sys.exit(2)
