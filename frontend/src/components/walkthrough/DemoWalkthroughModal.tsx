import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
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
  icon: typeof LifeBuoy;
  title: string;
  subtitle: string;
  persona: string;
  roleDescription: string;
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
    badge: 'Supervisor Command',
    icon: BarChart3,
    title: 'Control Tower & Cross-Bank Syndicate Hunting',
    subtitle: '5-Bank Ecosystem Oversight & Fraud Ring Topology',
    persona: 'Supervisor Sato (Chief Operations Officer, Tokyo Ops Hub)',
    roleDescription: 'Executive supervisor directing inter-bank intelligence and regulatory compliance',
    targetPath: PATHS.dashboard,
    userEmail: 'supervisor@opscenter.test',
    story:
      'Supervisor Sato manages the shared operations command center for member banks. He tracks center-wide KPIs, monitors SLA breaches, and investigates organized crime rings laundering stolen funds across multiple banks.',
    goal: 'Monitor center-wide metrics, review urgent SLA countdowns, explore the multi-bank fraud syndicate graph, and execute a coordinated account freeze.',
    steps: [
      {
        number: '01',
        action: 'Inspect Executive Metrics Grid',
        outcome:
          'Review Active Cases, Protected Funds, Overdue Cases, and SLA Adherence metrics.',
      },
      {
        number: '02',
        action: 'Examine Urgent Cases SLA List',
        outcome:
          'Track live countdown timers for cases approaching regulatory 48-hour reporting windows.',
      },
      {
        number: '03',
        action: 'Explore Cross-Bank Fraud Syndicate Topology',
        outcome:
          'Visualize shared mule destination account linked across member banks.',
      },
      {
        number: '04',
        action: 'Execute Multi-Bank Emergency Freeze Simulation',
        outcome:
          'Coordinate immediate simultaneous freeze across member institutions.',
      },
    ],
    actionLabel: 'Launch Supervisor Command (Control Tower)',
    systemGuarantee:
      'Shared-entity detection identifies organized rings across tenant walls without leaking non-syndicate data.',
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
      <div className="space-y-5 font-['Space_Grotesk',sans-serif]">
        {/* Header */}
        <div className="border-b border-[#09090B]/15 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-['Dela_Gothic_One'] text-[#09090B] uppercase">
              Scenario walkthroughs
            </h2>
            <p className="text-xs text-[#52525B] font-medium max-w-2xl">
              Select a persona below to explore each role in the fraud relief platform.
            </p>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setSelectedIndex((prev) => (prev > 0 ? prev - 1 : SCENARIOS.length - 1))}
              className="p-1.5 rounded-lg border border-[#09090B] bg-[#F8F4E8] hover:bg-[#D2E823] transition-colors cursor-pointer"
              title="Previous scenario"
              aria-label="Previous scenario"
            >
              <ChevronLeft className="w-4 h-4 text-[#09090B]" />
            </button>
            <span className="font-mono text-xs font-bold px-2 text-[#09090B]">
              {selectedIndex + 1}/{SCENARIOS.length}
            </span>
            <button
              type="button"
              onClick={() => setSelectedIndex((prev) => (prev < SCENARIOS.length - 1 ? prev + 1 : 0))}
              className="p-1.5 rounded-lg border border-[#09090B] bg-[#F8F4E8] hover:bg-[#D2E823] transition-colors cursor-pointer"
              title="Next scenario"
              aria-label="Next scenario"
            >
              <ChevronRight className="w-4 h-4 text-[#09090B]" />
            </button>
          </div>
        </div>

        {/* Persona Selector Rows */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {SCENARIOS.map((sc, idx) => {
            const ScIcon = sc.icon;
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap border ${
                  isSelected
                    ? 'bg-[#09090B] text-[#D2E823] border-[#09090B]'
                    : 'bg-[#F8F4E8] text-[#09090B] border-[#09090B]/20 hover:bg-[#D2E823]/30'
                }`}
              >
                <ScIcon className="w-3.5 h-3.5" />
                <span>{sc.badge}</span>
              </button>
            );
          })}
        </div>

        {/* Active Scenario Content */}
        <div className="space-y-4">
          {/* Top Title & Persona */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#09090B]/15 pb-3">
            <div className="flex items-start gap-2.5">
              <span className="p-2 rounded-lg bg-[#09090B] text-[#D2E823] shrink-0 mt-0.5">
                <Icon className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-[#09090B]">
                  {currentScenario.title}
                </h3>
                <p className="text-xs text-[#52525B]">
                  {currentScenario.subtitle}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-[#09090B]/15 bg-[#F8F4E8] p-2.5 text-xs space-y-0.5 shrink-0">
              <div className="font-bold uppercase text-xs text-[#52525B]">Persona:</div>
              <div className="font-bold text-[#09090B]">{currentScenario.persona}</div>
              <div className="text-xs text-[#52525B] max-w-xs">{currentScenario.roleDescription}</div>
            </div>
          </div>

          {/* Context & Goal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-[#09090B]/15 bg-[#F8F4E8] space-y-1">
              <span className="font-bold uppercase tracking-wide text-[#09090B] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#FF334B]" /> Context
              </span>
              <p className="text-xs text-[#09090B] leading-relaxed">
                {currentScenario.story}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-[#09090B]/15 bg-[#F8F4E8] space-y-1">
              <span className="font-bold uppercase tracking-wide text-[#09090B] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#09090B]" /> Goal
              </span>
              <p className="text-xs text-[#09090B] leading-relaxed">
                {currentScenario.goal}
              </p>
            </div>
          </div>

          {/* End-to-End Steps (Plain Numbered List) */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-[#52525B]">
              Walkthrough steps
            </h4>
            <ol className="divide-y divide-[#09090B]/10 rounded-xl border border-[#09090B]/15 bg-[#F8F4E8]">
              {currentScenario.steps.map((step) => (
                <li key={step.number} className="p-3 flex items-start gap-3 text-xs">
                  <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-[#09090B] text-[#D2E823] shrink-0">
                    {step.number}
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-bold text-[#09090B]">{step.action}</p>
                    <p className="text-[#52525B] text-xs leading-normal">{step.outcome}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Guarantee Note */}
          <div className="p-2.5 rounded-xl border border-[#09090B]/15 bg-[#F8F4E8] text-xs flex items-center justify-between gap-3 text-[#52525B]">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#09090B] shrink-0" />
              <span>
                <strong className="text-[#09090B]">Safety rule:</strong> {currentScenario.systemGuarantee}
              </span>
            </div>
            <span className="hidden sm:inline-block font-mono text-xs text-[#52525B]">
              Law No. 133
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[#09090B]/15 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[#52525B]">
            Launching configures the persona account and opens the target workspace.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={onClose} className="w-1/3 sm:w-auto">
              CLOSE
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleLaunchScenario}
              className="w-2/3 sm:w-auto gap-2"
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
