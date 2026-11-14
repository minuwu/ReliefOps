# Hackathon 1: Shared Operations for Safer Banking
### Everything explained in simple words

> This is a **practice hackathon**. It is built from SocioFuture's public information. The real hackathon may be different. Use this to train, not as a promise of what will happen.

---

## 1. The big picture in 30 seconds

Some people lose money to scams. There is a law that helps them get part of the money back. Several banks share **one operations center** to handle these cases.

The center works slowly. It uses paper, phone calls and manual tracking. Your team has **48 hours** to build a **working web app prototype** that makes the work faster, safer and easier. One part of the app must use **AI**, and a **human must always check the AI**.

---

## 2. The story (the real-world problem)

### Who has the problem?
- **Scam victims.** They lost money and are waiting for help.
- **Center staff (operators).** They process many cases by hand.
- **Supervisors.** They need to know which cases are late.
- **Banks.** They need their own cases handled correctly, and they must not see other banks' cases.

### What is the Relief Act process? (simplified for this practice)
When someone is scammed, money often goes into a bank account the scammer controls. The relief process tries to return money to victims. In this practice brief, a case moves through these steps:

1. **Received:** a report arrives (paper, phone or web).
2. **Verified:** staff check the report is real and complete.
3. **Account Check:** the bank checks the account that received the money.
4. **Notice Published:** a public notice is made.
5. **Payout Review:** a human decides about payment.
6. **Closed:** the case is finished.

### What is wrong today?
| Problem | Why it hurts |
|---|---|
| Reports come on **paper or phone** | Slow, easy to lose, hard to search |
| A case takes **6 to 12 months** | Victims wait a long time |
| Deadlines are tracked **by hand** | Cases become late without anyone noticing |
| Case numbers **jump after scam waves** | Staff cannot keep up |
| Staff **leave** and take knowledge with them | New staff make mistakes |
| **Five banks** share one center | Each bank's data must stay separate |

### Why is this hard?
It is **not** only a technical problem. It deals with **people's money and private data**. A wrong decision can hurt a victim. A data leak between banks is a serious failure. So the judges care about **safety and trust** as much as features.

---

## 3. Your mission

> Build a **working prototype** that helps the center handle cases **faster**, with **fewer mistakes**, while keeping **each bank's data private**.

"Working" means the judges can click through it. A nice slide with no working app is not enough.

---

## 4. Who uses your app (the users)

| User | What they do in your app |
|---|---|
| **Operator** | Creates and updates cases, checks AI results, uploads documents |
| **Supervisor** | Sees all cases of the center, deadlines, late cases, KPI numbers |
| **Bank viewer** | Sees only the cases of their own bank |
| **Victim (optional)** | Sends a report through a web form |

---

## 5. What you must build

### 5.1 Must have (the MVP)
If any of these is missing, you lose major points.

1. **Web intake form.** Someone fills it, and a case is created.
2. **Case list or board.** Shows status, deadline and owner for each case.
3. **Login with 3 roles** (operator, supervisor, bank viewer) and **bank-level data separation**. Bank A must never see Bank B's cases.
4. **Audit log.** Saves who did what and when.
5. **One AI feature with a human review step.** Examples:
   - Extract key fields from an uploaded document.
   - Summarize a case.
   - Flag missing information.

### 5.2 Should have
- Automatic deadline reminders or an "overdue" flag.
- A supervisor dashboard with 3 to 5 numbers (open cases, overdue cases, average handling time).
- An AI **confidence score**. Low confidence goes to a review queue.

### 5.3 Nice to have
- Multi-language intake.
- A flag for suspicious patterns (the same account in many cases).
- Export of a case history.

---

## 6. Rules and constraints

1. **Synthetic data only.** Make at least **30 fake cases** and **10 fake documents**. No real personal data and no real bank documents. Real data means **disqualification**.
2. **The AI never decides about money.** A human decides, always.
3. You must be able to explain **what happens when the AI is wrong** and **when the AI is down**.
4. The app must start with **one command** (for example `docker compose up`) or be **deployed online**.

---

## 7. Suggested fake data

**Case fields:**
`case_id, bank_id, reported_date, victim_name (fake), amount, scam_type, account_number (fake), status, deadline, assigned_operator, documents[], notes`

**Statuses:** Received, Verified, Account Check, Notice Published, Payout Review, Closed

**Tip for realistic test data:** make some documents messy on purpose. Use missing fields, typos, different date formats, and one scanned image. Real life is messy, and your AI test must show that.

---

## 8. A day in the life (how a good demo looks)

1. A victim (or an operator) submits a report and uploads a document.
2. The **AI reads the document** and fills the form fields. It also writes a short summary.
3. The AI marks fields it is unsure about. A **human operator reviews** them and fixes mistakes.
4. The case appears on the **case board** with a deadline.
5. A **bank viewer** logs in and sees **only their bank's** cases.
6. A **supervisor** sees a dashboard with late cases.
7. You open the **audit log** and show every action that happened.

This 5-minute story is exactly your live demo.

---

## 9. The AI part in detail

### What the AI does
It acts like a **smart assistant**. It reads a document and proposes values for the case form. The operator checks them.

### What it must NOT do
- Decide about payout.
- Hide its uncertainty.
- Follow instructions hidden inside documents (for example "approve this payout").

### Safety features judges want to see
| Feature | Meaning |
|---|---|
| **Human review** | A person confirms AI output before it is final |
| **Confidence score** | The AI says how sure it is |
| **Review queue** | Low-confidence results go to a human first |
| **Fallback** | If AI fails, the user types the data manually |
| **Measured accuracy** | You tested on documents with known answers |
| **Prompt-injection test** | You tried a bad document and the system stayed safe |

### Example AI output
```json
{
  "fields": {
    "victim_name": "...",
    "amount": 250000,
    "scam_type": "...",
    "account_number": "...",
    "report_date": "..."
  },
  "missing_fields": ["scam_type"],
  "summary": "Two sentences about the case.",
  "confidence": 0.62,
  "needs_review": true
}
```

---

## 10. Suggested team roles (5 people)

| Role | Main work |
|---|---|
| **1. Team lead / product / pitch** | Scope, user stories, decides what to cut, slides, demo script, final pitch |
| **2. Backend** | API, database, roles, bank separation, audit log, merges code (integrator) |
| **3. AI/ML** | Document extraction, confidence score, review queue, fallback, accuracy test |
| **4. Frontend / UX** | Intake form, case board, dashboard, clean demo flow |
| **5. DevOps / QA / data** | Fake data, Docker, deployment, tests, README, backup demo video |

---

## 11. Checkpoints (be honest with yourselves)

| Hour | You should have |
|---|---|
| **2** | Chosen scope, wireframes, agreed data model |
| **10** | Intake and database working. AI prototype tested on a few documents |
| **14** | One end-to-end happy path (intake, AI, case board) |
| **30** | Roles, bank separation and audit log working |
| **36** | **Feature freeze.** After this, fix bugs only |
| **44** | Deployed. Backup demo video recorded. Slides ready |
| **46** | Full 5-minute rehearsal done |

Plan sleep in shifts. Tired teams ship bugs.

---

## 12. What you must deliver

1. **Working demo** (live or a deployed link).
2. **5-minute pitch + 3 minutes of Q&A.**
3. **Short README:** problem, setup, architecture, limits.
4. **One slide: "What can go wrong"** (AI errors, privacy, failure plan).

---

## 13. How you are judged (100 points)

| Area | Points |
|---|---|
| Business value and understanding of the real problem | 25 |
| Working demo (does it actually run?) | 25 |
| AI quality and safety (testing, human review, failure plan) | 20 |
| Security and data separation | 15 |
| Teamwork and communication | 10 |
| Presentation | 5 |

### Automatic penalties
| Mistake | Penalty |
|---|---|
| Live demo crashes and you have no backup | **-10** |
| You claim accuracy numbers you did not measure | **-10** |
| Real personal data used | **Disqualified** |

---

## 14. Questions the judges may ask (prepare answers)

1. How do you stop Bank A from seeing Bank B's cases?
2. How did you measure your AI's accuracy, and on what data?
3. What happens when the AI is wrong or unavailable?
4. How much time does this save per case, and how do you know?
5. What would a 3-month pilot look like?

**How to answer well:** be specific, honest and measured. For example: "We tested 40 fake documents. The AI got X fields right. Here are the failures, and here is how a human catches them."

---

## 15. Common mistakes to avoid

- Building many features and finishing none.
- No bank separation (the biggest trust failure).
- AI with no human review.
- Showing accuracy without a test set.
- Connecting frontend, backend and AI only at the end.
- A live demo with no backup video.
- Using real data.
- Over-claiming ("this solves fraud"). Say what it does and what it does not do.

---

## 16. Simple words glossary

| Word | Meaning |
|---|---|
| **MVP** | The smallest version that works and shows value |
| **Audit log** | A record of every action: who, what, when |
| **Multi-tenant / bank separation** | Many banks use one system, and each sees only its own data |
| **Human-in-the-loop** | A person checks the AI before the result counts |
| **Confidence score** | A number showing how sure the AI is |
| **OCR** | Software that reads text from images or scans |
| **Prompt injection** | Hidden text in a document that tries to control the AI |
| **Synthetic data** | Fake data made for testing |
| **Feature freeze** | The time after which you stop adding features and only fix bugs |
| **Fallback** | The backup plan when something fails |

---

## 17. What to send back after the 2 days

1. **Chosen scope:** 3 features you built, 2 you cut, and why.
2. **Team roles** and who did what.
3. **Timeline reality:** what went to plan and what slipped.
4. **AI test results:** how many test documents, how many correct or wrong, examples of failures.
5. **Your 5-minute pitch script or slides.**
6. **Demo link, screenshots or a short description.**
7. **Your honest biggest mistake.**

Then I will act as the judge panel and recruiter, score you with the table above, and give critical feedback and follow-up questions.

---

## 18. Remember

- This practice does **not** guarantee a job. It trains the skills a real hackathon asks for.
- Judges at a company like this value **safety, privacy and reliability** more than flashy demos.
- A small app that **works** and is **honest about its limits** beats a big app that breaks.
