"""Fresh documents for the XREQ-009 scenario 4 human smoke test (AI on real input, G-53).

Values appear nowhere in the seed data or the eval sets, so a correct answer can't come from
the replay cache. Uses the drawing helpers of eval/extraction/make_docs.py (same font notes).

    cd backend && uv run python eval/smoke/make_smoke_docs.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import ImageFilter

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "extraction"))
import make_docs as md  # noqa: E402

DOCS = HERE / "documents"

EXPECTED = {
    "s01_blurry_receipt_photo.jpg": {
        "doc_type": "transfer_receipt",
        "fields": {"amount": 615000, "currency": "JPY", "transfer_date": "2026-11-12",
                   "account_number": "3141592", "account_holder_name": "HARBOR LIGHT TRADING"},
        "note": "English ATM receipt, phone photo, blurred. Expect correct values; some may land in review.",
    },
    "s02_japanese_receipt.jpg": {
        "doc_type": "transfer_receipt",
        "fields": {"amount": 1280000, "currency": "JPY", "transfer_date": "2026-11-14",
                   "account_number": "2718281", "account_holder_name": "カ）アオゾラファイナンス"},
        "note": "Japanese furikomi slip, era date 令和8年 (= 2026), phone photo.",
    },
    "s03_unreadable_photo.jpg": {
        "doc_type": "transfer_receipt",
        "fields": {},
        "note": "Far too blurry to read. Expect no invented values: empty or low-confidence fields, all in review.",
    },
}


def main() -> None:
    DOCS.mkdir(parents=True, exist_ok=True)
    md.DOCS = DOCS
    english = md.render(["ATM TRANSFER RECEIPT", "DATE 2026/11/12  14:07", "AMOUNT JPY 615,000",
                         "TO ACCOUNT 3141592", "PAYEE HARBOR LIGHT TRADING", "FEE JPY 330"], seed=41)
    md.save_image(md.photo(english, 41).filter(ImageFilter.GaussianBlur(1.6)), "s01_blurry_receipt_photo.jpg",
                  "JPEG", 70)
    japanese = md.render(["振込受付書（お客さま控）", "取扱日 令和8年11月14日", "振込金額 ￥1,280,000",
                          "振込先 みどり銀行 新宿支店 普通", "口座番号 2718281",
                          "受取人 カ）アオゾラファイナンス", "手数料 ￥440"], seed=42)
    md.save_image(md.photo(japanese, 42), "s02_japanese_receipt.jpg", "JPEG", 80)
    md.save_image(english.filter(ImageFilter.GaussianBlur(9)), "s03_unreadable_photo.jpg", "JPEG", 60)
    (DOCS / "expected.json").write_text(json.dumps(EXPECTED, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(EXPECTED)} documents to {DOCS}")


if __name__ == "__main__":
    main()
