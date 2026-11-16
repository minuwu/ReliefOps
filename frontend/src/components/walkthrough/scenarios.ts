import {
  LifeBuoy,
  Inbox,
  BrainCircuit,
  BarChart3,
  Building2,
  History,
} from 'lucide-react';
import { PATHS } from '@/routes/paths';

export interface ScenarioStep {
  number: string;
  action: string;
  outcome: string;
}

export interface Scenario {
  id: string;
  badge: string;
  icon: typeof LifeBuoy;
  title: string;
  subtitle: string;
  persona: string;
  roleDescription: string;
  targetPath: string;
  userEmail: string;
  story: string;
  goal: string;
  steps: ScenarioStep[];
  actionLabel: string;
  systemGuarantee: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'victim',
    badge: 'Citizen Journey',
    icon: LifeBuoy,
    title: 'Victim Enactment & Restitution Tracking',
    subtitle: 'Citizen Self-Service Under Furikomi Relief Act (Law No. 133)',
    persona: 'Haruto Tanaka (67, Scam Victim, Shibuya Tokyo)',
    roleDescription: 'Defrauded citizen seeking recovery of illicitly transferred savings',
    targetPath: PATHS.portal,
    userEmail: 'victim2@mail.test',
    story:
      'Haruto received a fraudulent phone call from an imposter claiming his national pension was locked, directing him to transfer ¥1,450,000 into an escrow account at Cobalt Regional Bank. Realizing he was defrauded, Haruto accesses the ReliefOps Citizen Portal.',
    goal: 'Submit an emergency relief claim, upload the ATM Furikomi receipt, track the 6-stage statutory recovery lifecycle, and communicate with triage staff.',
    steps: [
      {
        number: '01',
        action: 'Log In to the Victim Portal',
        outcome:
          'Log in as victim2@mail.test. Case RFR-2026-00051 is linked to that account. New victims sign up, confirm their email, and report online.',
      },
      {
        number: '02',
        action: 'Inspect 6-Stage Statutory Lifecycle Stepper',
        outcome:
          'View real-time progress: Received → Verified → Account Check → Notice Published → Payout Review → Closed.',
      },
      {
        number: '03',
        action: 'Correct Details Within the Allowed Window',
        outcome:
          'Edit contact details at any stage. Report details (amount, account, scam type) lock once staff verify the case.',
      },
      {
        number: '04',
        action: 'Ask the Assistant About the Case',
        outcome:
          'Answers cite bank rules. If the assistant cannot answer, staff are notified and reply in the same thread.',
      },
    ],
    actionLabel: 'Launch Citizen Journey (Victim Portal)',
    systemGuarantee:
      'Zero sensitive account disclosure. Victims only see statutory milestones and authorized case updates.',
  },
  {
    id: 'operator',
    badge: 'Operator Triage',
    icon: Inbox,
    title: 'Center Intake Specialist & Case Triage',
    subtitle: 'Workstation Prioritization, SLA Timers & Inter-Bank Freezes',
    persona: 'Operator One (Tokyo Shared Operations Center)',
    roleDescription: 'Frontline triage specialist managing high-velocity cross-bank queues',
    targetPath: PATHS.cases,
    userEmail: 'operator1@opscenter.test',
    story:
      'Operator One oversees the shared intake workstation. With incoming claims from 5 regional banks, they prioritize cases facing 48-hour statutory deadlines and issue freeze orders to recipient financial institutions.',
    goal: 'Filter and prioritize urgent cases, inspect victim documentation, review suspect destination accounts, and progress cases from Received to Verified and Account Check.',
    steps: [
      {
        number: '01',
        action: 'Filter Workstation by SLA Urgency & Bank',
        outcome:
          'Sort by Overdue or Approaching SLA to target cases needing immediate regulatory escalation.',
      },
      {
        number: '02',
        action: 'Open Case Detail Drawer for RFR-2026-00042',
        outcome:
          'Inspect victim narrative, scam category (Impersonation), and suspect destination account.',
      },
      {
        number: '03',
        action: 'Review Attached Documents & OCR Badges',
        outcome:
          'Verify uploaded ATM Furikomi vouchers and check optical confidence indicators.',
      },
      {
        number: '04',
        action: 'Execute Lifecycle Status Transition',
        outcome:
          'Advance case status to Account Check and dispatch destination account freeze notice.',
      },
    ],
    actionLabel: 'Launch Operator Workstation (Cases)',
    systemGuarantee:
      'SLA enforcement engine ensures every case is accounted for with deterministic countdown timers.',
  },
  {
    id: 'hitl',
    badge: 'Human-in-the-Loop AI',
    icon: BrainCircuit,
    title: 'Document Optical Workbench & HITL Verification',
    subtitle: 'Rule D3: Mandatory Human Certification for All AI Extractions',
    persona: 'Operator Two (Certified Optical & Forensic Reviewer)',
    roleDescription: 'Auditor verifying low-confidence document OCR extractions before ledger commit',
    targetPath: PATHS.review,
    userEmail: 'operator2@opscenter.test',
    story:
      'A victim submitted an ATM receipt with faint thermal print. The Vision OCR engine processed the voucher but scored 68% confidence on the recipient account number. Under statutory rules, AI can never commit data to banking records without human sign-off.',
    goal: 'Inspect low-confidence extractions, compare raw optical voucher facsimiles with extracted text, override ambiguities, and certify verified data.',
    steps: [
      {
        number: '01',
        action: 'Inspect HITL Triage Queue & Confidence Lanes',
        outcome:
          'Review Standard Lane (>85% confidence) vs Low Confidence Lane (<85% requiring manual audit).',
      },
      {
        number: '02',
        action: 'Open Optical Review Workbench for Case DOC-2026-0089',
        outcome:
          'Launch side-by-side view with optical voucher facsimile on the left and form on the right.',
      },
      {
        number: '03',
        action: 'Compare Field Confidence Scores & Bounding Boxes',
        outcome:
          'Verify Transfer Amount (¥1,450,000), Bank Name, and inspect flagged Payee Account Number.',
      },
      {
        number: '04',
        action: 'Approve & Certify HITL Extraction',
        outcome:
          'Commit certified values to the legal record, updating case facts and logging audit trail.',
      },
    ],
    actionLabel: 'Launch HITL Review Queue (AI OCR)',
    systemGuarantee:
      'AI proposes, Human disposes. No financial or legal claim is ever altered autonomously.',
  },
  {
    id: 'supervisor',
    badge: 'Supervisor overview',
    icon: BarChart3,
    title: 'Operations dashboard and shared beneficiary accounts',
    subtitle: 'Multi-bank oversight and cross-bank account alerts',
    persona: 'Supervisor Sato (Chief Operations Officer, Tokyo Ops Hub)',
    roleDescription: 'Operations supervisor reviewing metrics, deadlines, and cross-bank accounts',
    targetPath: PATHS.dashboard,
    userEmail: 'supervisor@opscenter.test',
    story:
      'Supervisor Sato manages the shared operations center for member banks. He tracks center-wide metrics, monitors deadlines, and investigates beneficiary accounts appearing across multiple banks.',
    goal: 'Monitor center-wide metrics, review urgent deadlines, find the account under Shared beneficiary accounts, and press Inspect to open the linked case.',
    steps: [
      {
        number: '01',
        action: 'Inspect operations metrics grid',
        outcome:
          'Review active cases, protected funds, overdue cases, and deadline adherence.',
      },
      {
        number: '02',
        action: 'Examine urgent cases list',
        outcome:
          'Track countdown timers for cases approaching regulatory deadlines.',
      },
      {
        number: '03',
        action: 'Find the account under Shared beneficiary accounts',
        outcome:
          'Review destination accounts that appear in claims across multiple member banks.',
      },
      {
        number: '04',
        action: 'Press Inspect to open the linked case',
        outcome:
          'Open the case details to inspect the linked claims and beneficiary account information.',
      },
    ],
    actionLabel: 'Open supervisor dashboard',
    systemGuarantee:
      'Shared account alerts flag common destination accounts across tenant walls without exposing unrelated bank cases.',
  },
  {
    id: 'bank_viewer',
    badge: 'Multi-Tenant Isolation',
    icon: Building2,
    title: 'Member Bank Risk Officer & Zero-Knowledge Privacy',
    subtitle: 'Strict Institutional Boundary Enforcement Under Banking Privacy Law',
    persona: 'Birch Viewer (Birch Regional Bank)',
    roleDescription: 'Bank risk officer viewing claims and calculations exclusively for Birch Bank',
    targetPath: PATHS.cases,
    userEmail: 'viewer@bank-b.test',
    story:
      '5 rival banks share this operations center, but banking confidentiality laws mandate that Bank B cannot view, search, or infer cases belonging to other banks.',
    goal: 'Demonstrate strict multi-tenant access control: the user sees exclusively Birch Regional Bank cases, while other institutions remain completely shielded.',
    steps: [
      {
        number: '01',
        action: 'Switch Role to Birch Viewer',
        outcome:
          'Observe the session locked to Birch Bank tenant scope.',
      },
      {
        number: '02',
        action: 'Inspect Workstation Case List',
        outcome:
          'All displayed cases belong strictly to Birch Regional Bank; other cases are invisible.',
      },
      {
        number: '03',
        action: 'Verify Restitution Fund Distribution Pool',
        outcome:
          'Review balance in frozen destination account and verify recovery calculation.',
      },
      {
        number: '04',
        action: 'Attempt Cross-Tenant Query',
        outcome:
          'System strictly excludes non-tenant records at the data boundary layer.',
      },
    ],
    actionLabel: 'Launch Bank Viewer (Birch Tenant)',
    systemGuarantee:
      'Zero-leakage tenancy. Database row-level security and UI tenant filters enforce strict isolation.',
  },
  {
    id: 'auditor',
    badge: 'Regulatory Audit',
    icon: History,
    title: 'Regulatory Auditor & Compliance Inspector',
    subtitle: 'Tamper-Evident Immutable Audit Ledger',
    persona: 'Kenzo Mori (Financial Services Agency / FSA Inspector)',
    roleDescription: 'Government auditor inspecting statutory adherence and algorithmic transparency',
    targetPath: PATHS.audit,
    userEmail: 'supervisor@opscenter.test',
    story:
      'Inspector Mori conducts a compliance inspection. Under the Furikomi Fraud Relief Act, every state change, document upload, OCR override, and account freeze must be recorded in an immutable audit log.',
    goal: 'Audit the chronological event log, confirm human oversight over AI actions, and verify that no funds are moved without human authorization.',
    steps: [
      {
        number: '01',
        action: 'Open Regulatory Audit Ledger',
        outcome:
          'Inspect complete chronological stream of triage events, OCR runs, and freeze dispatches.',
      },
      {
        number: '02',
        action: 'Filter by Actor Types (User, AI, Victim, System)',
        outcome:
          'Verify distinct actor identities, chronological ordering, and metadata.',
      },
      {
        number: '03',
        action: 'Confirm Human Verification of AI Extraction',
        outcome:
          'Verify that every extraction event is paired with a certified human verification entry.',
      },
      {
        number: '04',
        action: 'Export Regulatory Verification Proof',
        outcome:
          'Confirm audit trail satisfies statutory reporting guidelines for the consortium.',
      },
    ],
    actionLabel: 'Launch Audit Ledger (Compliance Trail)',
    systemGuarantee:
      'Tamper-evident event stream ensures full non-repudiation and regulatory compliance.',
  },
];
