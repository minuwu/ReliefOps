import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Filter, Upload } from 'lucide-react';
import type { Bank, KbDocument, KbDocumentStatus, Language } from '@/types/api';
import { api } from '@/services/api';
import { kbApi } from '@/services/kbApi';
import { errorMessage } from '@/services/http';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const panelClass = 'rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] p-5 sm:p-6 shadow-hard space-y-4';
const selectClass =
  'h-11 w-full rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] px-3 text-sm font-medium shadow-[2px_2px_0px_0px_#09090B]';
const labelClass = 'block text-xs font-bold uppercase tracking-wider text-[#09090B]';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: KbDocumentStatus }) {
  const variants: Record<KbDocumentStatus, 'success' | 'info' | 'warning' | 'secondary' | 'destructive'> = {
    published: 'success',
    ready: 'info',
    processing: 'warning',
    archived: 'secondary',
    failed: 'destructive',
  };
  const labels: Record<KbDocumentStatus, string> = {
    published: 'Published',
    ready: 'Ready',
    processing: 'Processing',
    archived: 'Archived',
    failed: 'Failed',
  };
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
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

  return (
    <span className="inline-flex gap-1.5 items-center">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        isLoading={isBusy}
        onClick={async () => {
          setIsBusy(true);
          try {
            await onConfirm();
          } finally {
            setIsBusy(false);
            setIsArmed(false);
          }
        }}
      >
        {confirmLabel}
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={isBusy} onClick={() => setIsArmed(false)}>
        CANCEL
      </Button>
    </span>
  );
}

function validateUpload(
  file: File | null,
  bankId: string,
  title: string,
  version: string
): Record<string, string> {
  const local: Record<string, string> = {};
  if (!file) {
    local.file = 'Select a PDF or TXT file to upload.';
  } else {
    const isAllowed =
      file.type === 'application/pdf' ||
      file.type === 'text/plain' ||
      file.name.toLowerCase().endsWith('.pdf') ||
      file.name.toLowerCase().endsWith('.txt');
    if (!isAllowed) local.file = 'Only PDF or TXT files are allowed.';
    if (file.size > 20 * 1024 * 1024) local.file = 'File is larger than 20 MB.';
    if (file.size === 0) local.file = 'File cannot be empty.';
  }
  if (!bankId) local.bank_id = 'Select the bank for this guidance document.';
  if (!title.trim()) local.title = 'Enter the document title.';
  else if (title.trim().length > 200) local.title = 'Title must be 200 characters or less.';
  if (!version.trim()) local.version = 'Enter the version (e.g. 2026.1).';
  else if (version.trim().length > 40) local.version = 'Version must be 40 characters or less.';
  return local;
}

interface UploadFormProps {
  banks: Bank[];
  onUploaded: (doc: KbDocument) => void;
}

function UploadBluebookForm({ banks, onUploaded }: UploadFormProps) {
  const pushToast = useToastStore((s) => s.push);
  const [file, setFile] = useState<File | null>(null);
  const [bankId, setBankId] = useState('');
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [language, setLanguage] = useState<Language>('ja');
  const [audience, setAudience] = useState<'victim_facing' | 'staff_only'>('victim_facing');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const local = validateUpload(file, bankId, title, version);
    setErrors(local);
    if (Object.keys(local).length > 0 || !file) return;

    setIsUploading(true);
    try {
      const res = await kbApi.upload({
        file,
        bank_id: bankId,
        title: title.trim(),
        version: version.trim(),
        language,
        audience,
      });
      pushToast(`Bluebook "${res.data.title}" uploaded. Ready for publishing.`, 'success');
      onUploaded(res.data);
      setFile(null);
      setTitle('');
      setVersion('');
      const input = document.getElementById('kb-file') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to upload bluebook.'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2" noValidate aria-label="Upload bluebook">
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="kb-file" className={labelClass}>
          File (PDF or TXT, max 20 MB)
        </label>
        <input
          id="kb-file"
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-[#09090B] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-2 file:border-[#09090B] file:bg-[#EDE8D5] file:text-xs file:font-bold file:uppercase file:cursor-pointer hover:file:bg-[#D2E823] cursor-pointer"
        />
        {errors.file && <p role="alert" className="text-xs font-bold text-[#FF334B]">{errors.file}</p>}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="kb-bank" className={labelClass}>
          Bank
        </label>
        <select id="kb-bank" className={selectClass} value={bankId} onChange={(e) => setBankId(e.target.value)}>
          <option value="">Select bank…</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {errors.bank_id && <p role="alert" className="text-xs font-bold text-[#FF334B]">{errors.bank_id}</p>}
      </div>

      <Input
        label="Title"
        id="kb-title"
        placeholder="e.g. Fraud Relief Operations Bluebook"
        value={title}
        error={errors.title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <Input
        label="Version"
        id="kb-version"
        placeholder="e.g. 2026.1"
        value={version}
        error={errors.version}
        onChange={(e) => setVersion(e.target.value)}
      />

      <div className="space-y-1.5">
        <label htmlFor="kb-language" className={labelClass}>
          Language
        </label>
        <select
          id="kb-language"
          className={selectClass}
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
        >
          <option value="ja">Japanese (ja)</option>
          <option value="en">English (en)</option>
          <option value="bn">Bengali (bn)</option>
        </select>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="kb-audience" className={labelClass}>
          Audience
        </label>
        <select
          id="kb-audience"
          className={selectClass}
          value={audience}
          onChange={(e) => setAudience(e.target.value as 'victim_facing' | 'staff_only')}
        >
          <option value="victim_facing">Victim Facing (Assistant cites for answers)</option>
          <option value="staff_only">Staff Only (Internal operations guide)</option>
        </select>
      </div>

      <div className="sm:col-span-2 space-y-3">
        {formError && (
          <div role="alert" className="rounded-xl border-2 border-[#FF334B] bg-[#FF334B]/10 p-3 text-xs font-bold text-[#FF334B]">
            {formError}
          </div>
        )}
        <Button type="submit" variant="primary" isLoading={isUploading} className="gap-2">
          <Upload className="w-4 h-4" /> UPLOAD BLUEBOOK
        </Button>
      </div>
    </form>
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
      )}
    </li>
  );
}

export function KnowledgeBasePage() {
  const me = useAuthStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);
  const isSupervisor = me?.role === 'supervisor';
  const isBankViewer = me?.role === 'bank_viewer';

  const [documents, setDocuments] = useState<KbDocument[] | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [statusFilter, setStatusFilter] = useState<KbDocumentStatus | ''>('');
  const [bankFilter, setBankFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

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
    // Read-only import of api.listBanks() from @/services/api with fallback to getBanks
    const apiWithList = api as unknown as { listBanks?: () => Promise<{ data: Bank[] }> };
    const loadBanks = typeof apiWithList.listBanks === 'function' ? apiWithList.listBanks() : api.getBanks();
    loadBanks
      .then((res) => setBanks(res.data))
      .catch(() => setBanks([]));
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

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

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-8 sm:py-12 space-y-6">
      <header className="border-b-2 border-[#09090B] pb-4">
        <p className="text-xs font-mono font-bold uppercase text-[#52525B]">Knowledge Base</p>
        <h1 className="text-2xl sm:text-4xl font-['Dela_Gothic_One'] uppercase text-[#09090B]">
          Bluebooks & Guidance
        </h1>
      </header>

      {loadError && (
        <div role="alert" className="rounded-xl border-2 border-[#FF334B] bg-[#FF334B]/10 p-4 text-xs font-bold text-[#FF334B]">
          {loadError}
        </div>
      )}

      {isSupervisor && (
        <section className={panelClass} aria-labelledby="upload-heading">
          <h2 id="upload-heading" className="text-base font-bold uppercase">
            Upload Bluebook
          </h2>
          <p className="text-sm text-[#52525B]">
            Upload bank guidance documents (PDF or TXT, max 20 MB). Synthetic documents only. The victim assistant
            answers using passages extracted from published victim-facing bluebooks.
          </p>
          <UploadBluebookForm banks={banks} onUploaded={loadDocuments} />
        </section>
      )}

      <section className={panelClass} aria-labelledby="documents-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="documents-heading" className="text-base font-bold uppercase">
            Bank Guidance Documents
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#52525B]">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </div>
            <select
              aria-label="Filter by status"
              className="h-9 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] px-2.5 text-xs font-bold uppercase shadow-[2px_2px_0px_0px_#09090B]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as KbDocumentStatus | '')}
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
                onChange={(e) => setBankFilter(e.target.value)}
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
                onPublish={handlePublish}
                onArchive={handleArchive}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
