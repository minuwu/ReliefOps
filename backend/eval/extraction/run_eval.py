"""Field-level accuracy of ai_extraction.extract_fields on the labelled synthetic documents (backend-plan §6).

Calls the real providers (uses free-tier quota: one call per document, more if one fails over).

    cd backend && python eval/extraction/run_eval.py --split tuning     # while adjusting the prompt
    cd backend && python eval/extraction/run_eval.py --split heldout    # the headline number; never tune on it

Reports counts, not just percentages: 12 documents is a small sample. Writes the report and the raw
output to eval/extraction/results/. Only numbers this script produced may be quoted.
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
import time
import unicodedata
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1]))  # backend/

from app.services import ai_extraction
from app.services.ai_errors import AIUnavailableError
from app.services.extraction_engine import DEFAULT_THRESHOLD


def same(expected: Any, got: Any) -> bool:
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        return isinstance(got, (int, float)) and float(got) == float(expected)

    def norm(v: Any) -> str:
        return re.sub(r"\s+", "", unicodedata.normalize("NFKC", str(v))).lower()

    return norm(expected) == norm(got)


def run(split: str, pause: float, only: str | None = None) -> int:
    labels = [x for x in json.loads((HERE / "labels.json").read_text(encoding="utf-8"))
              if split in ("all", x["split"]) and only in (None, x["id"])]
    if only:
        split = f"{split}-{only}-retry"
    per_field: dict[str, Counter[str]] = {}
    rows, failures, raw = [], [], []
    times: list[float] = []
    models: Counter[str] = Counter()
    lanes: Counter[str] = Counter()
    spurious = injection_ok = injection_total = 0

    for i, doc in enumerate(labels):
        if i:
            time.sleep(pause)  # stay under free-tier requests-per-minute limits
        data = (HERE / "documents" / doc["file"]).read_bytes()
        started = time.monotonic()
        try:
            result = ai_extraction.extract_fields(data, doc["mime_type"], doc["doc_type"])
            error = None
        except AIUnavailableError as exc:
            result, error = {"fields": [], "model": None}, str(exc)
        took = time.monotonic() - started
        times.append(took)
        got = {f["name"]: f for f in result["fields"]}
        raw.append({"id": doc["id"], "seconds": round(took, 2), "error": error, **result})
        models[result["model"] or "none (all providers failed)"] += 1
        lane = ("failed" if not got else
                "standard" if min(f["confidence"] for f in got.values()) >= DEFAULT_THRESHOLD else "low_confidence")
        lanes[lane] += 1

        right = 0
        for name, want in doc["expected"].items():
            counter = per_field.setdefault(name, Counter())
            field = got.get(name)
            if field is None:
                counter["missing"] += 1
                failures.append(f"{doc['id']}: {name} missing (expected {want!r})")
            elif same(want, field["value"]):
                counter["correct"] += 1
                right += 1
            else:
                counter["wrong"] += 1
                failures.append(f"{doc['id']}: {name} = {field['value']!r}, expected {want!r} "
                                f"(conf {field['confidence']}, evidence {field['evidence']!r})")
        for name in set(got) - set(doc["expected"]):
            spurious += 1
            failures.append(f"{doc['id']}: extra field {name} = {got[name]['value']!r} (not in the document's answer)")
        for name, bad in doc.get("injected", {}).items():
            injection_total += 1
            trusted = name in got and same(bad, got[name]["value"]) and got[name]["confidence"] >= DEFAULT_THRESHOLD
            injection_ok += not trusted
            if trusted:
                failures.append(f"{doc['id']}: INJECTION ACCEPTED: {name} = {bad} at confidence {got[name]['confidence']}")
        rows.append(f"| {doc['id']} | {right}/{len(doc['expected'])} | {lane} | {result['model'] or '-'} | {took:.1f} s |"
                    f" {error or doc['note']} |")
        print(f"{doc['id']}: {right}/{len(doc['expected'])} {lane} {took:.1f}s {result['model'] or error}", flush=True)

    total = sum(sum(c.values()) for c in per_field.values())
    correct = sum(c["correct"] for c in per_field.values())
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    lines = [
        f"# Extraction eval: {split} set ({stamp})", "",
        (f"**{correct} of {total} expected fields correct** across {len(labels)} documents "
        f"({correct / total:.0%}; small sample, quote the counts). Extra fields not in the answer: {spurious}."),
        (f"Prompt `{ai_extraction.PROMPT_VERSION}`. Time per document: median {statistics.median(times):.1f} s, "
        f"max {max(times):.1f} s. Models used: {dict(models)}. Lanes: {dict(lanes)}."),
    ]
    if injection_total:
        lines.append(f"Prompt injection: {injection_ok} of {injection_total} injected values were not trusted.")
    lines += ["", "| Field | Correct | Wrong | Missing |", "| :--- | ---: | ---: | ---: |"]
    lines += [f"| {n} | {c['correct']} | {c['wrong']} | {c['missing']} |" for n, c in sorted(per_field.items())]
    lines += ["", "| Document | Fields | Lane | Model | Time | Note |", "| :--- | :---: | :--- | :--- | ---: | :--- |", *rows]
    lines += ["", "## Failures (real examples)", "", *([f"- {f}" for f in failures] or ["- none"]), ""]

    out = HERE / "results"
    out.mkdir(exist_ok=True)
    (out / f"{stamp}_{split}.md").write_text("\n".join(lines), encoding="utf-8")
    (out / f"{stamp}_{split}.json").write_text(json.dumps(raw, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--split", choices=["tuning", "heldout", "all"], default="tuning")
    parser.add_argument("--only", help="one document id, e.g. to retry after a quota failure (report separately)")
    parser.add_argument("--pause", type=float, default=5.0, help="seconds between documents (free-tier RPM)")
    args = parser.parse_args()
    sys.exit(run(args.split, args.pause, args.only))
