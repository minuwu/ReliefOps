# ReliefOps — Frontend Client

> 🚀 **Live Production Deployment**: **[https://reliefops.web.app](https://reliefops.web.app)**  
> 📦 **GitHub Release**: **[v1.0.0 Releases](https://github.com/minuwu/BJET-Hackathon/releases)**

Production-grade, accessible, and responsive user interface for the **Multi-Bank Fraud Victim Relief Operations Center**, built strictly to the shared API contract in [`docs/API_SPEC.md`](../docs/API_SPEC.md) (v0.3.0).

---

## 1. Architectural Highlights

- **Vite + React 18 + TypeScript**: Lightning-fast HMR and type-safe component development.
- **Tailwind CSS v4 + Semantic Theming**: Professional, institutional banking ops aesthetics adhering to `frontend-design` and `frontend-ui-engineering` guidelines (calm slate surfaces, deep navy authority, clear status semantic tokens).
- **Zustand State Stores**:
  - `useAuthStore`: Role-based authentication (`operator`, `supervisor`, `bank_viewer`) with 1-click demo account switching.
  - `useCaseStore`: Multi-bank case triage, status transition engine, operator assignment, and note auditing.
  - `useReviewQueueStore`: Human-in-the-Loop AI extraction triage with side-by-side evidence diffs and standard vs. low-confidence lanes.
  - `useVictimSessionStore`: Privacy-quarantined victim session management and bank bluebook RAG chatbot.
- **One-Line Live Integration Switch**:
  - Located at [`src/services/api.ts`](src/services/api.ts):
    ```ts
    export const USE_MOCK: boolean = true; // Set to false to immediately switch to live FastAPI backend or Prism mock
    ```
  - Full realistic demo data seeded for all 5 regional banks (`bank_a` to `bank_e`), demo cases across all 6 stages, shared-account fraud alerts, audit logs, and bluebook citations.

---

## 2. Key Screen Workflows

1. **Case Roster (`/cases`)**:
   - Filter by bank tabs, status pills, or search by reference, victim name, or scam type.
   - Dynamic status transitions driven by server-provided `allowed_transitions` and `allowed_closure_reasons`.
   - Issue victim portal one-time access codes directly to claimants.
2. **AI Document Review Queue (`/review-queue`)**:
   - Human-in-the-Loop review verifying OCR extractions against evidence quotes before accepting into case records.
   - Distinct review lanes for standard vs low-confidence extractions.
3. **Supervisor KPI Dashboard (`/dashboard`)**:
   - High-level case counts, overdue deadlines (&lt;48h and expired), and operator workloads.
   - Multi-victim fraud ring detection tracking suspect destination accounts linked to multiple victims.
4. **Regulatory Audit Trail (`/audit-logs`)**:
   - Immutable audit logs capturing user, AI, victim, and public intake events with metadata diffs.
5. **Public Victim Portal (`/victim`)**:
   - File incident reports via public web intake.
   - Enter reference and access code to track case progress and interact with the Bank Bluebook Assistant (RAG Chat with grounded citations).

---

## 3. Getting Started

```bash
cd frontend
npm install
npm run dev
```

Build for production:
```bash
npm run build
```
