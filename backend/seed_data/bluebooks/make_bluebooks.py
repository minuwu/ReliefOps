"""Generate the 5 synthetic bank bluebooks (victim-facing fraud relief guides) as PDFs.

All banks, phone numbers, addresses and rules are invented for the demo; they are not real bank
documents (the brief forbids those). Each bank differs on purpose (required documents, contact hours,
notice period, payment timing, appeal window, one unique service) so the assistant must cite the
right bank, and the cross-bank leak test has questions only one bank can answer.

    cd backend && python seed_data/bluebooks/make_bluebooks.py
"""

from __future__ import annotations

import json
from pathlib import Path

import pymupdf

HERE = Path(__file__).resolve().parent

BANKS = {
    "bank_a": {
        "name": "Aster Regional Bank", "short": "Aster",
        "documents": ["the completed Relief Application Form (Form AR-7)", ("a copy of your photo ID (driving licence, "
                      "My Number card or passport)"), "the transfer receipt or bank statement showing the payment",
                      "the police report receipt number"],
        "hours": "weekdays from 9:00 to 17:00", "phone": "0120-111-701",
        "address": "Aster Regional Bank, Fraud Relief Desk, 1-2-3 Kita, Sapporo",
        "notice": "The public notice runs for 60 days. During those 60 days, anyone who claims the money in the "
                  "account may come forward.",
        "apply_window": "You must apply within 30 days after the payment notice is published.",
        "pay_timing": "Payment is made within 30 days after the bank decides the amount.",
        "appeal": "You may ask for a review within 14 days of receiving the decision letter. Send a short letter "
                  "explaining why you disagree to the Fraud Relief Desk.",
        "unique_title": "Video consultation",
        "unique": "Aster Regional Bank offers video consultations with a relief officer on a tablet at any Aster "
                  "branch. Book a 30-minute slot by phone. Video consultation is free and available in Japanese only.",
    },
    "bank_b": {
        "name": "Birch Regional Bank", "short": "Birch",
        "documents": ["the Relief Application Form (Form BR-2)", "a copy of your photo ID",
                      "the ATM slip or online-banking confirmation of the transfer",
                      "a copy of your bank passbook page for the account where you want the payment"],
        "hours": "weekdays from 9:00 to 18:00 and Saturdays from 10:00 to 15:00", "phone": "0120-222-802",
        "address": "Birch Regional Bank, Relief Center, 4-5-6 Sakae, Nagoya",
        "notice": "The public notice period is at least sixty (60) days and is published on the Deposit Insurance "
                  "Corporation website. The Bank cannot shorten this period.",
        "apply_window": "You must apply within 45 days after the payment notice is published.",
        "pay_timing": "Payment is made within 45 days after the bank decides the amount.",
        "appeal": "You may ask for a review within 30 days of the decision. Use Form BR-9 (Review Request).",
        "unique_title": "Home visits for older applicants",
        "unique": "Applicants aged 75 or older may ask for a home visit. A relief officer visits your home to help "
                  "complete the application and copy your documents. Ask for a home visit by phone; visits are "
                  "arranged within 10 business days.",
    },
    "bank_c": {
        "name": "Cobalt Regional Bank", "short": "Cobalt",
        "documents": ["the online relief application (no paper form is needed)", ("a photo of your photo ID uploaded "
                      "in the application"), "the transfer record (receipt, statement or screenshot)"],
        "hours": "weekdays from 8:30 to 20:00", "phone": "0120-333-903",
        "address": "Cobalt Regional Bank, Fraud Support Team, 7-8-9 Tenjin, Fukuoka",
        "notice": "The notice period lasts two months (about 60 days) from the day the notice is published.",
        "apply_window": "You must apply within 30 days after the payment notice is published.",
        "pay_timing": "Payment is made within 20 business days after the bank decides the amount.",
        "appeal": "You may ask for a review within 14 days of the decision, by phone or through the online form.",
        "unique_title": "Text message status alerts",
        "unique": "Cobalt Regional Bank sends a text message (SMS) to your registered mobile phone each time your "
                  "case moves to a new stage. You can turn SMS alerts off by calling the Fraud Support Team.",
    },
    "bank_d": {
        "name": "Dune Regional Bank", "short": "Dune",
        "documents": ["the Relief Application Form (Form DR-1)", ("a certified copy of your residence certificate "
                      "(juminhyo) issued within the last 3 months"), "a copy of your photo ID",
                      "the transfer receipt", "a signed declaration that you made the transfer because of fraud"],
        "hours": "weekdays from 9:00 to 15:00", "phone": "0120-444-104",
        "address": "Dune Regional Bank, Relief Office, 2-4-6 Umeda, Osaka",
        "notice": "Dune Regional Bank publishes the notice for 60 days. A second notice is needed if a claim is "
                  "filed against the account during that period.",
        "apply_window": "You must apply within 60 days after the payment notice is published.",
        "pay_timing": "Payment is made once a month, on the last business day of the month after the decision.",
        "appeal": "You may ask for a review within 30 days of the decision, in writing only.",
        "unique_title": "Saturday counter",
        "unique": "The Umeda main branch has a fraud relief counter open on Saturdays from 9:00 to 12:00. No "
                  "appointment is needed. Bring your documents and your photo ID.",
    },
    "bank_e": {
        "name": "Ember Regional Bank", "short": "Ember",
        "documents": ["the Relief Application Form (Form ER-3)", "a copy of your photo ID",
                      "the transfer receipt or statement", "your residence card, if you are not a Japanese national"],
        "hours": "weekdays from 9:30 to 17:30", "phone": "0120-555-205",
        "address": "Ember Regional Bank, Victim Relief Unit, 3-1-1 Sendai Station East, Sendai",
        "notice": "The notice period is 60 days. Ember Regional Bank also posts the notice in its branches.",
        "apply_window": "You must apply within 30 days after the payment notice is published.",
        "pay_timing": "Payment is made within 30 days after the bank decides the amount.",
        "appeal": "You may ask for a review within 21 days of the decision, by letter or at any branch.",
        "unique_title": "Interpreter service",
        "unique": "Free interpreters are available in English, Bangla, Vietnamese and Chinese for calls and branch "
                  "visits. Ask for an interpreter when you call; an interpreter joins the call within two business "
                  "days.",
    },
}


def sections(b: dict) -> list[tuple[str, str]]:
    docs = "\n".join(f"- {d}" for d in b["documents"])
    return [
        ("1 About this guide",
         (f"This guide explains how {b['name']} handles relief payments for victims of transfer fraud (furikome "
         "sagi) under the Act on Relief Payments for Victims of Fraudulent Transfers. It is written for "
         "applicants. It explains the process only. It does not decide whether you will receive a payment or how "
         "much. Decisions are made by the bank after the steps below.")),
        ("2 Who can apply",
         ("You can apply if you transferred money because of fraud to an account that has since been frozen. "
         "Examples are calls from someone pretending to be a relative, the police or a government office, fake "
         "investment offers, and fake prize or refund notices. You can also apply on behalf of a family member "
         "with their written consent.")),
        ("3.1 Documents you need", (f"To apply to {b['name']} you need:\n{docs}\nCopies are fine unless a "
         "certified copy is stated. We return original documents by registered mail.")),
        ("3.2 How and when to contact us",
         (f"Call the relief desk at {b['phone']} ({b['hours']}, except national holidays and 29 December to "
         f"3 January). Postal address: {b['address']}. Calls are free from landlines and mobile phones.")),
        ("4.1 Verification",
         ("After we receive your application, we check that it is complete and that the transfer matches our "
         "records. If something is missing, we contact you by phone or letter. Verification usually takes two "
         "to four weeks. You do not need to do anything during verification unless we contact you.")),
        ("4.2 After verification",
         ("After verification, the bank checks the recipient account and freezes any remaining balance. The "
         "applicant is contacted only if further documents are required.")),
        ("4.3 Public notice period", b["notice"] + " If nobody claims the money, the account holder's rights "
         "end and the remaining balance can be used for relief payments."),
        ("4.4 Payment notice and application period",
         "After the notice period, a payment notice is published. " + b["apply_window"] + " If you already "
         "applied before the payment notice, you do not need to apply again."),
        ("5.1 How the amount is decided",
         ("The money available is only what remained in the frozen account. If several victims sent money to "
         "the same account, the remaining balance is shared in proportion to each victim's loss. The payment "
         "may be less than the amount you lost, and it may be nothing if the account was empty. Staff cannot "
         "tell you the amount before the decision.")),
        ("5.2 When you receive the payment", b["pay_timing"] + " The payment goes to the bank account you "
         "named in your application. We send a decision letter before paying."),
        ("6 If your details change",
         ("Tell us as soon as possible if your address, phone number or payment account changes. You can also "
         "withdraw your application at any time by telling the relief desk in writing.")),
        ("7 If you disagree with the decision", b["appeal"]),
        ("8 " + b["unique_title"], b["unique"]),
        ("9 Protect yourself from new scams",
         (f"{b['name']} will never ask you to pay a fee to receive a relief payment, and will never ask for your "
         "PIN or online-banking password. If someone calls about your relief payment and asks for money, hang "
         f"up and call {b['phone']}.")),
    ]


def write_pdf(bank_id: str, b: dict) -> Path:
    doc = pymupdf.open()
    title = f"{b['name']} — Fraud Relief Bluebook"
    page = doc.new_page()
    y = 72.0

    def new_page() -> None:
        nonlocal page, y
        page = doc.new_page()
        y = 72.0

    page.insert_text((72, y), title, fontsize=16, fontname="helv")
    y += 22
    page.insert_text((72, y), "Version 2026.1 · For applicants (victim-facing) · Synthetic demo document", fontsize=9)
    y += 28
    for heading, body in sections(b):
        if y > 640:
            new_page()
        page.insert_text((72, y), heading, fontsize=12, fontname="hebo")
        y += 18
        rect = pymupdf.Rect(72, y, 523, 770)
        left = page.insert_textbox(rect, body, fontsize=10.5, fontname="helv", lineheight=1.35)
        if left < 0:  # didn't fit: start the section on a new page
            page.draw_rect(rect, color=None, fill=(1, 1, 1))
            new_page()
            page.insert_text((72, y), heading, fontsize=12, fontname="hebo")
            y += 18
            rect = pymupdf.Rect(72, y, 523, 770)
            left = page.insert_textbox(rect, body, fontsize=10.5, fontname="helv", lineheight=1.35)
        y = rect.y1 - left + 16
    path = HERE / f"{bank_id}_bluebook.pdf"
    doc.save(path)
    return path


def main() -> None:
    meta = []
    for bank_id, b in BANKS.items():
        path = write_pdf(bank_id, b)
        meta.append({"bank_id": bank_id, "file": path.name, "title": f"{b['name']} — Fraud Relief Bluebook",
                     "version": "2026.1", "language": "en", "audience": "victim_facing"})
        print(path.name, pymupdf.open(path).page_count, "pages")
    (HERE / "bluebooks.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
