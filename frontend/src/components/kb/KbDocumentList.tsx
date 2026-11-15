import { useState } from 'react';
import { Filter } from 'lucide-react';
import type { Bank, KbDocument, KbDocumentStatus } from '@/types/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { panelClass, formatDate } from './kbFormat';

const STATUS_VARIANTS: Record<KbDocumentStatus, 'success' | 'info' | 'warning' | 'secondary' | 'destructive'> = {
  published: 'success',
  ready: 'info',
  processing: 'warning',
  archived: 'secondary',
  failed: 'destructive',
};

const STATUS_LABELS: Record<KbDocumentStatus, string> = {
  published: 'Published',
  ready: 'Ready',
  processing: 'Processing',
  archived: 'Archived',
  failed: 'Failed',
};

function StatusBadge({ status }: { status: KbDocumentStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>;
}

function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}) {
  const [isArmed, setIsArmed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  if (!isArmed) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setIsArmed(true)}>
        {label}
      </Button>
    );
  }

  const handleConfirm = async () => {
    setIsBusy(true);
    try {
      await onConfirm();
    } finally {
      setIsBusy(false);
      setIsArmed(false);
    }
  };

  return (
    <span className="inline-flex gap-1.5 items-center">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        isLoading={isBusy}
        onClick={handleConfirm}
      >
        {confirmLabel}
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={isBusy} onClick={() => setIsArmed(false)}>
        CANCEL
      </Button>
    </span>
  );
}

function DocumentActions({
  doc,
  publishingId,
  onPublish,
  onArchive,
}: {
  doc: KbDocument;
  publishingId: string | null;
  onPublish: (doc: KbDocument) => Promise<void>;
  onArchive: (doc: KbDocument) => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-2">
      {doc.status === 'ready' && (
        <Button
          type="button"
          variant="acid"
          size="sm"
          isLoading={publishingId === doc.id}
          onClick={() => onPublish(doc)}
        >
          PUBLISH
        </Button>
      )}
      {doc.status === 'published' && (
        <ConfirmButton
          label="ARCHIVE"
          confirmLabel="YES, ARCHIVE"
          onConfirm={() => onArchive(doc)}
        />
      )}
    </div>
  );
}

interface DocumentRowProps {
  doc: KbDocument;
  isSupervisor: boolean;
  publishingId: string | null;
  onPublish: (doc: KbDocument) => Promise<void>;
  onArchive: (doc: KbDocument) => Promise<void>;
}

function DocumentRow({ doc, isSupervisor, publishingId, onPublish, onArchive }: DocumentRowProps) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div className="space-y-1 text-sm max-w-xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-[#09090B] text-base">{doc.title}</span>
          <span className="font-mono text-xs font-bold text-[#52525B]">v{doc.version}</span>
          <StatusBadge status={doc.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#52525B]">
          <span className="font-semibold text-[#09090B]">{doc.bank_name || doc.bank_id}</span>
          <span>·</span>
          <span>{doc.audience === 'staff_only' ? 'Staff Only' : 'Victim Facing'}</span>
          <span>·</span>
          <span className="uppercase font-mono">{doc.language}</span>
          {doc.passage_count !== null && (
            <>
              <span>·</span>
              <span>{doc.passage_count} passages</span>
            </>
          )}
          <span>·</span>
          <span>Uploaded {formatDate(doc.uploaded_at)} by {doc.uploaded_by.name}</span>
          {doc.published_at && <span>(Published {formatDate(doc.published_at)})</span>}
        </div>
        {doc.error && <p className="text-xs font-bold text-[#FF334B]">Error: {doc.error}</p>}
      </div>

      {isSupervisor && (
        <DocumentActions
          doc={doc}
          publishingId={publishingId}
          onPublish={onPublish}
          onArchive={onArchive}
        />
      )}
    </li>
  );
}

function DocumentFilters({
  banks,
  isBankViewer,
  statusFilter,
  bankFilter,
  onStatusFilterChange,
  onBankFilterChange,
}: {
  banks: Bank[];
  isBankViewer: boolean;
  statusFilter: KbDocumentStatus | '';
  bankFilter: string;
  onStatusFilterChange: (status: KbDocumentStatus | '') => void;
  onBankFilterChange: (bankId: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#52525B]">
        <Filter className="w-3.5 h-3.5" />
        <span>Filter:</span>
      </div>
      <select
        aria-label="Filter by status"
        className="h-9 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] px-2.5 text-xs font-bold uppercase shadow-[2px_2px_0px_0px_#09090B]"
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value as KbDocumentStatus | '')}
      >
        <option value="">All Statuses</option>
        <option value="ready">Ready</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
        <option value="processing">Processing</option>
        <option value="failed">Failed</option>
      </select>
      {!isBankViewer && (
        <select
          aria-label="Filter by bank"
          className="h-9 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] px-2.5 text-xs font-bold uppercase shadow-[2px_2px_0px_0px_#09090B]"
          value={bankFilter}
          onChange={(e) => onBankFilterChange(e.target.value)}
        >
          <option value="">All Banks</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export type Props = {
  documents: KbDocument[] | null;
  banks: Bank[];
  isLoading: boolean;
  isSupervisor: boolean;
  isBankViewer: boolean;
  statusFilter: KbDocumentStatus | '';
  bankFilter: string;
  publishingId: string | null;
  onStatusFilterChange: (status: KbDocumentStatus | '') => void;
  onBankFilterChange: (bankId: string) => void;
  onPublish: (doc: KbDocument) => Promise<void>;
  onArchive: (doc: KbDocument) => Promise<void>;
};

export function KbDocumentList({
  documents,
  banks,
  isLoading,
  isSupervisor,
  isBankViewer,
  statusFilter,
  bankFilter,
  publishingId,
  onStatusFilterChange,
  onBankFilterChange,
  onPublish,
  onArchive,
}: Props) {
  return (
    <section className={panelClass} aria-labelledby="documents-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="documents-heading" className="text-base font-bold uppercase">
          Bank Guidance Documents
        </h2>
        <DocumentFilters
          banks={banks}
          isBankViewer={isBankViewer}
          statusFilter={statusFilter}
          bankFilter={bankFilter}
          onStatusFilterChange={onStatusFilterChange}
          onBankFilterChange={onBankFilterChange}
        />
      </div>

      {isLoading && !documents ? (
        <p className="text-sm text-[#52525B]">Loading documents…</p>
      ) : !documents || documents.length === 0 ? (
        <p className="text-sm text-[#52525B]">No guidance documents found.</p>
      ) : (
        <ul className="divide-y-2 divide-[#09090B]">
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              isSupervisor={isSupervisor}
              publishingId={publishingId}
              onPublish={onPublish}
              onArchive={onArchive}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
