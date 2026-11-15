# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19, TypeScript, Vite, Tailwind v4, zustand; FastAPI and PostgreSQL backend; Firebase Hosting at https://reliefops.web.app.

## Users

- Operations-center operators: process cases across member banks, enter phone and paper reports, and review AI document extractions.
- Operations-center supervisors: monitor center-wide queues, SLA deadlines, assign staff, approve payout and rejection closures, and manage knowledge base documents.
- Bank compliance viewers: regional bank compliance officers (from member banks) who view only their own institution's cases and audit records with strict zero-leakage isolation.
- Administrators: manage staff invitations, role assignments, and tenant provisioning. (inferred)
- Fraud victims: defrauded citizens who lost funds to bank transfer scams, submitting reports via a dedicated self-service portal, tracking the 6-stage relief lifecycle, and asking questions via a bank-specific assistant.
- Elderly citizens disproportionately impacted by remittance fraud requiring plain, high-clarity guidance. (inferred)

## Product Purpose

ReliefOps provides a shared operations center for Japanese regional banks executing the Remittance Fraud Relief Act (Act No. 133). It replaces slow, error-prone paper, telephone, and spreadsheet workflows with an auditable digital platform. Success means accelerating case resolution from 6–12 months to weeks, eliminating statutory deadline breaches, preserving banking secrecy between competing institutions, and ensuring human oversight over all AI operations.

## Positioning

Unlike generic CRM or case management systems, ReliefOps is purpose-built for multi-bank statutory fraud relief under Japanese financial regulations. It provides mathematical tenant isolation via database row-level security (cross-bank requests return 404 to prevent existence snooping), automated statutory SLA timers, and assistive vision OCR strictly bound by human-in-the-loop statutory compliance (Rule D3).

## Operating Context

- Operates within Japanese banking and Financial Services Agency regulatory standards.
- Manages the statutory 6-stage lifecycle: `received` -> `verified` -> `account_check` -> `notice_published` -> `payout_review` -> `closed`.
- Enforces statutory stage deadlines with automated states: `on_track`, `due_soon`, and `overdue`.
- Ingests physical ATM vouchers, Furikomi transfer slips, police reports, and digital self-service submissions.
- Serves two distinct environments: high-density case workstation for operations staff, and a reassuring, low-stress tracking portal for victims.

## Capabilities and Constraints

- Role-based access control across four core roles: operator, supervisor, bank viewer, and victim.
- Multi-tenant bank separation across member banks (`bank_a` through `bank_e`) with zero cross-tenant leakage.
- Assistive vision extraction for ATM vouchers (amount, currency, transfer date, account number, payee name) with a human review queue for confidence < 0.85 and deterministic rules fallback.
- Concurrency control via optimistic locking (`expected_version` returning `409 STALE_CASE` on conflicts).
- Audit trail recording all case actions, status transitions, and viewing events.
- Anti-goals: no autonomous financial decisions by AI, no crypto/hype styling, no gamification, no jargon ("syndicate", "telemetry", "command center"), and no decorative elements that distract from case data.
- Open decision: multi-bank automated account freeze coordination is deferred pending legal authorization.

## Brand Commitments

- Name: ReliefOps.
- Tone: calm, trustworthy, precise fintech operations tool. Reassuring and plain for victims.
- Palette: cream neo-brutalist surfaces (`#F8F4E8`), ink text and borders (`#09090B`), acid accent (`#D2E823`), danger coral (`#FF334B`), and hard offset shadows.
- Typography: Dela Gothic One restricted strictly to page titles; Space Grotesk for body, data, and interactive elements.
- Decluttered visual discipline: strictly no glitch text, stickers, marquees, custom cursors, or decorative noise.

## Evidence on Hand

- Synthetic seed dataset containing cases, documents, and accounts across 5 regional banks (`backend/app/seed.py`).
- Formal API specification and OpenAPI 3.1 contract (`docs/API_SPEC.md`, `docs/openapi.yaml`).
- Interactive demo walkthrough covering 6 user scenarios (`frontend/walkthrough/README.md`, `docs/DEMO_WALKTHROUGH.md`).
- Live production web deployment at https://reliefops.web.app.
- Absence: strictly zero real customer or banking data; all demonstration data is synthetic per hackathon rules.

## Product Principles

- Human agency over automation: AI assists through extraction and summarization, but certified human operators retain sole authority over case status and financial decisions.
- Inviolable institutional boundaries: tenant confidentiality between member banks is absolute; cross-tenant disclosure is treated as a critical system failure.
- Calm clarity over visual spectacle: high data density and contrast for operators; reassuring simplicity for distressed citizens.
- Continuous statutory auditability: every state transition, operator touchpoint, and override produces an immutable audit record.

## Accessibility & Inclusion

- Plain Japanese and English bilingual interface support across the victim portal. (inferred)
- High-contrast, legible typography with clear visual hierarchy for high-stress casework environments. (inferred)
- Resilient operation: core workflows remain fully operable even when AI services or external APIs are unavailable.
