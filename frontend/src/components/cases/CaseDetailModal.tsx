import { useEffect, useState } from 'react';
import type { Case, CaseStatus, ClosureReason, User } from '@/types/api';
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
import { CaseDetailTabs, CaseDetailTab } from './CaseDetailTabs';
import { CaseTransitionModal } from './CaseTransitionModal';
import {
  ShieldAlert,
  Calendar,
  AlertTriangle,
  MailPlus,
  Send,
  Building2,
  Clock,
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

  const [activeTab, setActiveTab] = useState<CaseDetailTab>('overview');
  const [noteText, setNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [operators, setOperators] = useState<User[]>([]);

  // Transition confirmation dialog state
  const [targetStatus, setTargetStatus] = useState<CaseStatus | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const isSupervisor = user?.role === 'supervisor';
  const canWrite = (user?.role === 'operator' || isSupervisor) && caseItem?.status !== 'closed';

  // Reset to Overview tab when caseItem changes
  useEffect(() => {
    setActiveTab('overview');
  }, [caseItem?.id]);

  // Supervisors assign anyone; operators may only take or drop a case themselves
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
    setTransitionError(null);
  };

  const confirmTransition = async (payload: {
    to_status: CaseStatus;
    closure_reason?: ClosureReason;
    payout_amount?: number;
    note?: string;
  }) => {
    setIsTransitioning(true);
    setTransitionError(null);
    try {
      const updated = await transitionCase(caseItem.id, payload);
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
      <div className="space-y-5 font-['Space_Grotesk',sans-serif]">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#EDE8D5]/60 border border-[#09090B]/15">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xl font-bold tracking-tight text-[#09090B]">
                {caseItem.reference}
              </span>
              <Badge status={caseItem.status}>{caseItem.status.replace('_', ' ')}</Badge>
              <Badge deadlineState={caseItem.deadline_state}>
                {caseItem.deadline_state.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-[#52525B]">
              <span className="flex items-center gap-1 text-[#09090B]">
                <Building2 className="w-3.5 h-3.5" />
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
              Operator:
            </label>
            {canWrite ? (
              <select
                id="case-operator"
                value={caseItem.assigned_operator?.id || ''}
                onChange={(e) => void handleAssign(e.target.value || null)}
                className="text-xs font-bold bg-[#F8F4E8] border border-[#09090B]/20 rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#09090B] cursor-pointer text-[#09090B]"
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
        <div className="p-4 rounded-xl border border-[#09090B]/15 bg-[#EDE8D5]/30">
          <CaseProgressStepper currentStatus={caseItem.status} closureReason={caseItem.closure_reason} />
        </div>

        {/* Progressive Disclosure Tab Bar */}
        <CaseDetailTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          documentCount={caseItem.documents.length}
        />

        {/* Tab Panels */}
        {activeTab === 'overview' && (
          <div
            role="tabpanel"
            id="tabpanel-overview"
            aria-labelledby="tab-overview"
            className="space-y-4"
          >
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
                      onClick={() => openTransition(nextStatus)}
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

            {/* Case Info Grid: Definition Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Victim Information */}
              <div className="p-4 rounded-xl border border-[#09090B]/15 bg-[#EDE8D5]/30 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#09090B] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#09090B]" />
                  Victim details
                </h3>
                <dl className="divide-y divide-[#09090B]/10 text-xs">
                  <div className="flex justify-between py-2">
                    <dt className="text-xs text-[#52525B]">Full name</dt>
                    <dd className="text-sm font-medium text-[#09090B] uppercase">{caseItem.victim.name}</dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-xs text-[#52525B]">Phone</dt>
                    <dd className="text-sm font-mono text-[#09090B]">{caseItem.victim.phone || '—'}</dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-xs text-[#52525B]">Email</dt>
                    <dd className="text-sm font-mono text-[#09090B]">{caseItem.victim.email || '—'}</dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-xs text-[#52525B]">Address</dt>
                    <dd className="text-sm font-medium text-[#09090B] text-right">{caseItem.victim.address || '—'}</dd>
                  </div>
                  <div className="flex justify-between py-2 items-center">
                    <dt className="text-xs text-[#52525B]">Preferred language</dt>
                    <dd className="text-sm">
                      <Badge variant="outline" className="uppercase font-mono text-xs">
                        {caseItem.victim.preferred_language}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Fraud Financial Facts */}
              <div className="p-4 rounded-xl border border-[#09090B]/15 bg-[#EDE8D5]/30 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#09090B] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#FF334B]" />
                  Financial facts
                </h3>
                <dl className="divide-y divide-[#09090B]/10 text-xs">
                  <div className="flex justify-between py-2 items-center">
                    <dt className="text-xs text-[#52525B]">Amount lost</dt>
                    <dd className="text-sm font-bold font-mono text-[#09090B]">
                      {formatCurrency(caseItem.amount, caseItem.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-xs text-[#52525B]">Wire date</dt>
                    <dd className="text-sm font-mono text-[#09090B]">
                      {caseItem.transfer_date ? formatDate(caseItem.transfer_date) : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-xs text-[#52525B]">Suspect account</dt>
                    <dd className="text-sm font-mono font-bold text-[#FF334B]">
                      {caseItem.account_number || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-xs text-[#52525B]">Mule holder name</dt>
                    <dd className="text-sm font-bold uppercase text-[#09090B]">
                      {caseItem.account_holder_name || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2 items-center">
                    <dt className="text-xs text-[#52525B]">Scam typology</dt>
                    <dd className="text-sm">
                      <Badge variant="acid" className="uppercase">
                        {caseItem.scam_type || 'Unclassified'}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Operator Notes */}
            <div className="p-4 rounded-xl border border-[#09090B]/15 bg-[#EDE8D5]/30 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#09090B]">
                Operator notes ({caseItem.notes.length})
              </h3>

              {canWrite && (
                <form onSubmit={handleAddNote} className="space-y-2">
                  <textarea
                    aria-label="New case note"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Record verification notes, dispatch reference, or victim contact log..."
                    rows={2}
                    className="w-full text-xs font-medium rounded-xl border border-[#09090B]/20 bg-[#F8F4E8] p-3 focus:outline-none focus:border-[#09090B] placeholder:text-[#71717A]"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      type="submit"
                      isLoading={isSubmittingNote}
                      disabled={!noteText.trim()}
                      className="gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" /> Post note
                    </Button>
                  </div>
                </form>
              )}

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {caseItem.notes.length === 0 ? (
                  <p className="text-xs text-[#52525B] italic">No notes recorded yet.</p>
                ) : (
                  caseItem.notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3 rounded-lg border border-[#09090B]/10 bg-[#F8F4E8] text-xs space-y-1"
                    >
                      <div className="flex justify-between font-bold text-[#09090B]">
                        <span>{note.author.name}</span>
                        <span className="text-xs font-mono text-[#52525B] font-normal">
                          {formatDateTime(note.created_at)}
                        </span>
                      </div>
                      <p className="text-[#09090B] font-normal leading-relaxed">{note.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div
            role="tabpanel"
            id="tabpanel-documents"
            aria-labelledby="tab-documents"
          >
            <CaseDocumentsPanel
              caseId={caseItem.id}
              onExtractionReady={onOpenExtraction}
            />
          </div>
        )}

        {activeTab === 'messages' && (
          <div
            role="tabpanel"
            id="tabpanel-messages"
            aria-labelledby="tab-messages"
          >
            <StaffChatPanel
              caseId={caseItem.id}
              canReply={user?.role === 'operator' || isSupervisor}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div
            role="tabpanel"
            id="tabpanel-history"
            aria-labelledby="tab-history"
          >
            <CaseHistoryPanel caseId={caseItem.id} />
          </div>
        )}
      </div>

      {/* Transition Confirmation Dialog */}
      {targetStatus && (
        <CaseTransitionModal
          targetStatus={targetStatus}
          caseItem={caseItem}
          onClose={() => setTargetStatus(null)}
          onConfirm={confirmTransition}
          isTransitioning={isTransitioning}
          transitionError={transitionError}
        />
      )}
    </Modal>
  );
}
