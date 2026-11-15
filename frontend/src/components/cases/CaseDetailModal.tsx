import { useEffect, useState } from 'react';
import { Case, CaseStatus, ClosureReason, User } from '@/types/api';
import { useCaseStore } from '@/store/useCaseStore';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { errorMessage } from '@/services/http';
import { CaseProgressStepper } from './CaseProgressStepper';
import { CaseDocumentsPanel } from './CaseDocumentsPanel';
import { CaseHistoryPanel } from './CaseHistoryPanel';
import { StaffChatPanel } from './StaffChatPanel';
import {
  ShieldAlert,
  Calendar,
  AlertTriangle,
  FileText,
  MailPlus,
  CheckCircle2,
  Send,
  Building2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { STAGE_ORDER } from '@/lib/caseStages';

function transitionLabel(from: CaseStatus, to: CaseStatus): string {
  const label = to.replace('_', ' ');
  if (to === 'closed') return 'Close case';
  return STAGE_ORDER.indexOf(to) < STAGE_ORDER.indexOf(from) ? `Send back to ${label}` : `Move to ${label}`;
}

interface CaseDetailModalProps {
  caseItem: Case | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenExtraction?: (extractionId: string) => void;
  onCaseUpdated?: () => void;
}

export function CaseDetailModal({
  caseItem,
  isOpen,
  onClose,
  onOpenExtraction,
  onCaseUpdated,
}: CaseDetailModalProps) {
  const { transitionCase, assignCase, addNote } = useCaseStore();
  const { user } = useAuthStore();

  const [noteText, setNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [operators, setOperators] = useState<User[]>([]);

  // Transition confirmation dialog state
  const [targetStatus, setTargetStatus] = useState<CaseStatus | null>(null);
  const [closureReason, setClosureReason] = useState<ClosureReason | ''>('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [transitionNote, setTransitionNote] = useState('');
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const isSupervisor = user?.role === 'supervisor';
  const canWrite = (user?.role === 'operator' || isSupervisor) && caseItem?.status !== 'closed';

  // Supervisors assign anyone; operators may only take or drop a case themselves (contract §6.3).
  useEffect(() => {
    if (!isSupervisor) return;
    api
      .getUsers({ role: 'operator' })
      .then((res) => setOperators(res.data))
      .catch((err) => toast(errorMessage(err, 'Could not load operators.'), 'error'));
  }, [isSupervisor]);

  if (!caseItem) return null;

  const assignable: User[] = isSupervisor ? operators : user ? [user] : [];

  const handleAssign = async (operatorId: string | null) => {
    try {
      await assignCase(caseItem.id, operatorId);
      onCaseUpdated?.();
    } catch (err) {
      toast(errorMessage(err, 'Could not change the assignment.'), 'error');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setIsSubmittingNote(true);
    try {
      await addNote(caseItem.id, noteText.trim());
      setNoteText('');
      onCaseUpdated?.();
    } catch (err) {
      toast(errorMessage(err, 'Could not save the note.'), 'error');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleInviteVictim = async () => {
    setIsInviting(true);
    try {
      await api.inviteVictim(caseItem.id);
      toast(`Invitation emailed to ${caseItem.victim.email}. The link works for 7 days.`, 'success');
    } catch (err) {
      toast(errorMessage(err, 'Could not send the invitation.'), 'error');
    } finally {
      setIsInviting(false);
    }
  };

  const openTransition = (next: CaseStatus) => {
    setTargetStatus(next);
    setClosureReason(next === 'closed' ? caseItem.allowed_closure_reasons[0] ?? '' : '');
    setPayoutAmount('');
    setTransitionNote('');
    setTransitionError(null);
  };

  const confirmTransition = async () => {
    if (!targetStatus) return;
    const isPayout = targetStatus === 'closed' && closureReason === 'paid_out';
    const amount = Number(payoutAmount);
    if (isPayout && (!payoutAmount || !Number.isFinite(amount) || amount < 0)) {
      setTransitionError('Enter the amount paid out (0 or more).');
      return;
    }
    setIsTransitioning(true);
    setTransitionError(null);
    try {
      const updated = await transitionCase(caseItem.id, {
        to_status: targetStatus,
        ...(targetStatus === 'closed' && closureReason ? { closure_reason: closureReason } : {}),
        ...(isPayout ? { payout_amount: amount } : {}),
        ...(transitionNote.trim() ? { note: transitionNote.trim() } : {}),
      });
      // null means the case was stale: the store reloaded it and told the user.
      setTargetStatus(null);
      if (updated) {
        toast(`Case moved to ${updated.status.replace('_', ' ')}.`, 'success');
        onCaseUpdated?.();
      }
    } catch (err) {
      setTransitionError(errorMessage(err, 'Could not change the status.'));
    } finally {
      setIsTransitioning(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="4xl">
      <div className="space-y-6 font-['Space_Grotesk',sans-serif]">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#EDE8D5] border-2 border-[#09090B] shadow-hard-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-black tracking-tight text-[#09090B]">
                {caseItem.reference}
              </span>
              <Badge status={caseItem.status}>{caseItem.status.replace('_', ' ')}</Badge>
              <Badge deadlineState={caseItem.deadline_state}>
                {caseItem.deadline_state.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono font-bold text-[#52525B]">
              <span className="flex items-center gap-1 text-[#09090B]">
                <Building2 className="w-4 h-4" />
                {caseItem.bank_name}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Reported {formatDate(caseItem.reported_date)}
              </span>
              {caseItem.deadline && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-[#FF334B]">
                    <Clock className="w-3.5 h-3.5" />
                    Deadline: {formatDateTime(caseItem.deadline)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Operator Assignment */}
          <div className="flex items-center gap-2">
            <label htmlFor="case-operator" className="text-xs font-bold uppercase text-[#52525B]">
              OPERATOR:
            </label>
            {canWrite ? (
              <select
                id="case-operator"
                value={caseItem.assigned_operator?.id || ''}
                onChange={(e) => void handleAssign(e.target.value || null)}
                className="text-xs font-bold bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl px-3 py-1.5 shadow-hard-sm focus:outline-none cursor-pointer text-[#09090B]"
              >
                <option value="">Unassigned</option>
                {caseItem.assigned_operator && !assignable.some((u) => u.id === caseItem.assigned_operator?.id) && (
                  <option value={caseItem.assigned_operator.id} disabled>
                    {caseItem.assigned_operator.name}
                  </option>
                )}
                {assignable.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id === user?.id ? `${u.name} (me)` : u.name}
                  </option>
                ))}
              </select>
            ) : (
              <span id="case-operator" className="text-xs font-bold text-[#09090B]">
                {caseItem.assigned_operator?.name ?? 'Unassigned'}
              </span>
            )}
          </div>
        </div>

        {/* 6-Stage Statutory Lifecycle Stepper */}
        <div className="p-5 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard">
          <CaseProgressStepper currentStatus={caseItem.status} closureReason={caseItem.closure_reason} />
        </div>

        {/* Dynamic Action Buttons */}
        {canWrite && (
          <div className="p-4 rounded-2xl border-2 border-[#09090B] bg-[#D2E823] text-[#09090B] shadow-hard flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#09090B]">
                STATUTORY WORKFLOW ACTIONS
              </p>
              <p className="text-[11px] font-mono text-[#09090B]">
                Next steps allowed by the Relief Act for this stage
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {caseItem.allowed_transitions.map((nextStatus) => (
                <Button
                  key={nextStatus}
                  size="sm"
                  variant={nextStatus === 'closed' ? 'destructive' : 'primary'}
                  onClick={() => openTransition(nextStatus)}
                  className="shadow-hard-sm"
                >
                  {transitionLabel(caseItem.status, nextStatus)}
                </Button>
              ))}
              {caseItem.victim.email && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleInviteVictim}
                  isLoading={isInviting}
                  className="gap-1.5 shadow-hard-sm"
                  title="Email the victim a link to follow this case online"
                >
                  <MailPlus className="w-3.5 h-3.5 text-[#09090B]" />
                  INVITE VICTIM
                </Button>
              )}
            </div>
          </div>
        )}

        {caseItem.status === 'closed' && (
          <div className="p-4 rounded-2xl border-2 border-[#09090B] bg-[#EDE8D5] text-xs font-bold text-[#09090B]" role="status">
            This case is closed ({caseItem.closure_reason?.replace('_', ' ') ?? 'no reason'}
            {caseItem.payout_amount != null ? `, paid out ${formatCurrency(caseItem.payout_amount, caseItem.currency)}` : ''}
            ). It is read-only.
          </div>
        )}

        {/* Case Info Grid (Victim & Fraud Facts) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Victim Contact */}
          <div className="p-5 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard space-y-3">
            <h4 className="text-xs font-['Dela_Gothic_One'] uppercase tracking-wider text-[#09090B] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#09090B]" />
              VICTIM CLAIMANT DETAILS
            </h4>
            <div className="space-y-2 text-xs font-medium">
              <div className="flex justify-between border-b-2 border-[#09090B]/20 pb-1.5">
                <span className="text-[#52525B]">Full Name:</span>
                <span className="font-bold text-[#09090B] uppercase">{caseItem.victim.name}</span>
              </div>
              <div className="flex justify-between border-b-2 border-[#09090B]/20 pb-1.5">
                <span className="text-[#52525B]">Phone:</span>
                <span className="font-mono text-[#09090B]">{caseItem.victim.phone || '—'}</span>
              </div>
              <div className="flex justify-between border-b-2 border-[#09090B]/20 pb-1.5">
                <span className="text-[#52525B]">Email:</span>
                <span className="font-mono text-[#09090B]">{caseItem.victim.email || '—'}</span>
              </div>
              <div className="flex justify-between border-b-2 border-[#09090B]/20 pb-1.5">
                <span className="text-[#52525B]">Address:</span>
                <span className="text-[#09090B] text-right font-medium">{caseItem.victim.address || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#52525B]">Preferred Language:</span>
                <Badge variant="outline" className="uppercase font-mono text-[10px]">
                  {caseItem.victim.preferred_language}
                </Badge>
              </div>
            </div>
          </div>

          {/* Fraud & Transaction Facts */}
          <div className="p-5 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard space-y-3">
            <h4 className="text-xs font-['Dela_Gothic_One'] uppercase tracking-wider text-[#09090B] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FF334B]" />
              FRAUD FINANCIAL FACTS
            </h4>
            <div className="space-y-2 text-xs font-medium">
              <div className="flex justify-between border-b-2 border-[#09090B]/20 pb-1.5">
                <span className="text-[#52525B]">Amount Lost:</span>
                <span className="font-['Dela_Gothic_One'] text-base text-[#09090B]">
                  {formatCurrency(caseItem.amount, caseItem.currency)}
                </span>
              </div>
              <div className="flex justify-between border-b-2 border-[#09090B]/20 pb-1.5">
                <span className="text-[#52525B]">Wire Date:</span>
                <span className="font-mono text-[#09090B]">
                  {caseItem.transfer_date ? formatDate(caseItem.transfer_date) : '—'}
                </span>
              </div>
              <div className="flex justify-between border-b-2 border-[#09090B]/20 pb-1.5">
                <span className="text-[#52525B]">Suspect Account:</span>
                <span className="font-mono font-bold text-[#FF334B]">
                  {caseItem.account_number || '—'}
                </span>
              </div>
              <div className="flex justify-between border-b-2 border-[#09090B]/20 pb-1.5">
                <span className="text-[#52525B]">Mule Holder Name:</span>
                <span className="text-[#09090B] font-bold uppercase">
                  {caseItem.account_holder_name || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#52525B]">Scam Typology:</span>
                <Badge variant="acid" className="uppercase">
                  {caseItem.scam_type || 'Unclassified'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Attached Documents & AI Extractions */}
        <div className="p-5 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard space-y-3">
          <h4 className="text-xs font-['Dela_Gothic_One'] uppercase tracking-wider text-[#09090B] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#09090B]" />
            EVIDENCE DOCUMENTS & OCR EXTRACTIONS ({caseItem.documents.length})
          </h4>

          {caseItem.documents.length === 0 ? (
            <p className="text-xs text-[#52525B] font-mono italic">
              No files uploaded yet. Case is currently flagged with `missing_fields: ["document"]`.
            </p>
          ) : (
            <div className="space-y-2.5">
              {caseItem.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border-2 border-[#09090B] bg-[#EDE8D5] shadow-hard-sm"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-[#09090B]" />
                    <div>
                      <p className="text-xs font-bold uppercase text-[#09090B]">{doc.filename}</p>
                      <p className="text-[11px] font-mono text-[#52525B]">
                        {doc.doc_type} • {(doc.size_bytes / 1024).toFixed(1)} KB • Uploaded by{' '}
                        {doc.uploaded_by.name}
                      </p>
                    </div>
                  </div>

                  {doc.latest_extraction && canWrite && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-[#09090B]">
                        CONF: {((doc.latest_extraction.overall_confidence || 0) * 100).toFixed(0)}%
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onOpenExtraction?.(doc.latest_extraction!.id)}
                        className="gap-1.5 text-xs h-8 shadow-hard-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        REVIEW OCR
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes & Audit Thread */}
        <div className="p-5 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard space-y-4">
          <h4 className="text-xs font-['Dela_Gothic_One'] uppercase tracking-wider text-[#09090B]">
            OPERATOR AUDIT NOTES ({caseItem.notes.length})
          </h4>

          {canWrite && (
          <form onSubmit={handleAddNote} className="space-y-2">
            <textarea
              aria-label="New case note"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Record statutory verification notes, bank dispatch reference, or victim contact log..."
              rows={2}
              className="w-full text-xs font-bold rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] p-3 shadow-hard-sm focus:outline-none placeholder:text-[#71717A]"
            />
            <div className="flex justify-end">
              <Button size="sm" type="submit" isLoading={isSubmittingNote} disabled={!noteText.trim()} className="gap-1.5 shadow-hard-sm">
                <Send className="w-3.5 h-3.5" /> POST LOG
              </Button>
            </div>
          </form>
          )}

          <div className="space-y-2.5 max-h-48 overflow-y-auto">
            {caseItem.notes.map((note) => (
              <div key={note.id} className="p-3 rounded-xl border-2 border-[#09090B] bg-[#EDE8D5] text-xs space-y-1">
                <div className="flex justify-between font-bold text-[#09090B]">
                  <span className="uppercase text-[#09090B] font-['Dela_Gothic_One']">{note.author.name}</span>
                  <span className="text-[10px] font-mono text-[#52525B]">
                    {formatDateTime(note.created_at)}
                  </span>
                </div>
                <p className="text-[#09090B] font-medium leading-relaxed">{note.body}</p>
              </div>
            ))}
          </div>
        </div>

        <CaseDocumentsPanel caseId={caseItem.id} onExtractionReady={onOpenExtraction} />
        <StaffChatPanel caseId={caseItem.id} canReply={user?.role === 'operator' || isSupervisor} />
        <CaseHistoryPanel caseId={caseItem.id} />
      </div>

      {/* Transition Confirmation Dialog */}
      {targetStatus && (
        <Modal
          isOpen={true}
          onClose={() => setTargetStatus(null)}
          title={`Confirm Milestone: ${targetStatus.replace('_', ' ')}`}
          maxWidth="md"
        >
          <div className="space-y-4 py-2 font-['Space_Grotesk',sans-serif]">
            <p className="text-xs font-medium text-[#52525B]">
              Advancing case <span className="font-mono font-bold text-[#09090B]">{caseItem.reference}</span> from{' '}
              <Badge status={caseItem.status}>{caseItem.status.replace('_', ' ')}</Badge> to{' '}
              <Badge status={targetStatus}>{targetStatus.replace('_', ' ')}</Badge>.
            </p>

            {targetStatus === 'closed' && (
              <div className="space-y-1.5">
                <label htmlFor="closure-reason" className="text-xs font-bold uppercase text-[#09090B]">
                  CLOSURE REASON:
                </label>
                <select
                  id="closure-reason"
                  value={closureReason}
                  onChange={(e) => setClosureReason(e.target.value as ClosureReason)}
                  className="w-full text-xs font-bold bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-2.5 shadow-hard-sm"
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
                  AMOUNT PAID OUT ({caseItem.currency}):
                </label>
                <input
                  id="payout-amount"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full text-xs font-bold bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-2.5 shadow-hard-sm"
                />
              </div>
            )}

            {transitionError && (
              <p role="alert" className="text-xs font-bold text-[#FF334B]">
                {transitionError}
              </p>
            )}

            <div className="space-y-1.5">
              <label htmlFor="transition-note" className="text-xs font-bold uppercase text-[#09090B]">
                AUDIT NOTE / MANDATE REF:
              </label>
              <input
                id="transition-note"
                type="text"
                value={transitionNote}
                onChange={(e) => setTransitionNote(e.target.value)}
                placeholder="Statutory reason for status transition..."
                className="w-full text-xs font-bold bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-2.5 shadow-hard-sm"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t-2 border-[#09090B]">
              <Button size="sm" variant="outline" onClick={() => setTargetStatus(null)} className="shadow-hard-sm">
                CANCEL
              </Button>
              <Button size="sm" variant="primary" onClick={confirmTransition} isLoading={isTransitioning} className="shadow-hard-sm">
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> CONFIRM TRANSITION
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
