import { CaseStatus } from '@/types/api';
import { Check, Clock, ShieldCheck } from 'lucide-react';

interface CaseProgressStepperProps {
  currentStatus: CaseStatus;
  closureReason?: string | null;
}

const STAGES: { key: CaseStatus; label: string; description: string }[] = [
  { key: 'received', label: 'Received', description: 'Intake Registered' },
  { key: 'verified', label: 'Verified', description: 'Receipt Verified' },
  { key: 'account_check', label: 'Account Check', description: 'Funds Frozen' },
  { key: 'notice_published', label: 'Notice Published', description: '60-Day Gazette' },
  { key: 'payout_review', label: 'Payout Review', description: 'Supervisor Audit' },
  { key: 'closed', label: 'Closed', description: 'Relief Disbursed' },
];

export function CaseProgressStepper({ currentStatus, closureReason }: CaseProgressStepperProps) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStatus);

  return (
    <div className="w-full py-4">
      <div className="relative flex items-center justify-between">
        {/* Connecting track line */}
        <div className="absolute left-6 right-6 top-4 -translate-y-1/2 h-0.5 bg-border -z-0">
          <div
            className="h-full bg-primary transition-all duration-500"
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
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  isPassed
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : isCurrent
                    ? 'bg-background border-2 border-primary text-primary ring-4 ring-primary/15 shadow-sm scale-110'
                    : 'bg-muted border border-border text-muted-foreground'
                }`}
              >
                {isPassed ? (
                  <Check className="w-4 h-4 stroke-[2.5]" />
                ) : isCurrent ? (
                  <Clock className="w-3.5 h-3.5 animate-pulse text-primary" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              <div className="text-center mt-2 space-y-0.5 max-w-[80px]">
                <p
                  className={`text-[11px] font-bold leading-tight ${
                    isCurrent ? 'text-primary' : isPassed ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {stage.label}
                </p>
                <p className="text-[9px] text-muted-foreground leading-none hidden sm:block">
                  {stage.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {currentStatus === 'closed' && closureReason && (
        <div className="mt-4 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-2 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Case settled & closed with resolution: <strong>{closureReason.replace('_', ' ').toUpperCase()}</strong>
        </div>
      )}
    </div>
  );
}
