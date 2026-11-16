/**
 * Documents and AI extraction service (API_SPEC §6.5).
 * Upload, download, list, and AI extraction in mock and live HTTP modes.
 */
import type {
  ApiErrorDetail,
  ApiResponse,
  Case,
  DocumentMeta,
  DocumentType,
  ExtractableField,
  Extraction,
  ReviewQueueItem,
} from '@/types/api';
import {
  API_BASE_URL,
  CHAT_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  USE_MOCK,
  apiError,
  getAuthToken,
  mockEnvelope,
  mockFailure,
  request,
  triggerUnauthorized,
} from './http';
import {
  actorOf,
  addAudit,
  currentUser,
  db,
  findVisibleCase,
  nowIso,
  saveCase,
} from './mockStore';

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.txt'];
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/plain',
]);

const mockCaseDocs: Record<string, DocumentMeta[]> = {};
const mockStoredFiles = new Map<string, File>();

/** Validates file size and MIME type according to contract limits. */
export function validateDocumentFile(file: File): void {
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw apiError('FILE_TOO_LARGE', 'File is larger than 10 MB');
  }
  const lowerName = file.name.toLowerCase();
  const hasExt = ALLOWED_EXTS.some((ext) => lowerName.endsWith(ext));
  const hasMime = file.type ? ALLOWED_MIMES.has(file.type.toLowerCase()) : false;
  if (!hasExt && !hasMime) {
    throw apiError('BAD_REQUEST', 'Unsupported file type. Use PDF, PNG, JPG or TXT.');
  }
}

function parseContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim().replace(/^["']|["']$/g, ''));
    } catch (err) {
      void err;
      return utf8[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  const std = header.match(/filename="?([^";]+)"?/i);
  return std?.[1]?.trim() ?? null;
}

function seedDocs(caseId: string): DocumentMeta[] {
  const c = findVisibleCase(caseId);
  if (!mockCaseDocs[c.id]) mockCaseDocs[c.id] = [...c.documents];
  if (c.reference && c.reference !== c.id) mockCaseDocs[c.reference] = mockCaseDocs[c.id];
  return mockCaseDocs[c.id];
}

function findMockDoc(docId: string): { doc: DocumentMeta; caseItem: Case } {
  const user = currentUser();
  for (const c of db.cases) {
    const list = mockCaseDocs[c.id] ?? c.documents;
    const found = list.find((d) => d.id === docId);
    if (found) {
      if (user.role === 'bank_viewer' && c.bank_id !== user.bank_id) {
        throw apiError('RESOURCE_NOT_FOUND', 'Document not found.');
      }
      return { doc: found, caseItem: c };
    }
  }
  throw apiError('RESOURCE_NOT_FOUND', 'Document not found.');
}

function mockUpload(caseId: string, file: File, docType: DocumentType): DocumentMeta {
  const user = currentUser();
  if (user.role !== 'operator' && user.role !== 'supervisor') {
    throw apiError('FORBIDDEN', 'Only operators and supervisors can upload documents.');
  }
  const c = findVisibleCase(caseId);
  if (c.status === 'closed') {
    throw apiError('CASE_CLOSED', 'This case is closed and can no longer be changed.');
  }
  validateDocumentFile(file);

  const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const meta: DocumentMeta = {
    id: docId,
    case_id: c.id,
    filename: file.name,
    doc_type: docType,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
    uploaded_by: { id: user.id, name: user.name },
    uploaded_at: nowIso(),
    latest_extraction: null,
  };

  mockStoredFiles.set(docId, file);
  seedDocs(c.id);
  mockCaseDocs[c.id] = [meta, ...(mockCaseDocs[c.id] ?? [])];
  if (c.reference !== c.id) mockCaseDocs[c.reference] = mockCaseDocs[c.id];
  c.documents = [meta, ...c.documents];
  c.flags.missing_fields = c.flags.missing_fields.filter((f) => f !== 'document');
  saveCase(c);

  addAudit({
    actor: actorOf(user),
    action: 'document.uploaded',
    case_id: c.id,
    case_reference: c.reference,
    bank_id: c.bank_id,
    summary: `Document uploaded: ${file.name}`,
    changes: null,
    metadata: { document_id: meta.id, doc_type: docType, size_bytes: file.size },
  });
  return meta;
}

function mockDownload(documentId: string): { blob: Blob; filename: string } {
  const user = currentUser();
  const { doc, caseItem } = findMockDoc(documentId);
  const file = mockStoredFiles.get(documentId);
  const blob =
    file ??
    new Blob([`Mock document content for ${doc.filename}`], {
      type: doc.mime_type || 'application/octet-stream',
    });
  const filename = file?.name ?? doc.filename;

  addAudit({
    actor: actorOf(user),
    action: 'document.downloaded',
    case_id: caseItem.id,
    case_reference: caseItem.reference,
    bank_id: caseItem.bank_id,
    summary: `Document downloaded: ${filename}`,
    changes: null,
    metadata: { document_id: doc.id },
  });
  return { blob, filename };
}

function buildMockExtraction(doc: DocumentMeta, c: Case): Extraction {
  const fields = [
    { name: 'victim_name', val: c.victim.name, conf: 0.98, ev: `Sender: ${c.victim.name}` },
    { name: 'amount', val: c.amount ?? 0, conf: 0.96, ev: `Amount: ¥${(c.amount ?? 0).toLocaleString()}` },
    { name: 'transfer_date', val: c.transfer_date, conf: 0.92, ev: `Date: ${c.transfer_date}` },
    { name: 'account_number', val: c.account_number, conf: 0.95, ev: `A/C: ${c.account_number}` },
    { name: 'account_holder_name', val: c.account_holder_name, conf: 0.91, ev: `Payee: ${c.account_holder_name}` },
  ].map((f) => ({
    name: f.name as ExtractableField,
    value: f.val,
    confidence: f.conf,
    evidence: f.ev,
    current_case_value: f.val,
    final_value: null,
  }));

  return {
    id: `ext-${Date.now()}`,
    document_id: doc.id,
    case_id: c.id,
    case_reference: c.reference,
    bank_id: c.bank_id,
    status: 'pending_review',
    source: 'llm',
    model: 'gemini-1.5-pro',
    prompt_version: 'v2.4-banking-receipt',
    overall_confidence: 0.94,
    review_lane: 'standard',
    fields,
    missing_fields: [],
    error: null,
    created_at: nowIso(),
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
  };
}

function supersedePriorExtraction(doc: DocumentMeta, user: { id: string; name: string }): void {
  if (doc.latest_extraction?.status !== 'pending_review') return;
  const prevId = doc.latest_extraction.id;
  const prev = db.extractions[prevId];
  if (prev && prev.status === 'pending_review') {
    db.extractions = {
      ...db.extractions,
      [prevId]: {
        ...prev,
        status: 'rejected',
        review_note: 'superseded',
        reviewed_at: nowIso(),
        reviewed_by: { id: user.id, name: user.name },
      },
    };
    db.reviewQueue = db.reviewQueue.filter((q) => q.extraction_id !== prevId);
  }
}

function appendQueueItem(ext: Extraction, c: Case, doc: DocumentMeta): void {
  const qItem: ReviewQueueItem = {
    extraction_id: ext.id,
    case_id: c.id,
    case_reference: c.reference,
    bank_id: c.bank_id,
    bank_name: c.bank_name,
    document_id: doc.id,
    document_filename: doc.filename,
    source: ext.source,
    overall_confidence: ext.overall_confidence,
    review_lane: ext.review_lane ?? 'standard',
    assigned_operator: c.assigned_operator ? { id: c.assigned_operator.id, name: c.assigned_operator.name } : null,
    created_at: ext.created_at,
  };
  db.reviewQueue = [...db.reviewQueue, qItem];
}

function updateCaseForExtraction(doc: DocumentMeta, c: Case, ext: Extraction): void {
  const brief = { id: ext.id, status: ext.status, overall_confidence: ext.overall_confidence, review_lane: ext.review_lane };
  doc.latest_extraction = brief;
  if (mockCaseDocs[c.id]) {
    mockCaseDocs[c.id] = mockCaseDocs[c.id].map((d) => (d.id === doc.id ? { ...d, latest_extraction: brief } : d));
  }
  c.documents = c.documents.map((d) => (d.id === doc.id ? { ...d, latest_extraction: brief } : d));
  c.flags.ai_review_pending = true;
  saveCase(c);
}

function mockExtract(documentId: string): Extraction {
  const user = currentUser();
  if (user.role !== 'operator' && user.role !== 'supervisor') {
    throw apiError('FORBIDDEN', 'Only operators and supervisors can run AI extraction.');
  }
  const { doc, caseItem } = findMockDoc(documentId);
  supersedePriorExtraction(doc, user);

  const extraction = buildMockExtraction(doc, caseItem);
  db.extractions = { ...db.extractions, [extraction.id]: extraction };
  appendQueueItem(extraction, caseItem, doc);
  updateCaseForExtraction(doc, caseItem, extraction);

  addAudit({
    actor: actorOf(user),
    action: 'ai.extraction_completed',
    case_id: caseItem.id,
    case_reference: caseItem.reference,
    bank_id: caseItem.bank_id,
    summary: `AI extraction completed for ${doc.filename}`,
    changes: null,
    metadata: {
      document_id: doc.id,
      extraction_id: extraction.id,
      overall_confidence: extraction.overall_confidence,
      review_lane: extraction.review_lane,
    },
  });
  return extraction;
}

/* --- Live HTTP Helpers --------------------------------------------------- */

async function liveListDocs(caseId: string): Promise<ApiResponse<DocumentMeta[]>> {
  const res = await request<Case>(`/api/cases/${caseId}`);
  return {
    ...res,
    data: res.data?.documents ?? [],
  };
}

async function liveUploadDoc(
  caseId: string,
  file: File,
  docType: DocumentType
): Promise<ApiResponse<DocumentMeta>> {
  validateDocumentFile(file);
  const formData = new FormData();
  formData.append('file', file);
  formData.append('doc_type', docType);
  return request<DocumentMeta>(`/api/cases/${caseId}/documents`, {
    method: 'POST',
    body: formData,
  });
}

async function liveDownloadDoc(docId: string): Promise<{ blob: Blob; filename: string }> {
  const token = getAuthToken();
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/documents/${docId}/file`, {
      headers,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (err) {
    void err;
    throw apiError('NETWORK_ERROR', 'Could not reach the server. Check your connection.');
  }

  if (!res.ok) {
    if (res.status === 401) {
      triggerUnauthorized();
    }
    let err: ApiErrorDetail;
    try {
      const json = (await res.json()) as { error?: ApiErrorDetail };
      err = json.error ?? apiError(`HTTP_ERROR_${res.status}`, res.statusText || 'Download failed');
    } catch (parseErr) {
      void parseErr;
      err = apiError(`HTTP_ERROR_${res.status}`, res.statusText || 'Download failed');
    }
    throw err;
  }
  const filename = parseContentDisposition(res.headers.get('Content-Disposition')) || `document-${docId}`;
  return { blob: await res.blob(), filename };
}

/* --- Public API ---------------------------------------------------------- */

export const documentsApi = {
  listCaseDocuments(caseId: string): Promise<ApiResponse<DocumentMeta[]>> {
    if (!USE_MOCK) return liveListDocs(caseId);
    try {
      return mockEnvelope(seedDocs(caseId));
    } catch (err) {
      return mockFailure(err as ApiErrorDetail);
    }
  },

  uploadDocument(
    caseId: string,
    file: File,
    documentType: DocumentType
  ): Promise<ApiResponse<DocumentMeta>> {
    if (!USE_MOCK) return liveUploadDoc(caseId, file, documentType);
    try {
      return mockEnvelope(mockUpload(caseId, file, documentType), 'Document uploaded');
    } catch (err) {
      return mockFailure(err as ApiErrorDetail);
    }
  },

  downloadDocument(documentId: string): Promise<{ blob: Blob; filename: string }> {
    if (!USE_MOCK) return liveDownloadDoc(documentId);
    return new Promise((resolve, reject) => {
      try {
        resolve(mockDownload(documentId));
      } catch (err) {
        reject(err);
      }
    });
  },

  extractDocument(documentId: string): Promise<ApiResponse<Extraction>> {
    if (!USE_MOCK) {
      return request<Extraction>(
        `/api/documents/${documentId}/extract`,
        { method: 'POST' },
        CHAT_TIMEOUT_MS
      );
    }
    try {
      return mockEnvelope(mockExtract(documentId), 'Extraction ready for review');
    } catch (err) {
      return mockFailure(err as ApiErrorDetail);
    }
  },
};
