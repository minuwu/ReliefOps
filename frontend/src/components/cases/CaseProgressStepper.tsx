import { CaseStatus } from '@/types/api';
import { Check, Clock } from 'lucide-react';
import { StickerBadge } from '@/components/ui/StickerBadge';

interface CaseProgressStepperProps {
  currentStatus: CaseStatus;
  closureReason?: string | null;
}

const STAGES: { key: CaseStatus; label: string; description: string }[] = [
  { key: 'received', label: '1. Received', description: 'Intake Registered' },
  { key: 'verified', label: '2. Verified', description: 'Voucher Verified' },
  { key: 'account_check', label: '3. Freeze Check', description: 'Mule Frozen' },
  { key: 'notice_published', label: '4. 60D Gazette', description: 'Public Notice' },
  { key: 'payout_review', label: '5. Audit Review', description: 'Pro-Rata Calc' },
  { key: 'closed', label: '6. Disbursed', description: 'Claim Closed' },
];

export function CaseProgressStepper({ currentStatus, closureReason }: CaseProgressStepperProps) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStatus);

  return (
    <div className="w-full py-4 font-['Space_Grotesk',sans-serif]">
      <div className="relative flex items-center justify-between">
        {/* Connecting channeled track line */}
        <div className="absolute left-6 right-6 top-4 -translate-y-1/2 h-2.5 bg-[#EDE8D5] border-2 border-[#09090B] rounded-full overflow-hidden -z-0">
          <div
            className="h-full bg-[#D2E823] border-r-2 border-[#09090B] transition-all duration-500"
            style={{
              width: `${(Math.max(0, currentIndex) / (STAGES.length - 1)) * 100}%`,
            }}
          />
        </div>

        {/* Step Nodes */}
        {STAGES.map((stage, idx) => {
          const isPassed = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div key={stage.key} className="flex flex-col items-center relative z-10 group">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-200 border-2 border-[#09090B] ${
                  isPassed
                    ? 'bg-[#09090B] text-[#D2E823] shadow-hard-sm'
                    : isCurrent
                    ? 'bg-[#D2E823] text-[#09090B] shadow-hard scale-110'
                    : 'bg-[#EDE8D5] text-[#52525B]'
                }`}
              >
                {isPassed ? (
                  <Check className="w-4 h-4 stroke-[3]" />
                ) : isCurrent ? (
                  <Clock className="w-4 h-4 animate-spin text-[#09090B]" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              <div className="text-center mt-2.5 space-y-0.5 max-w-[90px]">
                <p
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    isCurrent
                      ? 'text-[#09090B] font-["Dela_Gothic_One"] text-xs'
                      : isPassed
                      ? 'text-[#09090B]'
                      : 'text-[#71717A]'
                  }`}
                >
                  {stage.label}
                </p>
                <p className="text-[10px] font-mono text-[#52525B] hidden sm:block">
                  {stage.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {closureReason && currentStatus === 'closed' && (
        <div className="mt-4 flex justify-center">
          <StickerBadge variant="acid" rotate="rotate-0">
            CLOSURE REASON: {closureReason}
          </StickerBadge>
        </div>
      )}
    </div>
  );
}
