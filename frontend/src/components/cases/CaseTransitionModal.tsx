import { useState } from 'react';
import type { Case, CaseStatus, ClosureReason } from '@/types/api';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CheckCircle2 } from 'lucide-react';

export interface CaseTransitionModalProps {
  targetStatus: CaseStatus;
  caseItem: Case;
  onClose: () => void;
  onConfirm: (payload: {
    to_status: CaseStatus;
    closure_reason?: ClosureReason;
    payout_amount?: number;
    note?: string;
  }) => Promise<void>;
  isTransitioning: boolean;
  transitionError: string | null;
}

export function CaseTransitionModal({
  targetStatus,
  caseItem,
  onClose,
  onConfirm,
  isTransitioning,
  transitionError,
}: CaseTransitionModalProps) {
  const [closureReason, setClosureReason] = useState<ClosureReason | ''>(
    targetStatus === 'closed' ? caseItem.allowed_closure_reasons[0] ?? '' : ''
  );
  const [payoutAmount, setPayoutAmount] = useState('');
  const [transitionNote, setTransitionNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isPayout = targetStatus === 'closed' && closureReason === 'paid_out';
    const amount = Number(payoutAmount);
    if (isPayout && (!payoutAmount || !Number.isFinite(amount) || amount < 0)) {
      setLocalError('Enter the amount paid out (0 or more).');
      return;
    }
    setLocalError(null);
    await onConfirm({
      to_status: targetStatus,
      ...(targetStatus === 'closed' && closureReason ? { closure_reason: closureReason } : {}),
      ...(isPayout ? { payout_amount: amount } : {}),
      ...(transitionNote.trim() ? { note: transitionNote.trim() } : {}),
    });
  };

  const error = localError || transitionError;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Confirm milestone: ${targetStatus.replace('_', ' ')}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2 font-['Space_Grotesk',sans-serif]">
        <p className="text-xs font-medium text-[#52525B]">
          Advancing case <span className="font-mono font-bold text-[#09090B]">{caseItem.reference}</span> from{' '}
          <Badge status={caseItem.status}>{caseItem.status.replace('_', ' ')}</Badge> to{' '}
          <Badge status={targetStatus}>{targetStatus.replace('_', ' ')}</Badge>.
        </p>

        {targetStatus === 'closed' && (
          <div className="space-y-1.5">
            <label htmlFor="closure-reason" className="text-xs font-bold uppercase text-[#09090B]">
              Closure reason:
            </label>
            <select
              id="closure-reason"
              value={closureReason}
              onChange={(e) => setClosureReason(e.target.value as ClosureReason)}
              className="w-full text-xs font-bold bg-[#F8F4E8] border border-[#09090B]/20 rounded-xl p-2.5 focus:outline-none focus:border-[#09090B]"
            >
              {caseItem.allowed_closure_reasons.map((r) => (
                <option key={r} value={r}>
                  {r.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}

        {targetStatus === 'closed' && closureReason === 'paid_out' && (
          <div className="space-y-1.5">
            <label htmlFor="payout-amount" className="text-xs font-bold uppercase text-[#09090B]">
              Amount paid out ({caseItem.currency}):
            </label>
            <input
              id="payout-amount"
              type="number"
              min={0}
              inputMode="numeric"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              className="w-full text-xs font-bold bg-[#F8F4E8] border border-[#09090B]/20 rounded-xl p-2.5 focus:outline-none focus:border-[#09090B]"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs font-bold text-[#FF334B]">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <label htmlFor="transition-note" className="text-xs font-bold uppercase text-[#09090B]">
            Audit note / reference:
          </label>
          <input
            id="transition-note"
            type="text"
            value={transitionNote}
            onChange={(e) => setTransitionNote(e.target.value)}
            placeholder="Statutory reason for status transition..."
            className="w-full text-xs font-medium bg-[#F8F4E8] border border-[#09090B]/20 rounded-xl p-2.5 focus:outline-none focus:border-[#09090B]"
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-[#09090B]/15">
          <Button size="sm" variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="acid" type="submit" isLoading={isTransitioning}>
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirm transition
          </Button>
        </div>
      </form>
    </Modal>
  );
}
