import { CaseStatus } from '@/types/api';
import { Check, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface CaseProgressStepperProps {
  currentStatus: CaseStatus;
  closureReason?: string | null;
}

const STAGES: { key: CaseStatus; label: string; description: string }[] = [
  { key: 'received', label: '1. Received', description: 'Intake registered' },
  { key: 'verified', label: '2. Verified', description: 'Voucher verified' },
  { key: 'account_check', label: '3. Freeze check', description: 'Account verified' },
  { key: 'notice_published', label: '4. 60D notice', description: 'Public notice' },
  { key: 'payout_review', label: '5. Audit review', description: 'Pro-rata calc' },
  { key: 'closed', label: '6. Closed', description: 'Claim completed' },
];

export function CaseProgressStepper({ currentStatus, closureReason }: CaseProgressStepperProps) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStatus);

  return (
    <div className="w-full py-2 font-['Space_Grotesk',sans-serif]">
      <div className="relative flex items-center justify-between">
        {/* Connecting track line */}
        <div className="absolute left-5 right-5 top-4 -translate-y-1/2 h-2 bg-[#EDE8D5] border border-[#09090B]/20 rounded-full overflow-hidden -z-0">
          <div
            className="h-full bg-[#D2E823] transition-all duration-300"
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
            <div key={stage.key} className="flex flex-col items-center relative z-10">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors border ${
                  isPassed
                    ? 'bg-[#09090B] text-[#D2E823] border-[#09090B]'
                    : isCurrent
                    ? 'bg-[#D2E823] text-[#09090B] border-[#09090B]'
                    : 'bg-[#EDE8D5] text-[#52525B] border-[#09090B]/20'
                }`}
              >
                {isPassed ? (
                  <Check className="w-4 h-4 stroke-[2.5]" />
                ) : isCurrent ? (
                  <Clock className="w-4 h-4 animate-spin text-[#09090B]" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              <div className="text-center mt-2 space-y-0.5 max-w-[85px]">
                <p
                  className={`text-xs font-bold uppercase tracking-wider ${
                    isCurrent
                      ? 'text-[#09090B]'
                      : isPassed
                      ? 'text-[#09090B]'
                      : 'text-[#52525B]'
                  }`}
                >
                  {stage.label}
                </p>
                <p className="text-xs text-[#52525B] hidden sm:block">
                  {stage.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {closureReason && currentStatus === 'closed' && (
        <div className="mt-3 flex justify-center">
          <Badge variant="outline" className="text-xs">
            Closure reason: {closureReason.replace('_', ' ')}
          </Badge>
        </div>
      )}
    </div>
  );
}
