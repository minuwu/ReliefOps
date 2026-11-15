import { useState } from 'react';
import { Case, CaseStatus, ClosureReason } from '@/types/api';
import { useCaseStore } from '@/store/useCaseStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { GlitchText } from '@/components/ui/GlitchText';
import { StickerBadge } from '@/components/ui/StickerBadge';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { DEMO_USERS } from '@/services/mockData';
import { api } from '@/services/api';
import { CaseProgressStepper } from './CaseProgressStepper';
import {
  ShieldAlert,
  Calendar,
  AlertTriangle,
  FileText,
  KeyRound,
  CheckCircle2,
  Send,
  Building2,
  Clock,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';

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
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [isIssuingCode, setIsIssuingCode] = useState(false);
  const [hasCopiedCode, setHasCopiedCode] = useState(false);

  // Transition confirmation dialog state
  const [targetStatus, setTargetStatus] = useState<CaseStatus | null>(null);
  const [closureReason, setClosureReason] = useState<ClosureReason>('withdrawn');
  const [transitionNote, setTransitionNote] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  if (!caseItem) return null;

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setIsSubmittingNote(true);
    try {
      await addNote(caseItem.id, noteText.trim());
      setNoteText('');
      onCaseUpdated?.();
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleIssueCode = async () => {
    setIsIssuingCode(true);
    try {
      const res = await api.issueVictimAccessCode(caseItem.id);
      setIssuedCode(res.data.access_code);
    } finally {
      setIsIssuingCode(false);
    }
  };

  const confirmTransition = async () => {
    if (!targetStatus) return;
    setIsTransitioning(true);
    try {
      await transitionCase(caseItem.id, {
        status: targetStatus,
        closure_reason: targetStatus === 'closed' ? closureReason : undefined,
        note: transitionNote.trim() || undefined,
      });
      setTargetStatus(null);
      setTransitionNote('');
      onCaseUpdated?.();
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

          {/* Operator Assignment Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-[#52525B]">OPERATOR:</span>
            <select
              value={caseItem.assigned_operator?.id || ''}
              onChange={(e) => assignCase(caseItem.id, e.target.value || null)}
              className="text-xs font-bold bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl px-3 py-1.5 shadow-hard-sm focus:outline-none cursor-pointer text-[#09090B]"
            >
              <option value="">Unassigned</option>
              {DEMO_USERS.filter((u) => u.role !== 'bank_viewer').map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 6-Stage Statutory Lifecycle Stepper */}
        <div className="p-5 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard">
          <CaseProgressStepper currentStatus={caseItem.status} closureReason={caseItem.closure_reason} />
        </div>

        {/* Dynamic Action Buttons */}
        {caseItem.allowed_transitions.length > 0 && (
          <div className="p-4 rounded-2xl border-2 border-[#09090B] bg-[#D2E823] text-[#09090B] shadow-hard flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#09090B]">
                STATUTORY WORKFLOW ACTIONS
              </p>
              <p className="text-[11px] font-mono text-[#09090B]">
                Role ({user?.role}) permitted stage advancements per Relief Act regulations
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {caseItem.allowed_transitions.map((nextStatus) => (
                <Button
                  key={nextStatus}
                  size="sm"
                  variant={nextStatus === 'closed' ? 'destructive' : 'primary'}
                  onClick={() => setTargetStatus(nextStatus)}
                  className="shadow-hard-sm"
                >
                  Advance to {nextStatus.replace('_', ' ')}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={handleIssueCode}
                isLoading={isIssuingCode}
                className="gap-1.5 shadow-hard-sm"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#09090B]" />
                ISSUE CITIZEN CODE
              </Button>
            </div>
          </div>
        )}

        {/* Access Code Banner when issued */}
        {issuedCode && (
          <div className="p-5 rounded-2xl bg-[#09090B] text-[#D2E823] border-2 border-[#09090B] shadow-hard flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <GlitchText as="p" className="text-sm font-['Dela_Gothic_One'] text-[#D2E823]">
                  VICTIM ACCESS CODE ISSUED
                </GlitchText>
                <StickerBadge variant="acid" rotate="rotate-0" className="text-[10px] py-0 px-2">
                  SECURE PASSKEY
                </StickerBadge>
              </div>
              <p className="text-xs font-mono text-[#A1A1AA] mt-1">
                Provide this 6-digit access code to the victim for self-service status & AI claims assistance.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-[#F8F4E8] text-[#09090B] px-4 py-2 rounded-xl border-2 border-[#D2E823] font-mono font-black text-lg tracking-widest shadow-hard-sm">
                {issuedCode}
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(issuedCode);
                  setHasCopiedCode(true);
                  setTimeout(() => setHasCopiedCode(false), 2000);
                }}
                className="text-xs h-9 px-3 gap-1 shadow-hard-sm"
              >
                {hasCopiedCode ? <Check className="w-3.5 h-3.5 text-[#09090B]" /> : <Copy className="w-3.5 h-3.5" />}
                {hasCopiedCode ? 'COPIED' : 'COPY'}
              </Button>
            </div>
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

                  {doc.latest_extraction && (
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

          <form onSubmit={handleAddNote} className="space-y-2">
            <textarea
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
                <label className="text-xs font-bold uppercase text-[#09090B]">CLOSURE REASON:</label>
                <select
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

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-[#09090B]">AUDIT NOTE / MANDATE REF:</label>
              <input
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
