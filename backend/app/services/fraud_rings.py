"""Cross-bank fraud ring detection (owner: Galib; XREQ-004).

Pure logic: no database, no HTTP, no model calls. The backend loads the cases a supervisor may see,
passes them in, and serves the result (``GET /api/analytics/fraud-rings``); the freeze action stays a
human supervisor action in the backend.

The same receiving account looks different across banks: "98-7654-3210" vs "9876543210", and the
holder as "GLOBAL ASSET TRUST", "グローバルアセットトラスト" or "カ）グローバルアセットトラスト". Plain
equality misses those. But the same digits at two banks can also be two different people's accounts,
so digits alone never make a confirmed ring: a cross-bank link is "confirmed" only when the holder
names also match, and "possible" (for a person to check) when they conflict or are missing.

Each ring carries plain-language ``reasons`` for its threat level, so a supervisor can check them.
"""

from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from difflib import SequenceMatcher
from typing import Any, Final

MIN_ACCOUNT_DIGITS: Final = 5
NAME_MATCH: Final = 0.85  # similarity of the sound keys
CRITICAL_CASES: Final = 3
CRITICAL_TOTAL: Final = 3_000_000
BURST_DAYS: Final = 14

# Company markers carry no identity: カ）, (株), 株式会社, LLC, ...
_COMPANY: Final = re.compile(
    r"\(?[カユ有][)）]|[(（][カユ有株][)）]|株式会社|有限会社|合同会社|\b(llc|inc|ltd|co|corp|kk|gk|limited|company)\b\.?",
    re.IGNORECASE)

# Katakana → rough romaji consonant. Vowels are dropped later, so only the consonant matters.
_KANA_CONSONANT: Final = {
    **dict.fromkeys("アイウエオァィゥェォ", ""), **dict.fromkeys("カキクケコ", "k"), **dict.fromkeys("ガギグゲゴ", "g"),
    **dict.fromkeys("サスセソ", "s"), "シ": "s", **dict.fromkeys("ザズゼゾ", "z"), "ジ": "j",
    **dict.fromkeys("タテト", "t"), "チ": "t", "ツ": "t", **dict.fromkeys("ダデド", "d"), "ヂ": "j", "ヅ": "z",
    **dict.fromkeys("ナニヌネノ", "n"), **dict.fromkeys("ハヒヘホ", "h"), "フ": "f", **dict.fromkeys("バビブベボ", "b"),
    **dict.fromkeys("パピプペポ", "p"), **dict.fromkeys("マミムメモ", "m"), **dict.fromkeys("ヤユヨャュョ", "y"),
    **dict.fromkeys("ラリルレロ", "r"), **dict.fromkeys("ワヲ", "w"), "ン": "n", "ヴ": "b", "ー": "", "ッ": "",
}


def normalize_account(raw: Any) -> str | None:
    digits = re.sub(r"\D", "", unicodedata.normalize("NFKC", str(raw or "")))
    return digits if len(digits) >= MIN_ACCOUNT_DIGITS else None


def name_key(raw: Any) -> str:
    """A sound key that is the same for an English name and its katakana spelling.

    GLOBAL ASSET TRUST → grbrstrst; グローバルアセットトラスト → grbrstrst. Kanji and other scripts are
    kept as they are (exact match only).
    """
    text = _COMPANY.sub(" ", unicodedata.normalize("NFKC", str(raw or "")))
    text = unicodedata.normalize("NFKC", text).lower()
    text = re.sub(r"[ァ-ヶー]", lambda m: _KANA_CONSONANT.get(m.group(), m.group()), text)
    text = text.replace("ph", "f").replace("sh", "s").replace("ch", "t").replace("th", "t")
    text = text.replace("l", "r").replace("v", "b").replace("c", "k").replace("q", "k").replace("x", "ks")
    text = re.sub(r"[aeiou\s\W_]", "", text)
    return re.sub(r"(.)\1+", r"\1", text)  # collapse doubled letters


def same_holder(a: Any, b: Any) -> bool | None:
    """True/False when both names are known; None when one is missing."""
    ka, kb = name_key(a), name_key(b)
    if not ka or not kb:
        return None
    return ka == kb or SequenceMatcher(None, ka, kb).ratio() >= NAME_MATCH


def _day(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


@dataclass
class _Group:
    account: str
    cases: list[dict[str, Any]]


def _holder_clusters(cases: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """Split one account number's cases into groups whose holder names agree (unknown names join any)."""
    clusters: list[list[dict[str, Any]]] = []
    unknown = [c for c in cases if not name_key(c.get("account_holder_name"))]
    for case in (c for c in cases if name_key(c.get("account_holder_name"))):
        for cluster in clusters:
            if same_holder(cluster[0].get("account_holder_name"), case.get("account_holder_name")):
                cluster.append(case)
                break
        else:
            clusters.append([case])
    if not clusters:
        return [unknown] if unknown else []
    clusters[0].extend(unknown)  # a missing name can't contradict; keep it with the largest name group
    return clusters


def _assess(account: str, cases: list[dict[str, Any]], *, name_conflict: bool,
            frozen: set[str]) -> dict[str, Any] | None:
    banks = sorted({c["bank_id"] for c in cases})
    total = sum(float(c.get("amount") or 0) for c in cases)
    names = sorted({str(c["account_holder_name"]) for c in cases if c.get("account_holder_name")})
    known = [c for c in cases if c.get("account_holder_name")]
    confirmed = len(banks) > 1 and not name_conflict and len({c["bank_id"] for c in known}) > 1
    reasons = [f"{len(cases)} victim cases sent money to account {account}"]
    if len(banks) > 1:
        reasons.append(f"cases reported at {len(banks)} different banks: {', '.join(banks)}")
    if len(names) > 1 and not name_conflict:
        reasons.append(f"holder name written differently but matching: {' / '.join(names)}")
    if name_conflict:
        reasons.append("account number matches but holder names differ: may be different accounts, check before acting")
    elif len(banks) > 1 and not confirmed:
        reasons.append("holder name missing at one bank: link not confirmed")
    if total >= CRITICAL_TOTAL:
        reasons.append(f"total transferred ¥{total:,.0f}")
    days = sorted(d for d in (_day(c.get("transfer_date")) for c in cases) if d)
    burst = len(days) >= 2 and (days[-1] - days[0]).days <= BURST_DAYS
    if burst:
        reasons.append(f"transfers within {(days[-1] - days[0]).days} days")

    if name_conflict or (len(banks) > 1 and not confirmed):
        level = "POSSIBLE_LINK"
    elif len(banks) > 1 and (len(cases) >= CRITICAL_CASES or total >= CRITICAL_TOTAL or burst):
        level = "CRITICAL_SYNDICATE"
    elif len(banks) > 1:
        level = "HIGH"
    else:
        level = "ELEVATED"  # same bank, several victims
    by_amount = sorted(cases, key=lambda c: (str(c.get("transfer_date") or ""), str(c.get("reference") or "")))
    return {
        "account_number": account,
        "holder_name": names[0] if len(names) == 1 else (names[0] if names else None),
        "holder_names": names,
        "case_count": len(cases),
        "total_amount": int(total) if total.is_integer() else total,
        "banks_involved": banks,
        "threat_level": level,
        "link": "possible" if level == "POSSIBLE_LINK" else "confirmed" if len(banks) > 1 else "same_bank",
        "reasons": reasons,
        "is_frozen": account in frozen,
        "cases": [{"id": str(c["id"]), "reference": c.get("reference"), "bank_id": c["bank_id"],
                   "amount": c.get("amount")} for c in by_amount],
    }


_ORDER: Final = {"CRITICAL_SYNDICATE": 0, "HIGH": 1, "POSSIBLE_LINK": 2, "ELEVATED": 3}


def detect_rings(cases: list[dict[str, Any]], *, include_same_bank: bool = False,
                 frozen_accounts: set[str] | frozenset[str] = frozenset()) -> list[dict[str, Any]]:
    """Group cases by receiving account and assess each group (XREQ-004 response items).

    ``cases``: dicts with ``id``, ``reference``, ``bank_id``, ``amount``, ``account_number``,
    ``account_holder_name`` and optionally ``transfer_date``. Pass only cases the caller may see
    (supervisor: all banks). Returns cross-bank rings (and same-bank repeats if
    ``include_same_bank``), most serious first.
    """
    by_account: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for case in cases:
        if account := normalize_account(case.get("account_number")):
            by_account[account].append(case)
    frozen = {normalize_account(a) for a in frozen_accounts} - {None}
    rings = []
    for account, group in by_account.items():
        if len(group) < 2:
            continue
        clusters = _holder_clusters(group)
        multi_bank = len({c["bank_id"] for c in group}) > 1
        if len(clusters) > 1 and multi_bank:
            ring = _assess(account, group, name_conflict=True, frozen=frozen)  # same digits, different names
        elif len(clusters) > 1:
            rings += [r for c in clusters if len(c) > 1 and (r := _assess(account, c, name_conflict=False, frozen=frozen))]
            continue
        else:
            ring = _assess(account, group, name_conflict=False, frozen=frozen)
        if ring:
            rings.append(ring)
    if not include_same_bank:
        rings = [r for r in rings if len(r["banks_involved"]) > 1]
    return sorted(rings, key=lambda r: (_ORDER[r["threat_level"]], -float(r["total_amount"]), r["account_number"]))
