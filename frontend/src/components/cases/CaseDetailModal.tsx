import { useState } from 'react';
import { Case, CaseStatus, ClosureReason } from '@/types/api';
import { useCaseStore } from '@/store/useCaseStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { DEMO_USERS } from '@/services/mockData';
import { api } from '@/services/api';
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
} from 'lucide-react';

interface CaseDetailModalProps {
  caseItem: Case | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenExtraction?: (extractionId: string) => void;
}

export function CaseDetailModal({
  caseItem,
  isOpen,
  onClose,
  onOpenExtraction,
}: CaseDetailModalProps) {
  const { transitionCase, assignCase, addNote } = useCaseStore();
  const { user } = useAuthStore();

  const [noteText, setNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [isIssuingCode, setIsIssuingCode] = useState(false);

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
    } finally {
      setIsTransitioning(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="4xl">
      <div className="space-y-6">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-muted/40 border border-border">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-bold tracking-tight text-foreground">
                {caseItem.reference}
              </span>
              <Badge status={caseItem.status}>{caseItem.status.replace('_', ' ').toUpperCase()}</Badge>
              <Badge deadlineState={caseItem.deadline_state}>
                {caseItem.deadline_state.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Building2 className="w-3.5 h-3.5 text-primary" />
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
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Deadline: {formatDateTime(caseItem.deadline)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Operator Assignment Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Assigned:</span>
            <select
              value={caseItem.assigned_operator?.id || ''}
              onChange={(e) => assignCase(caseItem.id, e.target.value || null)}
              className="text-xs bg-background border border-input rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
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

        {/* Dynamic Action Buttons (Populated from contract allowed_transitions) */}
        {caseItem.allowed_transitions.length > 0 && (
          <div className="p-3.5 rounded-lg border border-primary/20 bg-primary/5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-foreground">Permitted Status Actions</p>
              <p className="text-[11px] text-muted-foreground">
                Actions permitted for your role ({user?.role}) per contract rules
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {caseItem.allowed_transitions.map((nextStatus) => (
                <Button
                  key={nextStatus}
                  size="sm"
                  variant={nextStatus === 'closed' ? 'destructive' : 'primary'}
                  onClick={() => setTargetStatus(nextStatus)}
                >
                  Move to {nextStatus.replace('_', ' ')}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={handleIssueCode}
                isLoading={isIssuingCode}
                className="gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                Issue Access Code
              </Button>
            </div>
          </div>
        )}

        {/* Access Code Banner when issued */}
        {issuedCode && (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                Victim Portal Access Code Issued
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-400">
                Share this secure one-time code with the victim to unlock case self-service & assistant.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-md border border-amber-500/40 font-mono font-bold text-sm tracking-widest text-foreground">
              {issuedCode}
            </div>
          </div>
        )}

        {/* Case Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Victim Contact */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              Victim Details
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-muted-foreground">Full Name:</span>
                <span className="font-semibold text-foreground">{caseItem.victim.name}</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-mono text-foreground">{caseItem.victim.phone || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-mono text-foreground">{caseItem.victim.email || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-muted-foreground">Address:</span>
                <span className="text-foreground text-right">{caseItem.victim.address || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preferred Language:</span>
                <Badge variant="outline" className="uppercase font-mono text-[10px]">
                  {caseItem.victim.preferred_language}
                </Badge>
              </div>
            </div>
          </div>

          {/* Fraud & Transaction Facts */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Financial & Incident Facts
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-muted-foreground">Amount Lost:</span>
                <span className="font-bold text-foreground text-base">
                  {formatCurrency(caseItem.amount, caseItem.currency)}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-muted-foreground">Transfer Date:</span>
                <span className="font-medium text-foreground">
                  {caseItem.transfer_date ? formatDate(caseItem.transfer_date) : '—'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-muted-foreground">Suspect Account No:</span>
                <span className="font-mono font-semibold text-foreground">
                  {caseItem.account_number || '—'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-muted-foreground">Beneficiary Name:</span>
                <span className="text-foreground font-medium">
                  {caseItem.account_holder_name || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scam Categorization:</span>
                <Badge variant="warning" className="capitalize">
                  {caseItem.scam_type || 'Unclassified'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Incident Narrative */}
        {caseItem.description && (
          <div className="p-4 rounded-xl border border-border bg-card space-y-1.5">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Victim Statement
            </h4>
            <p className="text-sm text-foreground/90 leading-relaxed italic bg-muted/30 p-3 rounded-lg border border-border/40">
              "{caseItem.description}"
            </p>
          </div>
        )}

        {/* Attached Documents & AI Extractions */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Attached Case Documents ({caseItem.documents.length})
            </span>
          </h4>

          {caseItem.documents.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No files uploaded yet. Case is currently flagged with `missing_fields: ["document"]`.
            </p>
          ) : (
            <div className="space-y-2">
              {caseItem.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.doc_type} • {(doc.size_bytes / 1024).toFixed(1)} KB • Uploaded by{' '}
                        {doc.uploaded_by.name}
                      </p>
                    </div>
                  </div>

                  {doc.latest_extraction && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        AI Conf: {((doc.latest_extraction.overall_confidence || 0) * 100).toFixed(0)}%
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenExtraction?.(doc.latest_extraction!.id)}
                        className="gap-1.5 text-xs h-7"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        Review Extraction
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes & Audit Thread */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-4">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Internal Staff Notes ({caseItem.notes.length})
          </h4>

          <form onSubmit={handleAddNote} className="space-y-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add an internal operations note (e.g., verification step confirmed)..."
              rows={2}
              className="w-full text-xs rounded-md border border-input bg-background p-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-end">
              <Button size="sm" type="submit" isLoading={isSubmittingNote} disabled={!noteText.trim()}>
                <Send className="w-3.5 h-3.5 mr-1.5" /> Post Note
              </Button>
            </div>
          </form>

          <div className="space-y-2.5 max-h-48 overflow-y-auto">
            {caseItem.notes.map((note) => (
              <div key={note.id} className="p-2.5 rounded-lg bg-muted/40 text-xs space-y-1">
                <div className="flex justify-between font-medium text-foreground">
                  <span className="font-semibold text-primary">{note.author.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateTime(note.created_at)}
                  </span>
                </div>
                <p className="text-foreground/90">{note.body}</p>
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
          title={`Confirm Status Transition: ${targetStatus.replace('_', ' ').toUpperCase()}`}
          maxWidth="md"
        >
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Transitioning case <span className="font-mono font-bold text-foreground">{caseItem.reference}</span> from{' '}
              <Badge status={caseItem.status}>{caseItem.status}</Badge> to{' '}
              <Badge status={targetStatus}>{targetStatus}</Badge>.
            </p>

            {targetStatus === 'closed' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Closure Reason:</label>
                <select
                  value={closureReason}
                  onChange={(e) => setClosureReason(e.target.value as ClosureReason)}
                  className="w-full text-xs bg-background border border-input rounded-md p-2"
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
              <label className="text-xs font-semibold text-foreground">Audit Reason / Note:</label>
              <input
                type="text"
                value={transitionNote}
                onChange={(e) => setTransitionNote(e.target.value)}
                placeholder="Reason for status change..."
                className="w-full text-xs bg-background border border-input rounded-md p-2"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button size="sm" variant="outline" onClick={() => setTargetStatus(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={confirmTransition} isLoading={isTransitioning}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Confirm Transition
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
