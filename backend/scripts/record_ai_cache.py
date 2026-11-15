"""Record real extraction results for the seed documents, for the demo replay cache (owner: Galib).

    cd backend && uv run python scripts/record_ai_cache.py            # only documents not cached yet
    cd backend && uv run python scripts/record_ai_cache.py --all      # re-record everything

Calls the live providers once per document (free-tier quota). Results are saved unchanged to
seed_data/ai_cache/extraction/<sha256>.json and replayed only when every provider fails at demo time.
Re-run after changing the prompt version: older recordings are ignored.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.services import ai_extraction as ai  # noqa: E402
from app.services.ai_errors import AIUnavailableError  # noqa: E402

DOCS = BACKEND / "eval" / "extraction"
sys.path.insert(0, str(DOCS))

from run_eval import same  # noqa: E402  (the eval's normalized comparison)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="re-record documents that already have a recording")
    parser.add_argument("--pause", type=float, default=5.0)
    args = parser.parse_args()
    labels = json.loads((DOCS / "labels.json").read_text(encoding="utf-8"))
    recorded = skipped = failed = 0
    for doc in labels:
        data = (DOCS / "documents" / doc["file"]).read_bytes()
        if not args.all and ai.cached_result(data):
            skipped += 1
            continue
        if recorded or failed:
            time.sleep(args.pause)
        try:
            # Ask the live chain only: a replay must never be re-recorded as if it were new.
            result = ai.extract_fields(data, doc["mime_type"], doc["doc_type"])
        except AIUnavailableError as exc:
            failed += 1
            print(f"{doc['id']}: not recorded, all providers failed ({str(exc)[:120]})")
            continue
        if str(result["model"]).startswith("cached:"):
            skipped += 1
            continue
        got = {f["name"]: f["value"] for f in result["fields"]}
        right = sum(same(v, got.get(k)) for k, v in doc["expected"].items() if k in got)
        ai.record_result(data, result, doc["file"])
        recorded += 1
        print(f"{doc['id']}: recorded via {result['model']} ({right}/{len(doc['expected'])} fields match the label)")
    print(f"recorded {recorded}, already cached {skipped}, failed {failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
