import { useState } from 'react';
import { SharedAccountAlert } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { GlitchText } from '@/components/ui/GlitchText';
import { StickerBadge } from '@/components/ui/StickerBadge';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/utils';
import {
  AlertTriangle,
  Building2,
  Lock,
  ArrowRight,
  CheckCircle2,
  Zap,
  ShieldAlert,
} from 'lucide-react';

interface FraudRingVisualizerProps {
  alerts: SharedAccountAlert[];
  onInspectCase?: (caseId: string) => void;
}

export function FraudRingVisualizer({ alerts, onInspectCase }: FraudRingVisualizerProps) {
  const [selectedRingIndex, setSelectedRingIndex] = useState(0);
  const [frozenAccounts, setFrozenAccounts] = useState<Record<string, boolean>>({});
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  if (!alerts || alerts.length === 0) return null;

  const currentAlert = alerts[selectedRingIndex] || alerts[0];
  const isFrozen = frozenAccounts[currentAlert.account_number];

  const handleSimulateFreeze = (accountNumber: string) => {
    setFrozenAccounts((prev) => ({
      ...prev,
      [accountNumber]: true,
    }));
    setIsConfirmModalOpen(false);
  };

  return (
    <div className="rounded-2xl border-2 border-[#09090B] bg-[#09090B] text-[#F8F4E8] p-4 sm:p-8 shadow-hard sm:shadow-hard-lg space-y-6 font-['Space_Grotesk',sans-serif]">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#27272A] pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="p-2 rounded-xl bg-[#FF334B] text-[#09090B] border-2 border-[#09090B] shadow-hard-acid-sm shrink-0">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            <GlitchText as="h3" className="text-base sm:text-2xl font-['Dela_Gothic_One'] text-[#F8F4E8] break-words">
              CROSS-BANK FRAUD SYNDICATE TOPOLOGY
            </GlitchText>
            <StickerBadge variant="coral" rotate="rotate-2" className="text-xs">
              THREAT ACTIVE
            </StickerBadge>
          </div>
          <p className="text-xs font-mono text-[#A1A1AA] mt-1.5">
            Inter-bank graph identifying shared mule beneficiary accounts funneling illicit funds across multiple regional banks
          </p>
        </div>

        {/* Ring Selector Tabs */}
        {alerts.length > 1 && (
          <div className="flex items-center gap-2 bg-[#18181B] p-1.5 rounded-xl border-2 border-[#27272A] overflow-x-auto max-w-full">
            {alerts.map((alert, idx) => (
              <button
                key={alert.account_number}
                onClick={() => setSelectedRingIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer ${selectedRingIndex === idx
                    ? 'bg-[#D2E823] text-[#09090B] border border-[#09090B] shadow-[2px_2px_0px_0px_#F8F4E8]'
                    : 'text-[#A1A1AA] hover:text-[#F8F4E8]'
                  }`}
              >
                RING #{idx + 1} ({alert.case_count} CAS)
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Visual Network Topology Canvas */}
      <div className="relative rounded-2xl border-2 border-[#27272A] bg-[#121215] p-6 sm:p-8 overflow-hidden">
        {/* Subtle dot background */}
        <div className="absolute inset-0 bg-dot-pattern-inverted opacity-10 pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left Column: Affected Victim Bank Feeder Nodes (5 Cols) */}
          <div className="md:col-span-5 space-y-3">
            <p className="text-xs font-mono font-bold text-[#D2E823] uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#D2E823]" /> FEEDER VICTIM CLAIMS ({currentAlert.cases.length})
            </p>

            <div className="space-y-3">
              {currentAlert.cases.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-xl border-2 border-[#27272A] bg-[#18181B] hover:border-[#D2E823] transition-all text-xs flex items-center justify-between group cursor-pointer"
                  onClick={() => onInspectCase && onInspectCase(c.id)}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold px-1.5 py-0.2 rounded bg-[#09090B] text-[#D2E823] border border-[#27272A]">
                        {c.reference}
                      </span>
                      <span className="font-mono text-[11px] text-[#A1A1AA] uppercase">Status: {c.status}</span>
                    </div>
                    <div className="text-[11px] font-mono text-[#A1A1AA]">
                      Bank: <span className="uppercase text-[#F8F4E8] font-bold">{currentAlert.bank_name || currentAlert.bank_id}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-[#D2E823] group-hover:underline flex items-center justify-end gap-0.5 mt-0.5">
                      VIEW <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Center Column: Directed Flow Vector (2 Cols) */}
          <div className="md:col-span-2 flex flex-col items-center justify-center py-4">
            <div className="hidden md:flex flex-col items-center gap-2 text-[#FF334B]">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#FF334B]/20 px-2 py-0.5 rounded border border-[#FF334B]">
                CONVERGING
              </span>
              <div className="w-0.5 h-12 bg-gradient-to-b from-transparent via-[#FF334B] to-[#FF334B] animate-pulse" />
              <ArrowRight className="w-6 h-6 animate-bounce" />
            </div>
            <div className="md:hidden flex items-center justify-center py-2 text-[#FF334B]">
              <span className="text-xs font-mono font-bold uppercase">▼ CONVERGES INTO MULE BENEFICIARY ▼</span>
            </div>
          </div>

          {/* Right Column: Destination Mule Account Target (5 Cols) */}
          <div className="md:col-span-5">
            <div
              className={`p-6 rounded-2xl border-2 transition-all duration-200 ${isFrozen
                  ? 'border-[#86EFAC] bg-[#064E3B]/40 shadow-hard-acid'
                  : 'border-[#FF334B] bg-[#450A0A]/40 shadow-hard-lg'
                }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A1A1AA]">
                  TARGET MULE ACCOUNT
                </span>
                {isFrozen ? (
                  <span className="flex items-center gap-1 text-xs font-bold font-mono text-[#86EFAC] bg-[#86EFAC]/20 px-2.5 py-0.5 rounded border border-[#86EFAC]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> INTER-BANK FROZEN
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold font-mono text-[#FF334B] bg-[#FF334B]/20 px-2.5 py-0.5 rounded border border-[#FF334B] animate-pulse">
                    <Lock className="w-3.5 h-3.5" /> ACTIVE UNRESTRICTED
                  </span>
                )}
              </div>

              <div className="p-4 rounded-xl border-2 border-[#27272A] bg-[#09090B] space-y-2 mb-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#A1A1AA] font-mono">ACCOUNT NO:</span>
                  <span className="font-mono text-base font-bold text-[#D2E823] tracking-widest">
                    {currentAlert.account_number}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#A1A1AA] font-mono">TARGET BANK:</span>
                  <span className="font-mono text-xs font-bold uppercase text-[#86EFAC]">
                    {currentAlert.bank_name || currentAlert.bank_id}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#A1A1AA] font-mono">LINKED CASES:</span>
                  <span className="font-mono text-xs font-bold text-[#D2E823]">
                    {currentAlert.case_count} ACROSS CONSORTIUM
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs mb-4">
                <span className="text-[#A1A1AA] font-mono">TOTAL SYNDICATED DRAIN:</span>
                <span className="font-['Dela_Gothic_One'] text-xl text-[#FF334B]">
                  {formatCurrency(currentAlert.total_amount, 'JPY')}
                </span>
              </div>

              {/* 1-Click Inter-Bank Emergency Freeze Action */}
              {!isFrozen ? (
                <Button
                  variant="destructive"
                  size="md"
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="w-full gap-2 shadow-hard-acid hover:shadow-hard-acid-sm"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  BROADCAST 5-BANK EMERGENCY FREEZE
                </Button>
              ) : (
                <div className="w-full py-2.5 px-3 rounded-xl border-2 border-[#86EFAC] bg-[#86EFAC]/10 text-[#86EFAC] text-center text-xs font-bold font-mono uppercase">
                  ✓ DISPATCH CONFIRMED ACROSS ALL 5 PARTNER BANKS
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Two-Step Confirmation Modal for Statutory Consortium Freeze */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="STATUTORY SYNDICATE FREEZE DISPATCH"
        maxWidth="lg"
      >
        <div className="space-y-6 text-[#09090B]">
          <div className="p-4 rounded-xl border-2 border-[#FF334B] bg-[#FFF1F2] flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-[#FF334B] shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-['Dela_Gothic_One'] text-sm text-[#FF334B]">
                MANDATORY STATUTORY WARNING (LAW NO. 133, ART. 3)
              </p>
              <p className="font-medium text-[#7F1D1D]">
                Broadcasting this emergency inter-bank order will instantly place an administrative freeze across all partner financial institutions (SMBC, MUFG, Mizuho, Resona, Japan Post Bank) for the designated destination mule account.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-[#E4E4E7] pb-2">
              <span className="text-[#52525B]">TARGET ACCOUNT:</span>
              <span className="font-bold text-sm text-[#09090B] bg-[#D2E823] px-2 py-0.5 rounded border border-[#09090B]">
                {currentAlert.account_number}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-[#E4E4E7] pb-2">
              <span className="text-[#52525B]">DESIGNATED HOLDER / BANK:</span>
              <span className="font-bold uppercase text-[#09090B]">
                {currentAlert.bank_name || currentAlert.bank_id}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-[#E4E4E7] pb-2">
              <span className="text-[#52525B]">INTER-BANK CLAIM COUNT:</span>
              <span className="font-bold text-[#FF334B]">
                {currentAlert.case_count} Linked Victim Accounts
              </span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-[#52525B]">TOTAL INTERCEPT VALUE:</span>
              <span className="font-['Dela_Gothic_One'] text-base text-[#09090B]">
                {formatCurrency(currentAlert.total_amount, 'JPY')}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setIsConfirmModalOpen(false)}
            >
              ABORT ACTION
            </Button>
            <Button
              variant="destructive"
              size="md"
              onClick={() => handleSimulateFreeze(currentAlert.account_number)}
              className="gap-2 shadow-hard hover:shadow-hard-sm"
            >
              <Zap className="w-4 h-4 fill-current" />
              CONFIRM & BROADCAST FREEZE
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
