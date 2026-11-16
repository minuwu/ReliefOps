import type { Case, CaseStatus } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { MailPlus } from 'lucide-react';
import { STAGE_ORDER } from '@/lib/caseStages';

export function transitionLabel(from: CaseStatus, to: CaseStatus): string {
  const label = to.replace('_', ' ');
  if (to === 'closed') return 'Close case';
  return STAGE_ORDER.indexOf(to) < STAGE_ORDER.indexOf(from) ? `Send back to ${label}` : `Move to ${label}`;
}

export interface CaseTransitionControlsProps {
  caseItem: Case;
  canWrite: boolean;
  onOpenTransition: (next: CaseStatus) => void;
  onInviteVictim: () => Promise<void> | void;
  isInviting: boolean;
}

export function CaseTransitionControls({
  caseItem,
  canWrite,
  onOpenTransition,
  onInviteVictim,
  isInviting,
}: CaseTransitionControlsProps) {
  return (
    <>
      {/* Status Actions */}
      {canWrite && (
        <div className="p-4 rounded-xl border border-[#09090B]/15 bg-[#EDE8D5]/50 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#09090B]">
              Statutory workflow actions
            </p>
            <p className="text-xs text-[#52525B]">
              Next allowed steps under the relief guidelines
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {caseItem.allowed_transitions.map((nextStatus, idx) => (
              <Button
                key={nextStatus}
                size="sm"
                variant={idx === 0 ? 'acid' : 'outline'}
                onClick={() => onOpenTransition(nextStatus)}
              >
                {transitionLabel(caseItem.status, nextStatus)}
              </Button>
            ))}
            {caseItem.victim.email && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void onInviteVictim()}
                isLoading={isInviting}
                className="gap-1.5"
                title="Email the victim a link to follow this case online"
              >
                <MailPlus className="w-3.5 h-3.5 text-[#09090B]" />
                Invite victim
              </Button>
            )}
          </div>
        </div>
      )}

      {caseItem.status === 'closed' && (
        <div
          className="p-3.5 rounded-xl border border-[#09090B]/15 bg-[#EDE8D5]/40 text-xs text-[#09090B]"
          role="status"
        >
          This case is closed ({caseItem.closure_reason?.replace('_', ' ') ?? 'no reason'}
          {caseItem.payout_amount != null
            ? `, paid out ${formatCurrency(caseItem.payout_amount, caseItem.currency)}`
            : ''}
          ). It is read-only.
        </div>
      )}
    </>
  );
}
