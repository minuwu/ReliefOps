# Moving the frontend to contract v0.4.2, from the backend team

**For** Minhaz (Frontend) · **From** Asif (Backend) · **Date** 2026-11-15
**Contract** [docs/API_SPEC.md](../../docs/API_SPEC.md) v0.4.2 and [docs/openapi.yaml](../../docs/openapi.yaml)

The frontend looks great. The problem is that it was built on contract **v0.3.0** ([frontend/src/types/api.ts:2](../../frontend/src/types/api.ts)), and the contract is now **v0.4.2**. Today you don't see this, because `USE_MOCK = true` keeps every call in memory. When you switch to the mock server or the real backend, the victim portal and two staff actions stop working.

These are suggestions, not orders. If you want a different shape, file an `XREQ` (AGENTS.md §2) and we'll change the contract together.

---

## 0. What I tested and what broke

I ran the contract mock (Prism, from `docs/openapi.yaml`) and sent it **the exact requests** your `api.ts` sends in live mode (`USE_MOCK = false`).

**Result: 15 of 22 calls work, 7 are rejected.**

| Your function | Call | Mock answer | Why |
|---|---|---|---|
| `transitionCase` | `POST /api/cases/{id}/transition` | `422` | Body uses `status`; contract wants `to_status` + `expected_version` |
| `reviewExtraction` | `POST /api/extractions/{id}/review` | `422` | Body uses `action`; contract wants `decision` + `expected_version` |
| `submitIntake` | `POST /api/intake` | `404` | Route removed in v0.4.0 |
| `issueVictimAccessCode` | `POST /api/cases/{id}/victim-access` | `404` | Route removed in v0.4.0 |
| `createVictimSession` | `POST /api/victim/session` | `404` | Route removed in v0.4.0 |
| `getVictimChat` | `GET /api/victim/chat` | `404` | Moved to `/api/victim/cases/{id}/chat` |
| `sendVictimMessage` | `POST /api/victim/chat/messages` | `404` | Moved to `/api/victim/cases/{id}/chat/messages` |

**These 15 work as they are:** `login`, `getMe`, `getHealth`, `getBanks`, `getUsers`, `getCases`, `getCaseById`, `assignCase`, `addCaseNote`, `getReviewQueue`, `getExtraction`, `getDashboardStats`, `getAuditLogs`, `getSharedAccountAlerts`, `getKbDocuments`. Response shapes match too. For example, `/api/cases` returns `{ items, page, page_size, total }`, which is exactly your `PaginatedResult`.

The fixes are in sections 2 to 9, in the order I'd do them.

---

## 1. First, make it easy to test against the mock

### Problem
`USE_MOCK` is a constant in [api.ts:8](../../frontend/src/services/api.ts). To test live mode you have to edit code, and it's easy to commit it set to the wrong value.

### Fix
Read both settings from env variables:

```ts
// frontend/src/services/api.ts
export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK !== 'false';
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || (USE_MOCK ? '' : 'http://localhost:8000');
```

Create `frontend/.env.local`. It's already git-ignored by the `.env.*` rule.

```bash
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:4010
```

Start the contract mock from the repo root, then `npm run dev` in `frontend/`:

```bash
npx -y @stoplight/prism-cli@5.14.2 mock docs/openapi.yaml -p 4010
```

### Things to know about the mock
- It accepts any bearer token, but sending **no** token gets `401`. It doesn't filter by role or bank.
- It doesn't remember anything: a `POST` returns the example, not your data.
- **Every `422` returns the same example error** (`victim.email ...`), whatever is actually wrong. The real reason is printed in the Prism terminal as `Violation: request.body ...`. Keep that terminal visible.
- A body that isn't valid JSON gets **no answer** (the request hangs). The real backend returns `422`.
- To test error screens, send a `Prefer` header, e.g. `Prefer: code=409` or `Prefer: example=no_answer` (API_SPEC §9.1 lists them all).

---

## 2. Edit conflicts: send `expected_version` on every write

### Problem
Two operators can open the same case, and the second save would silently overwrite the first. To stop that, v0.4.0 gave every case an integer `version`. **Every write to a case must send back the version it loaded**, as `expected_version`:

- `PATCH /api/cases/{id}` (edit case)
- `POST /api/cases/{id}/transition` (move stage)
- `POST /api/extractions/{id}/review` (accept or reject AI fields)
- `PATCH /api/victim/cases/{id}` (victim edits their case)

If the case changed since you loaded it, the server answers `409 STALE_CASE`, with `details: { "current_version": 4 }`.

Your types have no `version` field at all, so none of these writes can work yet.

### Fix
1. Add `version: number` to `Case` and `VictimCase` (section 8).
2. Keep the version from the last time you loaded the case, and send it with the write.
3. On `409 STALE_CASE`, **don't retry automatically**, because that would overwrite the other person's change. Reload the case and tell the user:

```ts
// a small helper, e.g. in useCaseStore
async function saveCase<T>(caseId: string, write: () => Promise<T>): Promise<T | null> {
  try {
    return await write();
  } catch (e) {
    const err = e as ApiErrorDetail;
    if (err.code === 'STALE_CASE') {
      await get().fetchCase(caseId); // reload: new data + new version
      toast('Someone else changed this case. We reloaded it. Please check and try again.');
      return null;
    }
    throw e;
  }
}
```

### Where to get `version`
The full case (`GET /api/cases/{id}`) has it. The list rows (`CaseSummary`), review-queue items and extractions **don't**. So:
- **Case drawer:** you already call `getCaseById`, so use its `version`.
- **Board drag-and-drop and the review workbench:** call `getCaseById(case_id)` first, then write.

If that extra request bothers you, tell us. Adding `version` to `CaseSummary` and `case_version` to `ReviewQueueItem`/`Extraction` is a small, additive change, and we can put it in v0.4.3.

---

## 3. Moving a case (`transitionCase`)

### Problem
Your call sends `{ "status": "account_check", "note": "..." }`. The mock rejects it with `422`: the field is `to_status`, and `expected_version` is required.

### Fix

```ts
async transitionCase(
  caseId: string,
  payload: {
    to_status: CaseStatus;
    expected_version: number;
    closure_reason?: ClosureReason;   // required when to_status is 'closed'
    payout_amount?: number;           // required when closure_reason is 'paid_out'
    note?: string;
  }
): Promise<ApiResponse<Case>> {
  if (!USE_MOCK) {
    return request<Case>(`/api/cases/${caseId}/transition`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  // ...in-memory branch: rename status -> to_status there too
}
```

Errors to show:
| Code | Meaning | UI |
|---|---|---|
| `409 INVALID_STATUS_TRANSITION` | Move not allowed from this stage. `details.allowed` lists the stages that are | Disable the other stage buttons using `details.allowed` |
| `422 MISSING_REQUIRED_INFO` | Case can't leave this stage yet. `details.missing_fields` lists what's needed | Highlight those fields |
| `409 STALE_CASE` | Someone else changed it | Section 2 |
| `409 CASE_CLOSED` | Closed cases are read-only | Hide the edit controls when `status === 'closed'` |

---

## 4. Reviewing AI fields (`reviewExtraction`)

### Problem
Your call sends `{ action, approved_fields, review_note }`. The contract has `{ decision, fields, note, expected_version }`. Three names changed, and one field is new.

### Fix

```ts
async reviewExtraction(
  extractionId: string,
  payload: {
    decision: 'accept' | 'reject';
    expected_version: number;                                    // the CASE's version
    fields?: Partial<Record<ExtractableField, string | number | null>>; // accept only
    note?: string;                                               // required to reject
  }
): Promise<ApiResponse<Extraction>> {
  if (!USE_MOCK) {
    return request<Extraction>(`/api/extractions/${extractionId}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  // ...in-memory branch
}
```

Example accept: `{ "decision": "accept", "fields": { "amount": 250000, "account_number": "0012345" }, "note": "Checked against the scan.", "expected_version": 3 }`.
Example reject: `{ "decision": "reject", "note": "Wrong document.", "expected_version": 3 }`.

`409 ALREADY_REVIEWED` means someone else reviewed it first. Remove it from the queue and refresh.

---

## 5. Victim portal: access codes are gone, victims have accounts

### Problem
This is the biggest change. In v0.3.0 a victim entered a case reference plus an access code. In v0.4.0 everyone has an account (decision D15 in the backend plan). Access codes were too easy to share or guess, and the judges score security.

Your `VictimPortalPage`, `useVictimSessionStore` and five `api.ts` functions are built on the old model. All five calls now return `404`.

### Old → new

| Old (v0.3.0) | New (v0.4.2) |
|---|---|
| Staff issue an access code (`/victim-access`) | Victim signs up with email + password, then verifies the email |
| `POST /api/victim/session` with reference + code | Normal `POST /api/auth/login` (same as staff). `user.role` is `'victim'` |
| One case per session | A victim can have several cases: `GET /api/victim/cases` |
| Public `POST /api/intake` (no login) | `POST /api/victim/cases` (logged in, verified email) |
| `GET /api/victim/chat` | `GET /api/victim/cases/{case_id}/chat` |
| `POST /api/victim/chat/messages` | `POST /api/victim/cases/{case_id}/chat/messages` |
| — | `PATCH /api/victim/cases/{case_id}` victim edits own case |
| — | Phone or paper case: staff press "Invite victim" (`POST /api/cases/{id}/victim-invite`), the victim gets an email link, then `POST /api/victim/claims` |

### New victim flow

```
Sign up ──► email link ──► Verify ──► Log in ──► My cases ──┬─► Report new case
                                                            └─► Open case ──► edit / chat with assistant
```

### Fix: new functions for `api.ts`
Each needs the usual `if (!USE_MOCK)` branch, written the same way as your other calls.

```ts
// victim cases
getMyCases()                          // GET   /api/victim/cases            -> VictimCase[] (newest first)
reportCase(body: VictimReport)        // POST  /api/victim/cases            -> 201 VictimCase
getMyCase(caseId: string)             // GET   /api/victim/cases/{id}       -> VictimCase
updateMyCase(caseId, changes)         // PATCH /api/victim/cases/{id}       -> VictimCase (send expected_version)
claimCase(token: string)              // POST  /api/victim/claims           -> VictimCase  body { token }

// case assistant (chat)
getCaseChat(caseId)                   // GET   /api/victim/cases/{id}/chat
askAssistant(caseId, question, language?) // POST /api/victim/cases/{id}/chat/messages -> 201
rateAnswer(caseId, messageId, feedback: 'helpful' | 'not_helpful')
                                      // POST  /api/victim/cases/{id}/chat/messages/{message_id}/feedback
```

### The report form body changed shape
`submitIntake` sends flat fields (`victim_name`, `victim_phone`, ...). The new body nests the victim and requires consent:

```ts
interface VictimReport {
  bank_id: BankId;                       // 'bank_a' ... 'bank_e'
  victim: {
    name: string;                        // the only required victim field
    phone?: string | null;
    email?: string | null;               // if empty, the server uses the account's email
    address?: string | null;
    preferred_language?: 'en' | 'ja' | 'bn';
  };
  amount: number;                        // a JSON number, not a string
  currency?: string;                     // 3 letters, e.g. 'JPY'
  transfer_date: string;                 // 'YYYY-MM-DD'
  account_number?: string | null;
  account_holder_name?: string | null;
  scam_type: ScamType;
  description?: string | null;
  consent: true;                         // must be literally true, or 422
}
```

Required: `bank_id`, `victim.name`, `amount`, `transfer_date`, `scam_type`, `consent: true`. The response is the new `VictimCase`. Disable the submit button while sending. Repeat reports aren't blocked, but staff see them as `possible_duplicate`.

### The edit form
Every `VictimCase` has `editable_fields`, e.g. `["victim.phone", "victim.email", ...]`. **Build the form from that list**: show those fields as inputs and the rest as read-only text. Contact details stay editable until the case closes; report details only while it's `received`. Changing anything else returns `409 CASE_LOCKED`, with `details.locked_fields`. Show the message from the error, which tells the victim to call the center.

### The chat
- Use a **30-second timeout**: the server waits up to 20 s for the AI.
- It **always returns `201`, even when the AI is down**, so check `answer.answer_type`:

| `answer_type` | Show |
|---|---|
| `grounded` | The answer plus its `citations` (bluebook title, section, page, quote) |
| `passages_only` | "The assistant is busy. Here are the relevant parts of your bank's guide:" plus the passages |
| `no_answer` | "I couldn't answer that. A staff member will reply." (`needs_staff` is true) |
| `refused` | The refusal text. Nothing about other people is revealed |

- `429 RATE_LIMITED` means more than 20 questions per case per hour. Read the `Retry-After` header (seconds) and show "Try again in N minutes".
- `404` now means "not your case" (fixed in v0.4.2).

---

## 6. Account screens that don't exist yet

### Problem
The frontend has login only. v0.4.0 added the full account flow, and none of these screens exist yet:

| Screen | Call | Notes |
|---|---|---|
| Sign up (victims) | `POST /api/auth/signup` `{ email, password, name, preferred_language? }` | Always `202` with the same message, even if the email exists (so nobody can probe emails). Show "Check your email". Password 10–128 characters |
| Verify email (from link) | `POST /api/auth/verify-email` `{ token }` | `400 INVALID_TOKEN` → link expired or used; offer "Send a new link" |
| Resend link | `POST /api/auth/resend-verification` `{ email }` | Always `202` |
| Forgot password | `POST /api/auth/forgot-password` `{ email }` | Always `202` |
| Reset password (from link) | `POST /api/auth/reset-password` `{ token, new_password }` | Link valid 1 hour |
| Accept staff invite (from link) | `POST /api/auth/accept-invitation` `{ token, password }` | Role and bank come from the invite, never from the form |
| Log out | `POST /api/auth/logout` | Ends the session on the server. Then clear local storage |
| Supervisor: invite staff | `POST /api/invitations` `{ email, name, role, bank_id? }` | `role` is `operator`, `supervisor` or `bank_viewer`. `bank_id` is only for `bank_viewer` |
| Supervisor: list or revoke invites | `GET /api/invitations`, `POST /api/invitations/{id}/revoke` | Revoking an accepted invite → `409` |
| Supervisor: deactivate or reactivate a user | `PATCH /api/users/{id}` `{ is_active: false }` | List deactivated users with `GET /api/users?include_inactive=true` |
| Operator: invite victim to a phone case | `POST /api/cases/{id}/victim-invite` (no body) | Button in the case drawer |

Login can now also return `403 EMAIL_NOT_VERIFIED` (show "Verify your email first", plus a resend button). A deactivated account gets the normal `401 INVALID_CREDENTIALS`.

### Email links: our proposal
The backend emails links that open **your** app. We propose these four paths (tell us if you want others):

```
{FRONTEND_URL}/verify-email?token=...
{FRONTEND_URL}/reset-password?token=...
{FRONTEND_URL}/accept-invitation?token=...
{FRONTEND_URL}/claim-case?token=...
```

You don't use a router, so read them once when the app starts. `firebase.json` already sends every path to `index.html`, so these paths open the app.

```ts
// App.tsx, on first load
useEffect(() => {
  const token = new URLSearchParams(window.location.search).get('token');
  if (!token) return;
  const page = window.location.pathname;           // '/verify-email', '/reset-password', ...
  window.history.replaceState({}, '', '/');        // remove the token from the address bar and history
  openTokenScreen(page, token);                    // show the matching screen
}, []);
```

Removing the token from the address bar matters: tokens left in browser history or screenshots can be reused.

---

## 7. Errors, sessions and the `request()` helper

### Problem 1: the app always thinks it's logged in
[useAuthStore.ts:18](../../frontend/src/store/useAuthStore.ts) falls back to `'demo_token_supervisor'`. Against the real backend, that token is invalid, so every call returns `401` while the UI looks logged in.

**Fix:** use the fallback only when `USE_MOCK` is true. In live mode, start logged out. When any call returns `401`, clear the token and user and show the login screen. The session token is opaque (not a JWT) and lasts 8 hours.

### Problem 2: `request()` crashes on non-JSON answers
[api.ts:104](../../frontend/src/services/api.ts) always calls `response.json()`. That throws a confusing `SyntaxError` on an empty body or an HTML error page (e.g. a proxy `502`). It also has no timeout, so a hung request spins forever.

**Fix:**

```ts
const DEFAULT_TIMEOUT_MS = 15_000; // chat calls pass 30_000

async function request<T>(endpoint: string, options: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  // ...headers as now...
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers, signal: controller.signal });
  } catch {
    throw { code: 'NETWORK_ERROR', message: 'Could not reach the server. Check your connection.' };
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }

  if (!response.ok || !json?.success) {
    throw json?.error ?? { code: `HTTP_ERROR_${response.status}`, message: response.statusText || 'Unexpected error' };
  }
  return json as ApiResponse<T>;
}
```

Document downloads (`GET /api/documents/{id}/file`) are files, not JSON. Fetch them with `response.blob()` in a separate helper.

### Error codes to handle in the UI

| Code | When | Suggested UI |
|---|---|---|
| `401 UNAUTHORIZED` | No or expired session | Clear the session, go to login |
| `401 INVALID_CREDENTIALS` | Wrong email or password, or deactivated | "Email or password is wrong" |
| `403 EMAIL_NOT_VERIFIED` | Login or report before verifying | Verify screen with resend button |
| `403 FORBIDDEN` | Role can't do this | Hide the action for that role |
| `404 RESOURCE_NOT_FOUND` | Doesn't exist, **or belongs to another bank or victim** (same answer on purpose) | "Not found" |
| `400 INVALID_TOKEN` | Email link expired or used | Offer a new link |
| `409 STALE_CASE` | Someone changed the case | Section 2 |
| `409 CASE_LOCKED` | Victim edits a locked field | Show the error message |
| `409 CASE_CLOSED` | Write on a closed case | Read-only view |
| `409 INVALID_STATUS_TRANSITION` | Stage move not allowed | Section 3 |
| `409 ALREADY_REVIEWED` | Extraction already reviewed | Refresh the queue |
| `422 VALIDATION_ERROR` | Field errors in `details.fields[]` (`{ field, message }`) | Show each message under its field |
| `422 MISSING_REQUIRED_INFO` | Case not ready for the next stage | Section 3 |
| `429 RATE_LIMITED` | Too many tries | Use the `Retry-After` header |

---

## 8. Type updates for `types/api.ts`

Change the header comment to v0.4.2, then:

```ts
export type Role = 'operator' | 'supervisor' | 'bank_viewer' | 'victim';   // 'victim' is new

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  bank_id: BankId | null;
  email_verified: boolean;   // new
  is_active: boolean;        // new
}

export interface AuthSession {
  token: string;             // opaque, send as Authorization: Bearer <token>
  expires_at: string;        // ISO time, 8 hours after login
  user: User;
}

// Case: add
  version: number;                 // send back as expected_version on every write
  payout_amount: number | null;    // set when closed as paid_out

// VictimCase: add
  id: string;                      // use this in /api/victim/cases/{id} (not the reference)
  version: number;
  editable_fields: string[];       // build the edit form from this
  missing_fields: string[];

export type ErrorCode =
  | 'BAD_REQUEST' | 'UNAUTHORIZED' | 'INVALID_CREDENTIALS' | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND' | 'INVALID_STATUS_TRANSITION' | 'ALREADY_REVIEWED'
  | 'CASE_LOCKED' | 'FILE_TOO_LARGE' | 'VALIDATION_ERROR' | 'MISSING_REQUIRED_INFO'
  | 'RATE_LIMITED' | 'INTERNAL_ERROR'
  | 'INVALID_TOKEN' | 'EMAIL_NOT_VERIFIED' | 'STALE_CASE' | 'CASE_CLOSED';   // last line is new
```

Remove the access-code types (`access_code`, the victim session response). Money (`amount`, `payout_amount`) is always a JSON **number**.

---

## 9. Your XREQ rows and how we'll answer them

These are the four `[PENDING]` rows in AGENTS.md §2. Some point at routes the contract doesn't have:

| XREQ | You asked for | Contract v0.4.2 answer |
|---|---|---|
| `XREQ-001` | `GET/POST /api/cases`, `GET /api/cases/{id}`, `POST /api/cases/{id}/transitions` | All in the contract. The path is **`/transition`** (singular). Bank separation is enforced by the database (a bank viewer only ever sees their bank; other banks' cases return `404`) |
| `XREQ-002` | `POST /api/documents/{id}/extract`, `GET /api/review-queue`, `POST /api/cases/{case_id}/extractions/{extraction_id}/accept` | The first two exist. Accept and reject are one call: **`POST /api/extractions/{id}/review`** with `decision` (section 4) |
| `XREQ-003` | `POST /api/intake`, `POST /api/victim/auth`, `GET /api/victim/cases/{reference}`, `POST /api/victim/chat` | Replaced by accounts (section 5). The victim case route uses the case **`id`**, not the reference |
| `XREQ-004` | `GET /api/analytics/fraud-rings`, `POST /api/analytics/fraud-rings/{account_number}/freeze` | **Not in the contract.** `GET /api/alerts/shared-accounts` already shows accounts reported by more than one bank. A "freeze" would be a new action with real-world impact, so the team needs to decide on it first (who may freeze, how it's audited, how it's undone). Let's discuss before anyone builds it |

We'll update each card in AGENTS.md with these answers. Please change the rows to match once you agree.

---

## 10. Suggested order

1. **Env switch + mock** (section 1). Ten minutes, and it makes everything after this testable.
2. **Types** (section 8).
3. **`transitionCase` + `reviewExtraction` + `expected_version`** (sections 2–4). This fixes the operator side.
4. **`request()` timeout, JSON guard and 401 handling** (section 7).
5. **Victim accounts and portal** (sections 5–6). The biggest piece; the demo script depends on it.
6. **Supervisor invitations and deactivation** (section 6). Good to have for the demo; not blocking.

**Done when** every call in section 0 returns 2xx against the mock with `VITE_USE_MOCK=false`, and the victim flow (sign up → verify → log in → report → chat) works start to finish.

### Demo accounts (password `Demo@1234`, from API_SPEC §8)

| Email | Role |
|---|---|
| `operator1@opscenter.test`, `operator2@opscenter.test` | operator |
| `supervisor@opscenter.test` | supervisor |
| `viewer@bank-a.test`, `viewer@bank-b.test` | bank_viewer |
| `victim1@mail.test` | victim, owns RFR-2026-00042 (verified) |
| `victim2@mail.test` | victim, owns RFR-2026-00051 (received) |
| `victim3@mail.test` | victim, **email not verified** (to test that screen) |

Questions: ask Asif (contract) or Anim (auth and cases). If the contract is wrong or missing something, file an `XREQ` and we'll fix it the same day.
