import { useState } from 'react';
import type { Case, CaseStatus, ClosureReason, User } from '@/types/api';
import { useCaseStore } from '@/store/useCaseStore';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/services/api';
import { errorMessage } from '@/services/http';
import { CaseProgressStepper } from './CaseProgressStepper';
import { CaseDocumentsPanel } from './CaseDocumentsPanel';
import { CaseHistoryPanel } from './CaseHistoryPanel';
import { StaffChatPanel } from './StaffChatPanel';
import { CaseDetailTabs, CaseDetailTab } from './CaseDetailTabs';
import { CaseTransitionModal } from './CaseTransitionModal';
import { CaseDetailHeader } from './detail/CaseDetailHeader';
import { CaseTransitionControls } from './detail/CaseTransitionControls';
import { CaseFactsOverview } from './detail/CaseFactsOverview';
import { CaseNotesSection } from './detail/CaseNotesSection';

interface CaseDetailModalProps {
  caseItem: Case | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenExtraction?: (extractionId: string) => void;
  onCaseUpdated?: () => void;
}

interface CaseDetailContentProps {
  caseItem: Case;
  onOpenExtraction?: (extractionId: string) => void;
  onCaseUpdated?: () => void;
}

function CaseDetailContent({
  caseItem,
  onOpenExtraction,
  onCaseUpdated,
}: CaseDetailContentProps) {
  const { transitionCase, assignCase, addNote } = useCaseStore();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<CaseDetailTab>('overview');
  const [noteText, setNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  // Transition confirmation dialog state
  const [targetStatus, setTargetStatus] = useState<CaseStatus | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const isSupervisor = user?.role === 'supervisor';
  const canWrite = (user?.role === 'operator' || isSupervisor) && caseItem.status !== 'closed';

  // Supervisors assign anyone; operators may only take or drop a case themselves
  const operatorsResource = useAsyncResource(
    isSupervisor ? 'supervisor-operators' : null,
    async () => {
      try {
        const res = await api.getUsers({ role: 'operator' });
        return res.data;
      } catch (err) {
        toast(errorMessage(err, 'Could not load operators.'), 'error');
        throw err;
      }
    }
  );

  const operators = operatorsResource.data ?? [];
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
    <>
      <div className="space-y-5 font-['Space_Grotesk',sans-serif]">
        {/* Header Ribbon */}
        <CaseDetailHeader
          caseItem={caseItem}
          canWrite={canWrite}
          assignable={assignable}
          currentUserId={user?.id}
          onAssign={handleAssign}
        />

        {/* 6-Stage Statutory Lifecycle Stepper */}
        <div className="p-4 rounded-xl border border-[#09090B]/15 bg-[#EDE8D5]/30">
          <CaseProgressStepper currentStatus={caseItem.status} closureReason={caseItem.closure_reason} />
        </div>

        {/* Progressive Disclosure Tab Bar */}
        <CaseDetailTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          documentCount={caseItem.documents.length}
          hasPendingQuestion={caseItem.flags?.victim_question_pending}
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
            <CaseTransitionControls
              caseItem={caseItem}
              canWrite={canWrite}
              onOpenTransition={openTransition}
              onInviteVictim={handleInviteVictim}
              isInviting={isInviting}
            />

            {/* Case Info Grid: Definition Lists */}
            <CaseFactsOverview caseItem={caseItem} />

            {/* Operator Notes */}
            <CaseNotesSection
              notes={caseItem.notes}
              canWrite={canWrite}
              noteText={noteText}
              onNoteTextChange={setNoteText}
              onSubmitNote={handleAddNote}
              isSubmittingNote={isSubmittingNote}
            />
          </div>
        )}

        {activeTab === 'documents' && (
          <div role="tabpanel" id="tabpanel-documents" aria-labelledby="tab-documents">
            <CaseDocumentsPanel caseId={caseItem.id} onExtractionReady={onOpenExtraction} />
          </div>
        )}

        {activeTab === 'messages' && (
          <div role="tabpanel" id="tabpanel-messages" aria-labelledby="tab-messages">
            <StaffChatPanel caseId={caseItem.id} canReply={user?.role === 'operator' || isSupervisor} />
          </div>
        )}

        {activeTab === 'history' && (
          <div role="tabpanel" id="tabpanel-history" aria-labelledby="tab-history">
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
    </>
  );
}

export function CaseDetailModal({
  caseItem,
  isOpen,
  onClose,
  onOpenExtraction,
  onCaseUpdated,
}: CaseDetailModalProps) {
  if (!caseItem) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="4xl">
      <CaseDetailContent
        key={caseItem.id}
        caseItem={caseItem}
        onOpenExtraction={onOpenExtraction}
        onCaseUpdated={onCaseUpdated}
      />
    </Modal>
  );
}
