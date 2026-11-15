"""Split and embed the 5 synthetic bluebooks into kb_passages.json (backend-plan §6: commit the vectors,
so the demo and the seed don't depend on the embedding service).

    cd backend && python seed_data/bluebooks/build_index.py

Uses rag.split_bluebook and rag.embed (one embedding request per 100 passages).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1]))  # backend/

from app.services import rag


def main() -> None:
    books = json.loads((HERE / "bluebooks.json").read_text(encoding="utf-8"))
    rows = []
    for book in books:
        passages = rag.split_bluebook((HERE / book["file"]).read_bytes(), "application/pdf")
        for i, p in enumerate(passages, start=1):
            rows.append({"passage_id": f"{book['bank_id']}-{i:02d}", "bank_id": book["bank_id"], "file": book["file"],
                         "document_title": book["title"], "version": book["version"], **p})
    vectors = rag.embed([r["text"] for r in rows], task="document")
    for row, vector in zip(rows, vectors, strict=True):
        row["embedding_model"] = rag.EMBED_MODEL
        row["embedding"] = [round(v, 6) for v in vector]
    (HERE / "kb_passages.json").write_text(json.dumps(rows, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(rows)} passages from {len(books)} bluebooks, {rag.EMBED_DIM}-dim {rag.EMBED_MODEL}")


if __name__ == "__main__":
    main()
