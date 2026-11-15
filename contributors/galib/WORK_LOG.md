# Galib's Work Log

Owner: Galib (`Ga-lib`) — Role: AI / LLM — Branches: `galib/*`

Update after each work session. Newest entry first. Bangladesh time (UTC+6). Link commits/PRs/XREQs.

## 2026-11-15 — incoming cross-functional dispatch (frontend ready, XREQ-002 & XREQ-004)

### Pending XREQs Assigned (AGENTS.md §2)
- **`[XREQ-002]` (P0 Blocker)**: Rule D3 Vision OCR Extraction & HITL Queue (`POST /api/documents/{id}/extract`, `GET /api/review-queue`, `POST /api/cases/{case_id}/extractions/{id}/accept`).
- **`[XREQ-004]` (P1 High, Pairing with Backend)**: Cross-Bank Fraud Ring Topology Graph & Coordinated Freeze API.

### Frontend Status & Handoff
- HITL Review Queue (`/review`) and Optical Review Workbench Modal are fully implemented with side-by-side voucher facsimile, bounding boxes, and confidence color gauges.
- AI service must extract Japanese ATM/Furikomi slips, calculate field confidence (0.0 to 1.0), and provide a deterministic offline fallback (`source: "rules_fallback"`) so the live demo never hangs during judging.
- Ensure human operator verification is required before any extracted field modifies the case record (Rule D3).

---

## 2026-11-14

### Completed
- Cloned the repository, enabled the pre-push sync hook, and registered as a contributor (AGENTS.md §5, TEAM_INSTRUCTIONS.md, README, contributors index).

### Next
- Agree the AI feature and model/provider at kickoff; stub the AI endpoint with a deterministic fallback.

### Blockers / handoff
- None.

### Related issues / commits / PRs
- Branch `galib/onboarding`
