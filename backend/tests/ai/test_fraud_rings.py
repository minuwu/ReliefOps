"""app/services/fraud_rings.py: XREQ-004 detection, matching across spellings, safe with lookalikes."""

from __future__ import annotations

import pytest

from app.services import fraud_rings as fr


def case(n: int, bank: str, account: str | None, holder: str | None, amount: int = 500_000,
         day: str | None = "2026-11-01") -> dict:
    return {"id": f"c{n}", "reference": f"RFR-2026-{n:05d}", "bank_id": bank, "amount": amount,
            "account_number": account, "account_holder_name": holder, "transfer_date": day}


SEED_STORY = [  # same accounts as app/seed.py SHARED_ACCOUNTS; amounts and dates made up here
    case(3, "bank_b", "9876543210", "GLOBAL ASSET TRUST", 1_450_000, "2026-11-02"),
    case(11, "bank_b", "9876543210", "GLOBAL ASSET TRUST", 800_000, "2026-11-05"),
    case(19, "bank_a", "9876543210", "GLOBAL ASSET TRUST", 1_450_000, "2026-11-10"),
    case(7, "bank_d", "4455667", "Sakura Holdings LLC"),
    case(24, "bank_d", "4455667", "Sakura Holdings LLC"),
    case(30, "bank_b", "0012345", "Sample Trading LLC"),
    case(40, "bank_c", "1111111", "Someone Else"),
]


def test_the_seed_cross_bank_account_is_a_critical_syndicate() -> None:
    rings = fr.detect_rings(SEED_STORY)

    assert [r["account_number"] for r in rings] == ["9876543210"]  # same-bank repeats left out by default
    ring = rings[0]
    assert ring["threat_level"] == "CRITICAL_SYNDICATE"
    assert (ring["case_count"], ring["total_amount"], ring["banks_involved"]) == (3, 3_700_000, ["bank_a", "bank_b"])
    assert ring["holder_name"] == "GLOBAL ASSET TRUST"
    assert ring["link"] == "confirmed"
    assert ring["is_frozen"] is False
    assert [c["reference"] for c in ring["cases"]] == ["RFR-2026-00003", "RFR-2026-00011", "RFR-2026-00019"]
    assert any("2 different banks" in r for r in ring["reasons"])


def test_same_bank_repeats_are_listed_on_request() -> None:
    rings = fr.detect_rings(SEED_STORY, include_same_bank=True)
    levels = {r["account_number"]: r["threat_level"] for r in rings}
    assert levels == {"9876543210": "CRITICAL_SYNDICATE", "4455667": "ELEVATED"}


@pytest.mark.parametrize(("a", "b"), [
    ("GLOBAL ASSET TRUST", "グローバルアセットトラスト"),
    ("GLOBAL ASSET TRUST", "カ）グローバルアセットトラスト"),
    ("Sakura Holdings LLC", "サクラホールディングス"),
    ("Mirai Consulting", "カ）ミライコンサルティング"),
    ("ＧＬＯＢＡＬ　ＡＳＳＥＴ　ＴＲＵＳＴ", "Global Asset Trust Co., Ltd."),
])
def test_the_same_holder_in_different_spellings_matches(a: str, b: str) -> None:
    assert fr.same_holder(a, b) is True


@pytest.mark.parametrize(("a", "b"), [
    ("GLOBAL ASSET TRUST", "Sunrise Trading"),
    ("ヤマダ タロウ", "スズキ イチロウ"),
    ("Northern Capital", "グローバルアセットトラスト"),
])
def test_different_holders_do_not_match(a: str, b: str) -> None:
    assert fr.same_holder(a, b) is False


def test_account_numbers_match_across_formats() -> None:
    rings = fr.detect_rings([case(1, "bank_a", "98-7654-3210", "GLOBAL ASSET TRUST"),
                             case(2, "bank_b", "９８７６５４３２１０", "グローバルアセットトラスト")])
    assert rings[0]["account_number"] == "9876543210"
    assert rings[0]["link"] == "confirmed"
    assert len(rings[0]["holder_names"]) == 2


def test_same_digits_with_different_names_is_only_a_possible_link() -> None:
    rings = fr.detect_rings([case(1, "bank_a", "1234567", "Yamada Taro", 5_000_000),
                             case(2, "bank_b", "1234567", "Northern Capital", 5_000_000),
                             case(3, "bank_c", "1234567", "Northern Capital", 5_000_000)])
    ring = rings[0]
    assert ring["threat_level"] == "POSSIBLE_LINK"  # never CRITICAL, however large
    assert ring["link"] == "possible"
    assert any("holder names differ" in r for r in ring["reasons"])


def test_a_missing_name_at_one_bank_is_not_confirmed() -> None:
    rings = fr.detect_rings([case(1, "bank_a", "7654321", "GLOBAL ASSET TRUST"), case(2, "bank_b", "7654321", None)])
    assert rings[0]["threat_level"] == "POSSIBLE_LINK"


def test_two_banks_two_cases_small_and_slow_is_high_not_critical() -> None:
    rings = fr.detect_rings([case(1, "bank_a", "5550001", "Kenji Sample", 200_000, "2026-06-01"),
                             case(2, "bank_e", "5550001", "ケンジサンプル", 300_000, "2026-09-01")])
    assert rings[0]["threat_level"] == "HIGH"


def test_frozen_accounts_are_marked() -> None:
    rings = fr.detect_rings(SEED_STORY, frozen_accounts={"98-7654-3210"})
    assert rings[0]["is_frozen"] is True


def test_short_or_missing_account_numbers_are_ignored() -> None:
    assert fr.detect_rings([case(1, "bank_a", "123", "X"), case(2, "bank_b", "123", "X"),
                            case(3, "bank_a", None, "Y"), case(4, "bank_b", "", "Y")]) == []


def test_name_key_examples() -> None:
    assert fr.name_key("GLOBAL ASSET TRUST") == fr.name_key("グローバルアセットトラスト")
    assert fr.name_key("株式会社") == ""


def test_the_real_demo_seed_has_one_critical_cross_bank_ring() -> None:
    seed = pytest.importorskip("app.seed")
    cases = [{"id": c.reference, "reference": c.reference, "bank_id": c.bank_id, "amount": c.amount,
              "account_number": c.account_number, "account_holder_name": c.account_holder_name,
              "transfer_date": c.transfer_date} for c in seed.all_cases()]

    rings = fr.detect_rings(cases)

    assert [(r["account_number"], r["threat_level"], r["case_count"], r["banks_involved"]) for r in rings] == [
        ("9876543210", "CRITICAL_SYNDICATE", 3, ["bank_a", "bank_b"])]
    assert rings[0]["total_amount"] == 4_485_000


def test_day_spans_read_naturally() -> None:
    one_day = fr.detect_rings([case(1, "bank_a", "2223334", "X Trading", day="2026-11-01"),
                               case(2, "bank_b", "2223334", "X Trading", day="2026-11-02")])
    same_day = fr.detect_rings([case(1, "bank_a", "2223335", "X Trading", day="2026-11-01"),
                                case(2, "bank_b", "2223335", "X Trading", day="2026-11-01")])
    assert "transfers within 1 day" in one_day[0]["reasons"]
    assert "transfers on the same day" in same_day[0]["reasons"]
