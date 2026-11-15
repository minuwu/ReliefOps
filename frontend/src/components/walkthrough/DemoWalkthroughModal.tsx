import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { StickerBadge } from '@/components/ui/StickerBadge';
import { GlitchText } from '@/components/ui/GlitchText';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { DEMO_PASSWORD } from '@/services/mockData';
import { errorMessage } from '@/services/http';
import { toast } from '@/store/useToastStore';
import { PATHS } from '@/routes/paths';
import {
  LifeBuoy,
  Inbox,
  BrainCircuit,
  BarChart3,
  Building2,
  History,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  PlayCircle,
  Lock,
} from 'lucide-react';

export interface DemoWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Scenario {
  id: string;
  badge: string;
  badgeVariant: 'acid' | 'coral' | 'neutral' | 'inverted';
  icon: typeof LifeBuoy;
  title: string;
  subtitle: string;
  persona: string;
  roleDescription: string;
  /** URL the scenario opens after switching account. */
  targetPath: string;
  userEmail: string;
  story: string;
  goal: string;
  steps: { number: string; action: string; outcome: string }[];
  actionLabel: string;
  systemGuarantee: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'victim',
    badge: 'CITIZEN JOURNEY',
    badgeVariant: 'acid',
    icon: LifeBuoy,
    title: 'Victim Enactment & Restitution Tracking',
    subtitle: 'Citizen Self-Service Under Furikomi Relief Act (Law No. 133)',
    persona: 'Haruto Tanaka (67, Scam Victim, Shibuya Tokyo)',
    roleDescription: 'Defrauded citizen seeking recovery of illicitly transferred savings',
    targetPath: PATHS.portal,
    userEmail: 'victim1@mail.test',
    story:
      'Haruto received a fraudulent phone call from an imposter claiming his national pension was locked, directing him to transfer ¥1,450,000 into an "escrow safety account" at Birch Regional Bank. Realizing he was defrauded, Haruto urgently accesses the ReliefOps Citizen Portal.',
    goal: 'Submit an emergency relief claim, upload the ATM Furikomi receipt, track the 6-stage statutory recovery lifecycle, and communicate with center triage operators.',
    steps: [
      {
        number: '01',
        action: 'Access Citizen Portal & Authenticate Claim',
        outcome:
          'Click 1-Click Demo Credential for RFR-2026-00042 (Access Code: K7QM-4XHP-2RTV) to load active claim.',
      },
      {
        number: '02',
        action: 'Inspect 6-Stage Statutory Lifecycle Stepper',
        outcome:
          'View real-time progress: Received → Verified → Account Check → Notice Published → Payout Review → Closed.',
      },
      {
        number: '03',
        action: 'Review Frozen Mule Funds & Restitution Ratio',
        outcome:
          'Confirm that ¥1,450,000 claim is mapped against Birch Regional Bank frozen balance of ¥520,000.',
      },
      {
        number: '04',
        action: 'Interact With 2-Way Operator Chat & Legal Assistant',
        outcome:
          'Send questions regarding pro-rata distribution formulas and police report synchronization.',
      },
    ],
    actionLabel: 'Launch Citizen Journey (Victim Portal)',
    systemGuarantee:
      'Zero sensitive account disclosure. Victims only see statutory milestones and authorized case updates.',
  },
  {
    id: 'operator',
    badge: 'OPERATOR TRIAGE',
    badgeVariant: 'neutral',
    icon: Inbox,
    title: 'Center Intake Specialist & Case Triage',
    subtitle: 'Workstation Prioritization, SLA Timers & Inter-Bank Freezes',
    persona: 'Aoi Sato (Operator One, Tokyo Shared Operations Center)',
    roleDescription: 'Frontline triage specialist managing high-velocity cross-bank queues',
    targetPath: PATHS.cases,
    userEmail: 'operator1@opscenter.test',
    story:
      'Aoi oversees the shared intake workstation. With 38 cases incoming from 5 regional banks, she must prioritize claims facing strict 48-hour statutory deadlines and issue swift freeze orders to recipient financial institutions.',
    goal: 'Filter and prioritize urgent cases, inspect victim documentation, review suspect destination accounts, and progress cases from Received to Verified and Account Check.',
    steps: [
      {
        number: '01',
        action: 'Filter Workstation by SLA Urgency & Bank',
        outcome:
          'Sort by Overdue / Approaching SLA to target cases needing immediate regulatory escalation.',
      },
      {
        number: '02',
        action: 'Open Case Detail Drawer for RFR-2026-00042',
        outcome:
          'Inspect victim narrative, scam category (Impersonation), and suspect destination account 9876543210.',
      },
      {
        number: '03',
        action: 'Review Attached Documents & OCR Badges',
        outcome:
          'Verify uploaded ATM Furikomi vouchers and check Human-in-the-Loop optical confidence indicators.',
      },
      {
        number: '04',
        action: 'Execute Lifecycle Status Transition',
        outcome:
          'Advance case status to "Account Check" and simulate destination account freeze dispatch.',
      },
    ],
    actionLabel: 'Launch Operator Workstation (Cases)',
    systemGuarantee:
      'SLA enforcement engine ensures every case is accounted for with deterministic countdown timers.',
  },
  {
    id: 'hitl',
    badge: 'HUMAN-IN-THE-LOOP AI',
    badgeVariant: 'coral',
    icon: BrainCircuit,
    title: 'Document Optical Workbench & HITL Verification',
    subtitle: 'Rule D3: Mandatory Human Certification for All AI Extractions',
    persona: 'Operator Two (Certified Optical & Forensic Reviewer)',
    roleDescription: 'Auditor verifying low-confidence document OCR extractions before ledger commit',
    targetPath: PATHS.review,
    userEmail: 'operator2@opscenter.test',
    story:
      'A victim submitted an ATM receipt with a fold line and faint thermal printer text. The Vision OCR engine processed the voucher but scored only 68% confidence on the recipient account number. Under statutory rules, AI can never commit data to banking records without certified operator sign-off.',
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
          'Launch side-by-side view with High-Res Optical Voucher Facsimile on left and Form on right.',
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
          'Commit certified values to the legal record, automatically updating case facts and logging audit trail.',
      },
    ],
    actionLabel: 'Launch HITL Review Queue (AI OCR)',
    systemGuarantee:
      'AI proposes, Human disposes. No financial or legal claim is ever altered autonomously.',
  },
  {
    id: 'supervisor',
    badge: 'SUPERVISOR COMMAND',
    badgeVariant: 'acid',
    icon: BarChart3,
    title: 'Control Tower & Cross-Bank Syndicate Hunting',
    subtitle: '5-Bank Ecosystem Oversight & Fraud Ring Topology',
    persona: 'Supervisor Sarah (Chief Operations Officer, Tokyo Ops Hub)',
    roleDescription: 'Executive supervisor directing inter-bank intelligence and regulatory compliance',
    targetPath: PATHS.dashboard,
    userEmail: 'supervisor@opscenter.test',
    story:
      'Sarah manages the shared operations command center for Aster, Birch, Cobalt, Dune, and Ember Regional Banks. She tracks high-altitude KPIs, monitors SLA breaches, and investigates organized crime rings laundering stolen funds across multiple banks simultaneously.',
    goal: 'Monitor center-wide metrics, review urgent SLA countdowns, explore the multi-bank fraud syndicate graph, and execute a coordinated multi-bank account freeze.',
    steps: [
      {
        number: '01',
        action: 'Inspect Executive Bento Metrics Grid',
        outcome:
          'Review 38 Active Cases, ¥84,250,000 Protected Funds, 3 Overdue Cases, and 94.8% SLA Adherence.',
      },
      {
        number: '02',
        action: 'Examine Urgent Cases SLA Carousel',
        outcome:
          'Track live countdown timers for cases approaching regulatory 48-hour reporting windows.',
      },
      {
        number: '03',
        action: 'Explore Cross-Bank Fraud Syndicate Topology',
        outcome:
          'Visualize shared mule destination account 9876543210 linked across Birch Bank and Aster Bank.',
      },
      {
        number: '04',
        action: 'Execute Multi-Bank Emergency Freeze Simulation',
        outcome:
          'Click "FREEZE ACROSS ALL BANKS" to coordinate immediate simultaneous freeze across member institutions.',
      },
    ],
    actionLabel: 'Launch Supervisor Command (Control Tower)',
    systemGuarantee:
      'Sybil and shared-entity detection algorithms identify organized rings across tenant walls without leaking non-syndicate data.',
  },
  {
    id: 'bank_viewer',
    badge: 'MULTI-TENANT ISOLATION',
    badgeVariant: 'neutral',
    icon: Building2,
    title: 'Member Bank Risk Officer & Zero-Knowledge Privacy',
    subtitle: 'Strict Institutional Boundary Enforcement Under Banking Privacy Law',
    persona: 'Birch Compliance Officer (Birch Regional Bank)',
    roleDescription: 'Bank risk officer viewing claims and restitution calculations exclusively for Birch Bank',
    targetPath: PATHS.cases,
    userEmail: 'viewer@bank-b.test',
    story:
      '5 rival banks share this operations center to reduce costs, but Japanese banking confidentiality laws strictly mandate that Bank B cannot view, search, or infer cases belonging to Bank A, C, D, or E.',
    goal: 'Demonstrate strict multi-tenant access control: the user sees exclusively Birch Regional Bank cases, while other institutions remain completely shielded.',
    steps: [
      {
        number: '01',
        action: 'Switch Role to Birch Compliance Officer',
        outcome:
          'Observe the navbar tenant indicator locking the session to "TENANT: BANK_B".',
      },
      {
        number: '02',
        action: 'Inspect Workstation Case List',
        outcome:
          'All displayed cases belong strictly to Birch Regional Bank; Aster, Cobalt, Dune, Ember cases are invisible.',
      },
      {
        number: '03',
        action: 'Verify Restitution Fund Distribution Pool',
        outcome:
          'Review balance in frozen destination account (¥520,000) and verify pro-rata recovery share.',
      },
      {
        number: '04',
        action: 'Attempt Cross-Tenant Query',
        outcome:
          'System mathematically excludes non-tenant records at the data boundary layer.',
      },
    ],
    actionLabel: 'Launch Bank Viewer (Birch Tenant)',
    systemGuarantee:
      'Zero-leakage tenancy. Database row-level security and UI tenant filters enforce strict isolation.',
  },
  {
    id: 'auditor',
    badge: 'REGULATORY AUDIT',
    badgeVariant: 'inverted',
    icon: History,
    title: 'Regulatory Auditor & Compliance Inspector',
    subtitle: 'Cryptographically Sealed Immutable Audit Ledger',
    persona: 'Kenzo Mori (Financial Services Agency / FSA Inspector)',
    roleDescription: 'Government auditor inspecting statutory adherence and algorithmic transparency',
    targetPath: PATHS.audit,
    userEmail: 'supervisor@opscenter.test',
    story:
      'Inspector Mori conducts a spot inspection of the shared center. Under the Furikomi Fraud Relief Act, every state change, document upload, OCR override, and account freeze must be recorded in an immutable, tamper-evident audit log.',
    goal: 'Audit the chronological event log, confirm human oversight over every AI action, and verify that no funds are moved without human authorization.',
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
          'Verify distinct actor identities, cryptographic timestamp ordering, and IP tracing metadata.',
      },
      {
        number: '03',
        action: 'Confirm Human Verification of AI Extraction',
        outcome:
          'Verify that every extraction event is paired with a corresponding certified human verification entry.',
      },
      {
        number: '04',
        action: 'Export Regulatory Verification Proof',
        outcome:
          'Confirm audit trail satisfies FSA statutory reporting guidelines for the 5-bank consortium.',
      },
    ],
    actionLabel: 'Launch Audit Ledger (Compliance Trail)',
    systemGuarantee:
      'Tamper-evident event stream ensures full non-repudiation and regulatory compliance.',
  },
];

export function DemoWalkthroughModal({ isOpen, onClose }: DemoWalkthroughModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const currentScenario = SCENARIOS[selectedIndex];
  const Icon = currentScenario.icon;

  const handleLaunchScenario = async () => {
    try {
      await login(currentScenario.userEmail, DEMO_PASSWORD);
      navigate(currentScenario.targetPath);
      onClose();
    } catch (err) {
      toast(errorMessage(err, 'Could not start this scenario.'), 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="4xl">
      <div className="space-y-6 font-['Space_Grotesk',sans-serif]">
        {/* Header */}
        <div className="border-b-2 border-[#09090B] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <StickerBadge variant="acid" rotate="-rotate-1" className="text-xs">
                INTERACTIVE DEMO WALKTHROUGH
              </StickerBadge>
              <span className="text-xs font-mono text-[#52525B] font-bold uppercase">
                SCENARIOS & PERSONAS ({selectedIndex + 1} OF {SCENARIOS.length})
              </span>
            </div>
            <GlitchText as="h2" className="text-xl sm:text-2xl font-['Dela_Gothic_One'] text-[#09090B] uppercase">
              END-TO-END SCENARIO WALKTHROUGHS
            </GlitchText>
            <p className="text-xs text-[#52525B] font-medium max-w-2xl">
              Explore how victims, triage operators, AI models, bank compliance officers, and supervisors interact within this multi-bank Furikomi Relief platform.
            </p>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
            <button
              onClick={() => setSelectedIndex((prev) => (prev > 0 ? prev - 1 : SCENARIOS.length - 1))}
              className="p-2 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] hover:bg-[#D2E823] transition-colors cursor-pointer shadow-hard-sm"
              title="Previous Scenario"
              aria-label="Previous Scenario"
            >
              <ChevronLeft className="w-4 h-4 text-[#09090B]" />
            </button>
            <span className="font-mono text-xs font-bold px-2 text-[#09090B]">
              {selectedIndex + 1}/{SCENARIOS.length}
            </span>
            <button
              onClick={() => setSelectedIndex((prev) => (prev < SCENARIOS.length - 1 ? prev + 1 : 0))}
              className="p-2 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] hover:bg-[#D2E823] transition-colors cursor-pointer shadow-hard-sm"
              title="Next Scenario"
              aria-label="Next Scenario"
            >
              <ChevronRight className="w-4 h-4 text-[#09090B]" />
            </button>
          </div>
        </div>

        {/* Scenario Selector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {SCENARIOS.map((sc, idx) => {
            const ScIcon = sc.icon;
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={sc.id}
                onClick={() => setSelectedIndex(idx)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border-2 border-[#09090B] ${
                  isSelected
                    ? 'bg-[#09090B] text-[#D2E823] shadow-hard-sm translate-x-[1px] translate-y-[1px]'
                    : 'bg-[#F8F4E8] text-[#09090B] hover:bg-[#D2E823]'
                }`}
              >
                <ScIcon className="w-3.5 h-3.5" />
                <span>{sc.badge}</span>
              </button>
            );
          })}
        </div>

        {/* Active Scenario Card */}
        <div className="p-5 sm:p-6 rounded-2xl border-2 border-[#09090B] bg-[#EDE8D5] shadow-hard space-y-5">
          {/* Top Info */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b-2 border-[#09090B] pb-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-[#09090B] text-[#D2E823] border border-[#09090B]">
                  <Icon className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-['Dela_Gothic_One'] text-[#09090B] uppercase">
                    {currentScenario.title}
                  </h3>
                  <p className="text-xs font-mono font-bold text-[#52525B]">
                    {currentScenario.subtitle}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] text-xs space-y-0.5 shrink-0">
              <div className="font-bold uppercase text-[10px] text-[#52525B]">PERSONA FOCUS:</div>
              <div className="font-bold text-[#09090B]">{currentScenario.persona}</div>
              <div className="text-[11px] text-[#52525B] max-w-xs">{currentScenario.roleDescription}</div>
            </div>
          </div>

          {/* Story & Goal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard-sm space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF334B] flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> SCENARIO BACKSTORY & CONTEXT
              </span>
              <p className="text-xs text-[#09090B] leading-relaxed font-medium">
                {currentScenario.story}
              </p>
            </div>

            <div className="p-4 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard-sm space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#16A34A] flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> USER GOAL & SYSTEM OBJECTIVE
              </span>
              <p className="text-xs text-[#09090B] leading-relaxed font-medium">
                {currentScenario.goal}
              </p>
            </div>
          </div>

          {/* End-to-End Steps */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-['Dela_Gothic_One'] uppercase text-[#09090B]">
              END-TO-END INTERACTION STEPS (WHAT YOU WILL EXPERIENCE):
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {currentScenario.steps.map((step) => (
                <div
                  key={step.number}
                  className="p-3 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard-sm flex items-start gap-2.5"
                >
                  <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-[#09090B] text-[#D2E823] shrink-0">
                    {step.number}
                  </span>
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-[#09090B]">{step.action}</p>
                    <p className="text-[#52525B] text-[11px] leading-tight">{step.outcome}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Statutory Guarantee Box */}
          <div className="p-3 rounded-xl border border-[#09090B] bg-[#09090B] text-[#F8F4E8] text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#D2E823] shrink-0" />
              <span className="text-[11px] text-[#D4D4D8]">
                <strong>STATUTORY SAFETY GUARANTEE:</strong> {currentScenario.systemGuarantee}
              </span>
            </div>
            <span className="hidden sm:inline-block font-mono text-[10px] text-[#D2E823] uppercase">
              LAW NO. 133
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t-2 border-[#09090B] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[#52525B] font-mono">
            Clicking Launch will automatically configure the target persona, role, and tab.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={onClose} className="w-1/3 sm:w-auto">
              CLOSE
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleLaunchScenario}
              className="w-2/3 sm:w-auto gap-2 shadow-hard hover:shadow-hard-sm"
            >
              <PlayCircle className="w-4 h-4" />
              <span>{currentScenario.actionLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
