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
  { key: 'account_check', label: '3. Account check', description: 'Account frozen and checked' },
  { key: 'notice_published', label: '4. Notice published', description: '60-day public notice' },
  { key: 'payout_review', label: '5. Payout review', description: 'Payout amount review' },
  { key: 'closed', label: '6. Closed', description: 'Claim completed' },
];

export function CaseProgressStepper({ currentStatus, closureReason }: CaseProgressStepperProps) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStatus);

  return (
    <div className="w-full py-2 font-['Space_Grotesk',sans-serif]">
      <ol className="relative grid grid-cols-6 items-start" aria-label="Case progress">
        {/* Connecting track line */}
        <div
          aria-hidden="true"
          className="absolute left-[calc(100%/12)] right-[calc(100%/12)] top-4 -translate-y-1/2 h-1.5 bg-[#EDE8D5] border border-[#09090B]/20 rounded-full overflow-hidden"
        >
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
            <li
              key={stage.key}
              aria-current={isCurrent ? 'step' : undefined}
              className="flex flex-col items-center relative z-10 min-w-0 px-1"
            >
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
                  <Clock className="w-4 h-4 text-[#09090B]" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              <div className="text-center mt-2 space-y-0.5 max-w-[7.5rem]">
                <p
                  className={`text-xs font-semibold leading-snug ${
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
            </li>
          );
        })}
      </ol>

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
