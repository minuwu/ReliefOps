import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Clock, Download, FileText, Loader2, RefreshCw, Sparkles, Upload } from 'lucide-react';
import type { DocumentMeta, DocumentType } from '@/types/api';
import { documentsApi, validateDocumentFile } from '@/services/documentsApi';
import { errorMessage } from '@/services/http';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export interface CaseDocumentsPanelProps {
  caseId: string;
  onExtractionReady?: (extractionId: string) => void;
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  transfer_receipt: 'Transfer Receipt / Slip',
  bank_statement: 'Bank Statement',
  police_report: 'Police Report',
  id_document: 'Identity Document',
  intake_form: 'Intake Form',
  other: 'Other Document',
};

const DOC_TYPES = Object.keys(DOC_TYPE_LABELS) as DocumentType[];

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function ExtractionBadge({ extraction }: { extraction: DocumentMeta['latest_extraction'] }) {
  if (!extraction) return <Badge variant="secondary">No OCR</Badge>;
  const conf = extraction.overall_confidence !== null ? ` (${Math.round(extraction.overall_confidence * 100)}%)` : '';
  if (extraction.status === 'pending_review') {
    return (
      <Badge variant="warning" reviewLane={extraction.review_lane ?? undefined} title={`Status: Pending Review${conf}`}>
        <Clock className="w-3 h-3 mr-1" />
        Needs Review{conf}
      </Badge>
    );
  }
  if (extraction.status === 'accepted') return <Badge variant="success">Accepted</Badge>;
  if (extraction.status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="destructive">Failed</Badge>;
}

interface DocumentRowProps {
  doc: DocumentMeta;
  canWrite: boolean;
  isBusy: boolean;
  isDownloading: boolean;
  isExtracting: boolean;
  onDownload: (doc: DocumentMeta) => void;
  onExtract: (doc: DocumentMeta) => void;
}

function DocumentRow({ doc, canWrite, isBusy, isDownloading, isExtracting, onDownload, onExtract }: DocumentRowProps) {
  return (
    <div className="p-3.5 rounded-xl border-2 border-[#09090B] bg-[#EDE8D5] shadow-hard-sm space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <FileText className="w-4 h-4 text-[#09090B] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#09090B] break-all uppercase leading-tight">{doc.filename}</p>
            <p className="text-[11px] font-mono text-[#52525B] mt-0.5">
              {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type} • {formatBytes(doc.size_bytes)}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <ExtractionBadge extraction={doc.latest_extraction} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#09090B]/10">
        <span className="text-[10px] font-mono text-[#52525B]">
          By {doc.uploaded_by.name} • {formatDate(doc.uploaded_at)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDownload(doc)}
            isLoading={isDownloading}
            disabled={isBusy}
            className="h-7 px-2.5 text-[11px]"
            aria-label={`Download ${doc.filename}`}
          >
            <Download className="w-3 h-3 mr-1" />
            Download
          </Button>

          {canWrite && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onExtract(doc)}
              isLoading={isExtracting}
              disabled={isBusy}
              className="h-7 px-2.5 text-[11px]"
              aria-label={`Run AI extraction on ${doc.filename}`}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              {doc.latest_extraction ? 'Re-extract' : 'Run AI OCR'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function useFileUpload(caseId: string, onUploaded: () => Promise<void>) {
  const pushToast = useToastStore((s) => s.push);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>('transfer_receipt');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return setSelectedFile(null);
    try {
      validateDocumentFile(file);
      setSelectedFile(file);
    } catch (err) {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadError(errorMessage(err, 'Invalid file selected.'));
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return setUploadError('Please select a file to upload.');
    setIsUploading(true);
    setUploadError(null);
    try {
      await documentsApi.uploadDocument(caseId, selectedFile, docType);
      pushToast(`Uploaded ${selectedFile.name}`, 'success');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await onUploaded();
    } catch (err) {
      setUploadError(errorMessage(err, 'Failed to upload document.'));
    } finally {
      setIsUploading(false);
    }
  };

  return { selectedFile, docType, setDocType, uploadError, isUploading, fileInputRef, onFileChange, onSubmit };
}

function UploadForm({ caseId, isBusy, onUploaded }: { caseId: string; isBusy: boolean; onUploaded: () => Promise<void> }) {
  const { selectedFile, docType, setDocType, uploadError, isUploading, fileInputRef, onFileChange, onSubmit } =
    useFileUpload(caseId, onUploaded);

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="p-4 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard-sm space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-['Dela_Gothic_One'] uppercase tracking-wider text-[#09090B] flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5" />
          Upload New Evidence
        </span>
        <span className="text-[10px] font-mono text-[#52525B]">PDF, PNG, JPG, TXT (Max 10 MB)</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor={`doc-type-${caseId}`} className="block text-[11px] font-bold uppercase tracking-wider text-[#09090B] mb-1">
            Document Type
          </label>
          <select
            id={`doc-type-${caseId}`}
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType)}
            disabled={isBusy || isUploading}
            className="h-10 w-full rounded-xl border-2 border-[#09090B] bg-[#EDE8D5] px-3 text-xs font-medium text-[#09090B] shadow-[2px_2px_0px_0px_#09090B] focus:outline-none focus:shadow-hard"
          >
            {DOC_TYPES.map((type) => (
              <option key={type} value={type}>{DOC_TYPE_LABELS[type]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`doc-file-${caseId}`} className="block text-[11px] font-bold uppercase tracking-wider text-[#09090B] mb-1">
            Choose File
          </label>
          <input
            id={`doc-file-${caseId}`}
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt"
            onChange={onFileChange}
            disabled={isBusy || isUploading}
            className="h-10 w-full rounded-xl border-2 border-[#09090B] bg-[#EDE8D5] px-2 py-1 text-xs text-[#09090B] file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-2 file:border-[#09090B] file:bg-[#F8F4E8] file:text-[10px] file:font-bold file:uppercase shadow-[2px_2px_0px_0px_#09090B]"
          />
        </div>
      </div>

      {selectedFile && (
        <p className="text-[11px] font-mono text-[#09090B]">
          Selected: <span className="font-bold">{selectedFile.name}</span> ({formatBytes(selectedFile.size)})
        </p>
      )}

      {uploadError && (
        <p className="text-xs font-bold text-[#FF334B] flex items-center gap-1.5" role="alert">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {uploadError}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="sm"
        isLoading={isUploading}
        disabled={!selectedFile || isBusy}
        className="w-full h-9 shadow-hard-sm text-xs"
      >
        <Upload className="w-3.5 h-3.5 mr-1.5" />
        Upload Document
      </Button>
    </form>
  );
}

export function CaseDocumentsPanel({ caseId, onExtractionReady }: CaseDocumentsPanelProps) {
  const user = useAuthStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);
  const canWrite = user?.role === 'operator' || user?.role === 'supervisor';

  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const isBusy = isLoading || extractingId !== null || downloadingId !== null;

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await documentsApi.listCaseDocuments(caseId);
      setDocs(res.data);
    } catch (err) {
      setLoadError(errorMessage(err, 'Failed to load case documents.'));
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleDownload = async (doc: DocumentMeta) => {
    setDownloadingId(doc.id);
    try {
      const { blob, filename } = await documentsApi.downloadDocument(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      pushToast(`Downloaded ${filename}`, 'success');
    } catch (err) {
      pushToast(errorMessage(err, 'Failed to download document.'), 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExtract = async (doc: DocumentMeta) => {
    setExtractingId(doc.id);
    try {
      const res = await documentsApi.extractDocument(doc.id);
      pushToast('AI extraction complete. Ready for human review.', 'success');
      await loadDocuments();
      onExtractionReady?.(res.data.id);
    } catch (err) {
      pushToast(errorMessage(err, 'AI extraction failed.'), 'error');
    } finally {
      setExtractingId(null);
    }
  };

  return (
    <div className="space-y-4 font-['Space_Grotesk',sans-serif]">
      <div className="flex items-center justify-between border-b-2 border-[#09090B] pb-3">
        <h4 className="text-xs font-['Dela_Gothic_One'] uppercase tracking-wider text-[#09090B] flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#09090B]" />
          EVIDENCE DOCUMENTS ({docs.length})
        </h4>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void loadDocuments()}
          disabled={isBusy}
          aria-label="Refresh documents list"
          className="h-7 px-2 text-[11px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isLoading && (
        <div className="p-6 text-center text-xs font-bold uppercase text-[#52525B] flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading case documents...
        </div>
      )}

      {loadError && !isLoading && (
        <div className="p-4 rounded-xl border-2 border-[#FF334B] bg-[#FFF0F2] text-xs font-bold text-[#FF334B] flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {loadError}
          </span>
          <Button size="sm" variant="outline" onClick={() => void loadDocuments()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !loadError && docs.length === 0 && (
        <div className="p-6 text-center rounded-xl border-2 border-dashed border-[#09090B]/30 bg-[#EDE8D5]/50 space-y-1">
          <p className="text-xs font-bold uppercase text-[#09090B]">No documents attached yet</p>
          <p className="text-[11px] text-[#52525B]">
            {canWrite
              ? 'Upload a bank receipt, statement, or report below to begin AI OCR extraction.'
              : 'No documents have been uploaded for this case.'}
          </p>
        </div>
      )}

      {!isLoading && !loadError && docs.length > 0 && (
        <div className="space-y-3">
          {docs.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              canWrite={canWrite}
              isBusy={isBusy}
              isDownloading={downloadingId === doc.id}
              isExtracting={extractingId === doc.id}
              onDownload={(d) => void handleDownload(d)}
              onExtract={(d) => void handleExtract(d)}
            />
          ))}
        </div>
      )}

      {canWrite && <UploadForm caseId={caseId} isBusy={isBusy} onUploaded={loadDocuments} />}
    </div>
  );
}

export default CaseDocumentsPanel;
