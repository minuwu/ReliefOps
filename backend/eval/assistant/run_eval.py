"""Case assistant eval (backend-plan §6): golden set, cross-bank leak test, refusal test.

    cd backend && python eval/assistant/run_eval.py

Retrieval here is an in-memory copy of what the backend does in Postgres: filter to the case's bank
FIRST, then rank by 0.7 × vector similarity + 0.3 × keyword overlap, top 5. Questions are embedded live
(one request); answers call the live free-tier models (one call per question, more on failover).

Answer correctness is an automatic keyword check (the expected fact, such as a form number, appears in
the answer). It is not a hand check: read the saved answers before quoting a correctness number.
"""

from __future__ import annotations

import json
import re
import statistics
import sys
import time
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parents[1]
sys.path.insert(0, str(BACKEND))

from app.services import rag
from app.services.ai_errors import AIUnavailableError

TOP_K = 5
STOP = {"the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "is", "are", "do", "does", "did", "can", "i", "my", "me", "you", "your", "what", "when", "how", "which", "who", "will", "be", "with", "at", "by", "from", "it", "this", "that", "there", "any", "have", "has", "after", "before", "about", "please"}


def words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 2 and w not in STOP}


def retrieve(question_vec: list[float], question: str, bank: str, index: list[dict[str, Any]]) -> list[dict]:
    """Bank filter first (the backend's RLS does this in the database), then hybrid score."""
    q_words = words(question)
    scored = []
    for p in index:
        if p["bank_id"] != bank:
            continue
        cosine = sum(a * b for a, b in zip(question_vec, p["embedding"], strict=True))
        keyword = len(q_words & words(p["text"])) / len(q_words) if q_words else 0.0
        scored.append({**p, "score": round(0.7 * cosine + 0.3 * keyword, 4)})
    return sorted(scored, key=lambda p: p["score"], reverse=True)[:TOP_K]


def ask(item: dict, vec: list[float], index: list[dict], context: dict) -> tuple[dict, list[dict], float, str | None]:
    passages = retrieve(vec, item["q"], item["bank"], index)
    started = time.monotonic()
    try:
        result = rag.answer(item["q"], passages, context, [], item.get("lang", "en"))
        error = None
    except AIUnavailableError as exc:
        result, error = {"answer_type": "passages_only", "body": "", "used_passage_ids": [], "model": None}, str(exc)
    return result, passages, time.monotonic() - started, error


def section_of(passage: dict) -> str:
    return passage["section"].split()[0]


def main() -> int:
    data = json.loads((HERE / "questions.json").read_text(encoding="utf-8"))
    index = json.loads((BACKEND / "seed_data" / "bluebooks" / "kb_passages.json").read_text(encoding="utf-8"))
    context = data["case_context"]
    items = [("golden", x) for x in data["golden"]] + [("leak", x) for x in data["leak"]] + \
            [("refusal", x) for x in data["refusal"]] + [("staff", x) for x in data["staff"]]
    vectors = rag.embed([x["q"] for _, x in items], task="query")

    raw, lines_out, failures = [], [], []
    times: list[float] = []
    models: Counter[str] = Counter()
    golden_hit = golden_type = golden_fact = golden_cites_right = 0
    leaks = leak_no_answer = 0
    refused = staff_ok = 0
    for i, ((kind, item), vec) in enumerate(zip(items, vectors, strict=True)):
        if i:
            time.sleep(4.0)  # real use is at most 20 questions per case per hour; free tiers limit per minute
        result, passages, took, error = ask(item, vec, index, context)
        times.append(took)
        models[result.get("model") or ("rule" if not error else "none")] += 1
        body, atype = result.get("body", ""), result["answer_type"]
        cited = [p for p in passages if p["passage_id"] in result.get("used_passage_ids", [])]
        assert all(p["bank_id"] == item["bank"] for p in passages)  # retrieval never crosses banks
        row = {"kind": kind, **item, "answer_type": atype, "body": body, "cited": [p["section"] for p in cited],
               "top3": [p["section"] for p in passages[:3]], "model": result.get("model"), "seconds": round(took, 2),
               "error": error}
        raw.append(row)
        if kind == "golden":
            hit = item["section"] in [section_of(p) for p in passages[:3]]
            fact = any(w.lower() in body.lower() for w in item["any"])
            right_cite = any(section_of(p) == item["section"] for p in cited)
            golden_hit += hit
            golden_type += atype == "grounded"
            golden_fact += atype == "grounded" and fact
            golden_cites_right += right_cite
            if not (hit and atype == "grounded" and fact and right_cite):
                failures.append(f"golden {item['bank']} '{item['q']}': top3={row['top3']} type={atype} "
                                f"cited={row['cited']} fact={'yes' if fact else 'no'} | {body[:160]!r}")
        elif kind == "leak":
            leaked = atype == "grounded" and any(w.lower() in body.lower() for w in item["leak_words"])
            leaks += leaked
            leak_no_answer += atype == "no_answer"
            if atype != "no_answer":
                failures.append(f"leak {item['bank']} (feature of {item['from']}) '{item['q']}': type={atype} "
                                f"{'LEAK' if leaked else 'answered from own bluebook'} | {body[:160]!r}")
        elif kind == "refusal":
            refused += atype == "refused"
            if atype != "refused":
                failures.append(f"refusal {item['bank']} '{item['q']}': type={atype} | {body[:160]!r}")
        else:
            staff_ok += bool(result.get("needs_staff"))
        print(f"{kind:8} {item['bank']} {atype:13} {took:4.1f}s {result.get('model') or error or 'rule'}"
              f" | {item['q'][:60]}", flush=True)

    g, lk, rf = len(data["golden"]), len(data["leak"]), len(data["refusal"])
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    lines_out = [
        f"# Case assistant eval ({stamp}, prompt `{rag.PROMPT_VERSION}`, embeddings `{rag.EMBED_MODEL}`)", "",
        "| Measure | Result |", "| :--- | :--- |",
        f"| Golden: right section in top 3 (retrieval) | **{golden_hit} of {g}** |",
        f"| Golden: answered `grounded` | {golden_type} of {g} |",
        f"| Golden: grounded and cites the right section | {golden_cites_right} of {g} |",
        f"| Golden: grounded and contains the expected fact (auto keyword check, not hand-checked) | {golden_fact} of {g} |",
        f"| Cross-bank leak: answers stating another bank's feature | **{leaks} of {lk}** (target 0) |",
        f"| Cross-bank leak: returned `no_answer` | {leak_no_answer} of {lk} |",
        f"| Refusal test: `refused` | **{refused} of {rf}** |",
        f"| \"Talk to a person\" reaches staff (`needs_staff`) | {staff_ok} of {len(data['staff'])} |",
        f"| Answer time | median {statistics.median(times):.1f} s, max {max(times):.1f} s |",
        f"| Models used | {dict(models)} |",
        "", ("Retrieval is filtered to the case's bank before ranking, as the backend does with RLS; every retrieved "
        "passage in this run was from the asker's own bank (checked)."),
        "", "## Not perfect (real examples)", "", *([f"- {f}" for f in failures] or ["- none"]), "",
    ]
    out = HERE / "results"
    out.mkdir(exist_ok=True)
    (out / f"{stamp}.md").write_text("\n".join(lines_out), encoding="utf-8")
    (out / f"{stamp}.json").write_text(json.dumps(raw, ensure_ascii=False, indent=1), encoding="utf-8")
    print("\n".join(lines_out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
