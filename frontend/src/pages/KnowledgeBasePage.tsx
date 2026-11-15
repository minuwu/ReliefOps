import { useCallback, useEffect, useState } from 'react';
import type { Bank, KbDocument, KbDocumentStatus } from '@/types/api';
import { api } from '@/services/api';
import { kbApi } from '@/services/kbApi';
import { errorMessage } from '@/services/http';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';
import { KbUploadPanel } from '@/components/kb/KbUploadPanel';
import { KbDocumentList } from '@/components/kb/KbDocumentList';

function useKbBanks() {
  const [banks, setBanks] = useState<Bank[]>([]);

  useEffect(() => {
    // Read-only import of api.listBanks() from @/services/api with fallback to getBanks
    const apiWithList = api as unknown as { listBanks?: () => Promise<{ data: Bank[] }> };
    const loadBanks = typeof apiWithList.listBanks === 'function' ? apiWithList.listBanks() : api.getBanks();
    loadBanks
      .then((res) => setBanks(res.data))
      .catch(() => setBanks([]));
  }, []);

  return banks;
}

function useKbDocuments(bankFilter: string, statusFilter: KbDocumentStatus | '') {
  const [documents, setDocuments] = useState<KbDocument[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDocuments = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    const params: { bank_id?: string; status?: KbDocumentStatus } = {};
    if (bankFilter) params.bank_id = bankFilter;
    if (statusFilter) params.status = statusFilter;

    kbApi
      .list(params)
      .then((res) => setDocuments(res.data))
      .catch((err) => setLoadError(errorMessage(err, 'Could not load bluebook documents.')))
      .finally(() => setIsLoading(false));
  }, [bankFilter, statusFilter]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  return { documents, isLoading, loadError, loadDocuments };
}

function useKbActions(loadDocuments: () => void) {
  const pushToast = useToastStore((s) => s.push);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const handlePublish = async (doc: KbDocument) => {
    setPublishingId(doc.id);
    try {
      await kbApi.publish(doc.id);
      pushToast(`Bluebook "${doc.title}" published successfully.`, 'success');
      loadDocuments();
    } catch (err) {
      pushToast(errorMessage(err, 'Could not publish document.'), 'error');
    } finally {
      setPublishingId(null);
    }
  };

  const handleArchive = async (doc: KbDocument) => {
    try {
      await kbApi.archive(doc.id);
      pushToast(`Bluebook "${doc.title}" archived.`, 'success');
      loadDocuments();
    } catch (err) {
      pushToast(errorMessage(err, 'Could not archive document.'), 'error');
    }
  };

  return { publishingId, handlePublish, handleArchive };
}

export function KnowledgeBasePage() {
  const me = useAuthStore((s) => s.user);
  const isSupervisor = me?.role === 'supervisor';
  const isBankViewer = me?.role === 'bank_viewer';

  const [statusFilter, setStatusFilter] = useState<KbDocumentStatus | ''>('');
  const [bankFilter, setBankFilter] = useState<string>('');

  const banks = useKbBanks();
  const { documents, isLoading, loadError, loadDocuments } = useKbDocuments(bankFilter, statusFilter);
  const { publishingId, handlePublish, handleArchive } = useKbActions(loadDocuments);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 font-['Space_Grotesk',sans-serif]">
      <header className="border-b-2 border-[#09090B] pb-6">
        <h1 className="text-2xl sm:text-3xl font-['Dela_Gothic_One'] text-[#09090B]">
          Knowledge base
        </h1>
        <p className="text-sm text-[#52525B] mt-1">
          Bank guidance documents and operations bluebooks.
        </p>
      </header>

      {loadError && (
        <div role="alert" className="rounded-xl border border-[#FF334B]/30 bg-[#FF334B]/10 p-4 text-xs font-bold text-[#FF334B]">
          {loadError}
        </div>
      )}

      {isSupervisor && <KbUploadPanel banks={banks} onUploaded={loadDocuments} />}

      <KbDocumentList
        documents={documents}
        banks={banks}
        isLoading={isLoading}
        isSupervisor={isSupervisor}
        isBankViewer={isBankViewer}
        statusFilter={statusFilter}
        bankFilter={bankFilter}
        publishingId={publishingId}
        onStatusFilterChange={setStatusFilter}
        onBankFilterChange={setBankFilter}
        onPublish={handlePublish}
        onArchive={handleArchive}
      />
    </div>
  );
}
