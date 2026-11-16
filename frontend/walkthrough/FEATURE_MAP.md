# ReliefOps Feature Map & UI Vocabulary Site Map

> **Standard Reference for Agents & Testers**: This document provides the complete site map and UI component taxonomy for the ReliefOps frontend (`frontend/`). It indexes every URL path registered in `src/routes/paths.ts` and `src/App.tsx`, defines the role-based access control matrix, outlines on-screen visual regions using shared vocabulary names, describes user actions, and specifies data dependencies.

---

## 1. Role-Based Access Control (RBAC) Matrix

| Role | Domain / Institution | Default Home Route | Accessible Application Routes |
| :--- | :--- | :--- | :--- |
| **`operator`** | Shared Operations Center Staff | `/cases` | `/cases`, `/cases/:caseId`, `/review`, `/review/:extractionId`, `/knowledge` |
| **`supervisor`** | Operations Center Lead / Supervisor | `/dashboard` | `/dashboard`, `/cases`, `/cases/:caseId`, `/review`, `/review/:extractionId`, `/audit`, `/admin/users`, `/knowledge` |
| **`bank_viewer`** | Member Regional Bank Compliance Officer (e.g. Aster, Birch, Cobalt, Dune, Ember) | `/cases` | `/cases`, `/cases/:caseId` (isolated to own bank only), `/dashboard` (own bank metrics), `/audit`, `/knowledge` |
| **`victim`** | Defrauded Citizen / Scam Victim | `/portal` | `/portal`, `/portal/report`, `/portal/cases/:caseId`, `/claim-case` |
| **Public / Unauthenticated** | Any visitor / link recipient | `/login` | `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`, `/accept-invitation` |

---

## 2. Global Shell & Persistent Overlays

These components wrap every page in `src/components/layout/AppLayout.tsx`.

### 2.1 Navigation Bar (`Navbar`)
- **Shared Vocabulary**: `Navbar`, `Brand Link`, `Primary Nav`, `Review Badge`, `Demo Guide Button`, `User Menu Button`, `User Dropdown Menu`, `Demo Accounts Switcher`, `Logout Button`, `Mobile Menu Toggle`, `Mobile Drawer`.
- **Visibility**: Always rendered across all routes.
- **On-Screen Elements**:
  - `Brand Link`: Logo with shield icon + "RELIEFOPS" linking to role home.
  - `Primary Nav`: Dynamic links filtered by `user.role`:
    - `Dashboard` (`/dashboard`): Supervisors & Bank Viewers.
    - `Cases` (`/cases`): Operators, Supervisors, Bank Viewers.
    - `Review queue` (`/review`): Operators & Supervisors; displays `Review Badge` indicating count of pending AI extractions.
    - `Audit log` (`/audit`): Supervisors & Bank Viewers.
    - `Knowledge base` (`/knowledge`): Operators, Supervisors, Bank Viewers.
    - `Team` (`/admin/users`): Supervisors only.
    - `My cases` (`/portal`): Victims.
    - `Report a scam` (`/portal/report`): Victims.
  - `Demo Guide Button`: "Demo guide" button triggering `DemoWalkthroughModal` (mock mode only).
  - `User Menu Button`: Displays user name and bank/role tag (e.g. `Operator One (operator)`).
  - `User Dropdown Menu`: Contains user details, `Demo Accounts Switcher` (1-click account hopping in mock mode), and `Logout Button`.
  - `Mobile Drawer`: Collapsible responsive menu for viewport widths under 1280px (`xl`).
- **Data Needed**: `useAuthStore` (`user`), `useReviewQueueStore` (`queue.length`).

### 2.2 Footer (`Footer`)
- **Shared Vocabulary**: `Footer`, `Tagline`, `DataModeSwitch`, `Staff Login Link`, `Report Link`.
- **Visibility**: Bottom of all pages.
- **On-Screen Elements**:
  - `Tagline`: "ReliefOps · Fraud relief operations for partner banks."
  - `DataModeSwitch`: Segmented button toggle between **Demo** (in-browser mock engine) and **Live** (remote FastAPI server).
  - Quick links to `/portal/report` and `/login`.

### 2.3 Floating & Global Overlays
- **`DemoWalkthroughModal`**: Interactive 6-scenario walkthrough guide explaining the Japanese Furikomi Fraud Relief Act workflow with 1-click role simulation.
- **`DemoInbox`**: Floating demo mail drawer capturing simulated verification emails, password resets, and staff invitations.
- **`Toaster`**: Fixed bottom-right toast message container for system notifications (success, error, info).

---

## 3. Screen-by-Screen Feature Map

---

### 3.1 Login Page
- **URL**: `/login` (`PATHS.login`)
- **Allowed Roles**: Public / Unauthenticated (Authenticated users automatically redirect to `homeFor(user.role)`).
- **Purpose**: Authenticates bank staff, center operators, supervisors, and registered scam victims.
- **Shared Vocabulary**: `Auth Card`, `Login Form`, `Email Input`, `Password Input`, `Submit Button`, `Form Error Notice`, `Resend Verification Button`, `Demo Accounts Grid`, `Quick Fill Buttons`.
- **Main Actions**:
  - Enter credentials and click `LOG IN`.
  - In demo mode (`USE_MOCK=true`): Click any button in `Demo Accounts Grid` (Operator 1, Operator 2, Supervisor Sato, Aster Viewer, Birch Viewer, Victim 1, Victim 2) to auto-fill credentials.
  - Click `Create an account` link to navigate to `/signup`.
  - Click `Forgot your password?` link to navigate to `/forgot-password`.
  - Click `SEND THE VERIFICATION EMAIL AGAIN` if account is unverified (`EMAIL_NOT_VERIFIED`).
- **Data Needed**: `POST /api/auth/login`. In mock mode: `DEMO_USERS`, `DEMO_VICTIMS`, `DEMO_PASSWORD`.

---

### 3.2 Victim Signup Page
- **URL**: `/signup` (`PATHS.signup`)
- **Allowed Roles**: Public / Unauthenticated.
- **Purpose**: Self-service registration for fraud victims to file and track claims. Staff accounts are invite-only.
- **Shared Vocabulary**: `Auth Card`, `Signup Form`, `Full Name Input`, `Email Input`, `Password Input`, `Preferred Language Select`, `Create Account Button`, `Success Confirmation Notice`.
- **Main Actions**:
  - Fill name, email, password (8-128 chars), and select language (`ja`, `en`, `zh`, `tl`, `pt`).
  - Submit registration to receive email confirmation link.
- **Data Needed**: `POST /api/auth/signup`.

---

### 3.3 Email Link Handlers (Auth Flow)
- **URLs**:
  - `/verify-email` (`PATHS.verifyEmail`)
  - `/forgot-password` (`PATHS.forgotPassword`)
  - `/reset-password` (`PATHS.resetPassword`)
  - `/accept-invitation` (`PATHS.acceptInvitation`)
  - `/claim-case` (`PATHS.claimCase`)
- **Allowed Roles**: Public (token-based query param `?token=...`), except `/claim-case` which requires victim authentication.
- **Shared Vocabulary**: `Auth Card`, `Token Processor`, `Password Reset Form`, `Invitation Acceptance Form`, `Claim Case Card`, `Outcome Notice`.
- **Main Actions**:
  - `/verify-email`: Automatically verifies account via `GET /api/auth/verify-email?token=...`.
  - `/forgot-password`: Requests password reset email via `POST /api/auth/forgot-password`.
  - `/reset-password`: Sets new password with confirmation via `POST /api/auth/reset-password`.
  - `/accept-invitation`: Sets initial password for invited staff via `POST /api/auth/accept-invitation`.
  - `/claim-case`: Associates an existing paper or phone case with the signed-in victim via `POST /api/victim/claims`.
- **Data Needed**: Corresponding `authApi` / `victimApi` endpoints with one-time tokens.

---

### 3.4 Operations Center Workstation (Cases List & Detail)
- **URL**: `/cases` and `/cases/:caseId` (`PATHS.cases`, `PATHS.caseDetail(id)`)
- **Allowed Roles**: `operator`, `supervisor`, `bank_viewer` (Strict RLS: `bank_viewer` only sees cases belonging to their own `bank_id`).
- **Purpose**: Central triage and workstation for all relief claims under the Furikomi Fraud Relief Act.
- **Shared Vocabulary**:
  - `Workstation Header`: Page title, Refresh button, `New Case Button` (operators & supervisors only).
  - `Stat Strip` / `Quick Metrics`: Total claims count, overdue count, due soon count, AI pending count.
  - `Status Tabs`: Filter strip (`All claims`, `1. Received`, `2. Verified`, `3. Account check`, `4. Notice published`, `5. Payout review`, `6. Closed`).
  - `Filter Bar`: Text search input (`/` shortcut), Bank filter dropdown (disabled for bank viewers), Assignee filter, Scam type filter.
  - `Sort Dropdown`: Sort by deadline, claim amount (desc/asc), or reported date.
  - `Case Table`: Accessible table rendering reference badges, bank names, victim names, yen amounts, status badges, statutory clock badges, flags, and `Action Button`.
  - `Keyboard Navigation Indicator`: Visual indicator (`▶`) highlighting currently focused case row (`j`/`k` or `ArrowUp`/`ArrowDown`, `Enter` to open).
- **Main Actions**:
  - Click any row or press `Enter` to open `CaseDetailModal`.
  - Search claims by victim name, reference, or bank.
  - Click `New case` to launch `CaseIntakeModal`.
  - Switch status tab filters or sort orders.
- **Data Needed**: `GET /api/cases`, `GET /api/banks`, `GET /api/cases/:caseId`.

---

### 3.5 Case Detail Modal (`CaseDetailModal`)
- **Trigger**: Mounted when `:caseId` param is present in `/cases/:caseId` or selected from dashboard/tables.
- **Allowed Roles**: `operator`, `supervisor`, `bank_viewer` (read-only for bank viewer; cross-bank access yields 404).
- **Shared Vocabulary**:
  - `Modal Header`: Case reference, Bank badge, Victim name, Assignment dropdown (`Assign operator`).
  - `6-Stage Statutory Lifecycle Stepper`: Interactive visual roadmap showing current stage (`received` → `verified` → `account_check` → `notice_published` → `payout_review` → `closed`) and closure outcome if closed.
  - `Tab Bar`: `Overview`, `Documents (<count>)`, `Messages`, `History`.
  - `Overview Tab Panel`:
    - `Statutory Workflow Actions`: Action buttons generated dynamically from `caseItem.allowed_transitions` (e.g. `Move to account check`, `Close case`).
    - `Invite Victim Button`: Sends claim portal invitation link to victim's email.
    - `Case Facts Overview`: Definition lists (`<dl>`) showing victim details (phone, email, language), scam incident facts (transfer date, destination account, scam category, description).
    - `Operator Notes Section`: Log of internal operator remarks and input form to append timestamped notes.
  - `Documents Tab Panel`:
    - `Document List`: Cards for attached transfer receipts, bank statements, police reports.
    - `Extraction Badge`: Shows OCR status (`Needs review (XX%)`, `Accepted`, `Rejected`, `No OCR`).
    - `Document Actions`: `Download` and `Run AI OCR` / `Re-extract`.
    - `Upload Evidence Form`: File selector (`.pdf,.png,.jpg,.txt`, max 10MB) and document type selector.
  - `Messages Tab Panel`:
    - `Staff Chat Panel`: Real-time secure two-way conversation between operator and victim, including escalation notice and operator reply composer.
  - `History Tab Panel`:
    - `Case Audit Log`: Immutable timeline of status transitions, document uploads, and human verifications.
  - `CaseTransitionModal`: Confirmation dialog for advancing milestones or recording closures (with required closure reason and payout amounts).
- **Data Needed**: `GET /api/cases/:id`, `POST /api/cases/:id/transition`, `POST /api/cases/:id/assign`, `POST /api/cases/:id/notes`, `POST /api/cases/:id/documents`, `GET /api/cases/:id/chat`.

---

### 3.6 Human-In-The-Loop AI Review Queue
- **URL**: `/review` and `/review/:extractionId` (`PATHS.review`, `PATHS.reviewDetail(id)`)
- **Allowed Roles**: `operator`, `supervisor`.
- **Purpose**: Statutory Rule D3 Human-In-The-Loop (HITL) gatekeeper. Ensures AI OCR models never alter claims or ledgers without human certification.
- **Shared Vocabulary**:
  - `Queue Header`: Page title, description, and `REFRESH QUEUE` button.
  - `Notice Banner`: Notification when an extraction was accepted/rejected or not found.
  - `Lane Filter Bar`: `All`, `Standard`, `Low confidence` (< 85% aggregate score).
  - `Review Table`: Lists pending extractions with Case reference, Document filename, Bank, Upload timestamp, Confidence score percentage, Lane badge, and `Review` action button.
- **Main Actions**:
  - Filter queue by confidence lane.
  - Click `Review` to open `ExtractionReviewModal` (`/review/:extractionId`).
- **Data Needed**: `GET /api/review-queue`, `GET /api/extractions/:id`.

---

### 3.7 Extraction Review Modal (`ExtractionReviewModal`)
- **Trigger**: Mounted when `:extractionId` is in `/review/:extractionId` or clicked from case document panel.
- **Allowed Roles**: `operator`, `supervisor`.
- **Shared Vocabulary**:
  - `Review Modal Header`: Document name, Overall confidence badge, Rule D3 statutory disclaimer ("AI extraction requires human verification").
  - `Split Pane / Optical Layout`:
    - `Left Pane (Optical Preview)`: Rendered preview of Furikomi slip or transfer voucher with OCR field highlighting.
    - `Right Pane (Verification Form)`: Editable field inputs for `amount`, `currency`, `transfer_date`, `account_number`, `account_holder_name`.
    - `Granular Field Scores`: Confidence indicator badge next to each field (green for high confidence, red alert for low confidence).
    - `Reviewer Note Input`: Optional justification note for audit logs.
    - `Action Buttons`: `REJECT EXTRACTION` (outline destructive) and `ACCEPT & UPDATE RECORD` (primary high-contrast button).
- **Main Actions**:
  - Inspect OCR values against document scan.
  - Correct any misread characters.
  - Click `ACCEPT & UPDATE RECORD` to commit verified values to the official case facts.
  - Click `REJECT EXTRACTION` to discard faulty scan.
- **Data Needed**: `GET /api/extractions/:id`, `POST /api/extractions/:id/review`.

---

### 3.8 Supervisor Control Tower (Dashboard)
- **URL**: `/dashboard` (`PATHS.dashboard`)
- **Allowed Roles**: `supervisor`, `bank_viewer` (bank viewer sees aggregated stats scoped to their institution; supervisor sees full system).
- **Purpose**: Executive oversight, statutory deadline monitoring, and cross-bank syndicate detection.
- **Shared Vocabulary**:
  - `Dashboard Header`: Title, Review Queue shortcut with counter badge, `New Case` button (supervisor only).
  - `Stat Strip`: Four key operational metrics:
    - `Active Claims`: Total volume + total claimed JPY.
    - `Overdue (SLA Breached)`: Red alert counter linking to filtered cases.
    - `Due Soon (48h Clock)`: Amber warning counter.
    - `AI Review Pending`: Counter of unverified Furikomi OCR documents.
  - `Cases by Status Breakdown`: Horizontal stage distribution cards showing case volume at each of the 6 legal stages.
  - `Needs Attention (Urgent Cases)`: Quick-access table of cases with breached or impending statutory deadlines.
  - `Shared Beneficiary Accounts (Syndicate Detection)`: Supervisor-only graph intelligence panel flagging accounts receiving fraudulent funds across multiple regional banks (e.g. Aster Bank and Birch Bank).
- **Main Actions**:
  - Click any stat card to navigate to `/cases` filtered by deadline or status.
  - Click any urgent case to jump to case details.
  - Inspect shared mule account alerts to identify coordinated crime rings.
- **Data Needed**: `GET /api/dashboard/stats`, `GET /api/alerts/shared-accounts`, `GET /api/cases`.

---

### 3.9 Audit Ledger (`AuditLogsPage`)
- **URL**: `/audit` (`PATHS.audit`)
- **Allowed Roles**: `supervisor`, `bank_viewer`.
- **Purpose**: FSA regulatory compliance and cryptographic accountability log. Every user action, AI extraction, and state transition is permanently recorded.
- **Shared Vocabulary**:
  - `Audit Header`: Title and `REFRESH LOGS` button.
  - `Action Filter Bar`: Filter tabs (`All actions`, `Status changes`, `AI extractions`, `Chat escalations`, `Case creations`).
  - `Audit Table`: Columns for `Timestamp`, `Actor` (with icon distinguishing User, AI assistant, Victim, or System), `Action`, `Target Case`, `Details / Metadata diff`.
  - `Pagination Controls`: Page size, current page indicator, `Previous` / `Next` buttons.
- **Main Actions**:
  - Filter audit log by category of action.
  - Inspect detailed JSON metadata for transitions and overrides.
- **Data Needed**: `GET /api/audit-logs`.

---

### 3.10 Team Management (`AdminUsersPage`)
- **URL**: `/admin/users` (`PATHS.adminUsers`)
- **Allowed Roles**: `supervisor` only.
- **Purpose**: Manage operations center operators and invite regional bank compliance viewers.
- **Shared Vocabulary**:
  - `Invite Staff Panel`: Form to send time-limited email invitations (Name, Email, Role selector, Bank assignment for bank viewers).
  - `Pending Invitations Table`: Lists unredeemed invitations with expiration countdown, `Revoke` action, and `Resend` action.
  - `Active Team Table`: Lists registered operators, supervisors, and bank viewers with status toggle (`Active` / `Suspended`).
- **Main Actions**:
  - Send staff invitation email.
  - Revoke pending invitation.
  - Toggle user active status.
- **Data Needed**: `GET /api/users`, `POST /api/invitations`, `GET /api/invitations`, `DELETE /api/invitations/:id`.

---

### 3.11 Bluebook Knowledge Base (`KnowledgeBasePage`)
- **URL**: `/knowledge` (`PATHS.knowledge`)
- **Allowed Roles**: `operator`, `supervisor`, `bank_viewer`.
- **Purpose**: Standard operating procedures, legal guidelines (Act No. 133), and bank-specific Furikomi handling rules.
- **Shared Vocabulary**:
  - `Knowledge Base Header`: Title and bank filter dropdown.
  - `Document Status Filter`: `All`, `Published`, `Draft`, `Archived`.
  - `Upload Bluebook Panel`: Upload area for PDF/DOC SOP documents (supervisors only).
  - `Document Cards / Table`: Document title, associated bank, version, publication date, status badge.
  - `Document Actions`: `Download`, `Publish` (supervisors), `Archive` (supervisors).
- **Main Actions**:
  - Browse and download official bank guidance.
  - Supervisors upload new SOP editions and publish to team.
- **Data Needed**: `GET /api/kb`, `POST /api/kb`, `POST /api/kb/:id/publish`, `POST /api/kb/:id/archive`.

---

### 3.12 Citizen Portal Home (`PortalHomePage`)
- **URL**: `/portal` (`PATHS.portal`)
- **Allowed Roles**: `victim` only.
- **Purpose**: Citizen self-service portal for scam victims to track relief claims without calling call centers.
- **Shared Vocabulary**:
  - `Portal Header`: Greeting ("Hello, [Victim Name]"), subtitle, and `Report a scam` CTA button.
  - `Case Cards List`: Cards for each submitted claim showing:
    - Bank Name and Case Reference (`RFR-2026-XXXXX`).
    - Total Claimed Amount (Formatted in Yen: `¥XXX,XXX`).
    - `6-Stage Progress Indicator`: Visual 6-step progress bar showing current legal milestone (`Step X of 6 · [Stage Name]`).
    - Missing fields warning alert (if information is needed).
    - `Open case` link button.
  - `Empty State`: Friendly instructions and action button when no claims are registered.
- **Main Actions**:
  - Click `Open case` to view tracking details (`/portal/cases/:caseId`).
  - Click `Report a scam` to submit a new report.
- **Data Needed**: `GET /api/victim/cases`.

---

### 3.13 Citizen Incident Reporting (`ReportCasePage`)
- **URL**: `/portal/report` (`PATHS.portalReport`)
- **Allowed Roles**: `victim` only (or redirected from intake).
- **Purpose**: Step-by-step statutory incident report form for victims to register fraud claims.
- **Shared Vocabulary**:
  - `Report Header`: Title ("Report a transfer scam") and statutory privacy assurance.
  - `Section 1: Target Destination Bank`: Bank selector choosing which regional bank held the fraudulent destination account.
  - `Section 2: Contact Details`: Victim name, phone number, email, street address, preferred language.
  - `Section 3: Incident & Transfer Details`: Transfer amount (JPY), date of transfer, destination account number, payee/holder name, scam category (`impersonation`, `investment`, `billing_fraud`, `romance`, `other`), narrative description.
  - `Section 4: Legal Consent Checkbox`: Statutory declaration under Law No. 133.
  - `Submit Button`: `Submit incident report`.
- **Main Actions**:
  - Fill incident facts and submit claim. Automatically creates case and redirects to `/portal/cases/:id`.
- **Data Needed**: `GET /api/banks`, `POST /api/victim/cases`.

---

### 3.14 Citizen Case Tracker & Chat (`PortalCasePage`)
- **URL**: `/portal/cases/:caseId` (`PATHS.portalCase(id)`)
- **Allowed Roles**: `victim` (scoped strictly to own cases).
- **Purpose**: Real-time statutory progress tracking and two-way communication channel with the operations center.
- **Shared Vocabulary**:
  - `Case Header`: Reference code, Bank name, Claimed amount, Back to portal link.
  - `Stage Tracker`: Detailed 6-stage lifecycle card with descriptions for each stage:
    1. *Received*: Incident logged, preliminary triage.
    2. *Verified*: Evidence confirmed, bank verification underway.
    3. *Account Check*: Offender account freeze verified with receiving bank.
    4. *Notice Published*: Official public notice published in official gazette / FSA registry.
    5. *Payout Review*: Restitution pool determined, pro-rata share calculated.
    6. *Closed*: Restitution disbursed or claim resolved.
  - `Missing Information Form`: Form enabling victim to provide requested missing details (e.g. transfer slip, exact date, destination account).
  - `Locked Claim Details`: Read-only view of verified incident facts that cannot be altered unilaterally.
  - `Citizen Chat Interface`: Direct messaging thread with operations center staff, including option to mark questions resolved or request human escalation.
- **Main Actions**:
  - Review status and statutory timeline.
  - Provide missing fields.
  - Send messages and questions to assigned staff.
- **Data Needed**: `GET /api/victim/cases/:id`, `PATCH /api/victim/cases/:id`, `GET /api/victim/cases/:id/chat`, `POST /api/victim/cases/:id/chat/messages`.

---

### 3.15 404 Not Found Page (`NotFoundPage`)
- **URL**: `*` (Catch-all for unmatched routes)
- **Allowed Roles**: Any.
- **Purpose**: Friendly error screen for missing or unauthorized routes without crashing the app.
- **Shared Vocabulary**: `404 Heading` ("Page not found"), Explanation text ("This address does not exist, or you do not have access to it."), `Go to my home page Button`.
- **Main Actions**: Click `Go to my home page` to navigate to `homeFor(user.role)`.
- **Data Needed**: None (`useAuthStore` for home route).

---

## 4. UI Standards & Visual Guidelines Reference
- **Color Palette**:
  - Paper Sand Background: `#F8F4E8`
  - High-Contrast Onyx: `#09090B`
  - Fluorescent Acid Accent: `#D2E823`
  - Muted Zinc: `#52525B`
  - Alert Vermilion (SLA Breaches & Errors): `#FF334B`
- **Typography**:
  - Display / Headlines: `Dela Gothic One`
  - UI & Body: `Space Grotesk`
  - Data, Numbers & Codes: `Space Mono` / Monospace
- **Borders & Shadows**:
  - Neo-Brutalist 2px solid Onyx borders (`border-2 border-[#09090B]`)
  - Hard drop shadows without blur (`shadow-hard`: `3px 3px 0px #09090B`)
