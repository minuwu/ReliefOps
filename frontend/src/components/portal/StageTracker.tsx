import { Check } from 'lucide-react';
import type { CaseStatus } from '@/types/api';
import { STAGE_HINT, STAGE_LABEL, STAGE_ORDER, stageIndex } from '@/lib/caseStages';

interface StageTrackerProps {
  status: CaseStatus;
  /** Hide the explanation under the steps (list cards). */
  isCompact?: boolean;
}

/** The six statutory stages, with the current one marked for screen readers too. */
export function StageTracker({ status, isCompact = false }: StageTrackerProps) {
  const current = stageIndex(status);
  return (
    <div className="space-y-2">
      <ol className="grid grid-cols-6 gap-1" aria-label="Case progress">
        {STAGE_ORDER.map((stage, i) => {
          const isDone = i < current || status === 'closed';
          const isCurrent = i === current;
          const tone = isCurrent ? 'bg-[#D2E823]' : isDone ? 'bg-[#09090B] text-[#D2E823]' : 'bg-[#F8F4E8] text-[#52525B]';
          return (
            <li key={stage} aria-current={isCurrent ? 'step' : undefined} className="space-y-1">
              <span
                className={`flex h-7 items-center justify-center rounded-md border-2 border-[#09090B] text-[10px] font-bold ${tone}`}
              >
                {isDone && !isCurrent ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : i + 1}
              </span>
              {!isCompact && (
                <span className="block text-center text-[9px] sm:text-[10px] font-bold uppercase leading-tight text-[#09090B]">
                  {STAGE_LABEL[stage]}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-sm font-medium text-[#09090B]">
        <span className="font-bold uppercase">{STAGE_LABEL[status]}.</span>{' '}
        {!isCompact && <span className="text-[#52525B]">{STAGE_HINT[status]}</span>}
      </p>
    </div>
  );
}
