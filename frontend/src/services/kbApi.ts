/**
 * Knowledge Base (Bluebooks) API client (contract v0.4.2, docs/API_SPEC.md §6.8).
 * Manages bank guidance documents cited by the victim assistant.
 */
import type { ApiResponse, AuditAction, BankId, KbDocument, KbDocumentStatus, Language } from '@/types/api';
import { USE_MOCK, apiError, isApiError, mockEnvelope, mockFailure, request } from './http';
import { actorOf, addAudit, currentUser, db, nowIso } from './mockStore';
import { DEMO_BANKS } from './mockData';

export interface KbListParams {
  bank_id?: string;
  status?: KbDocumentStatus;
}

export interface KbUploadPayload {
  file: File;
  bank_id: string;
  title: string;
  version: string;
  language: Language;
  audience?: 'victim_facing' | 'staff_only';
}

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

function parseUploadPayload(payload: KbUploadPayload | FormData): KbUploadPayload {
  if (payload instanceof FormData) {
    const file = payload.get('file');
    if (!file || !(file instanceof File)) {
      throw apiError('BAD_REQUEST', 'A valid file is required.');
    }
    const bank_id = String(payload.get('bank_id') || '');
    const title = String(payload.get('title') || '');
    const version = String(payload.get('version') || '');
    const language = (payload.get('language') || 'ja') as Language;
    const audienceVal = payload.get('audience');
    const audience = audienceVal === 'staff_only' ? 'staff_only' : 'victim_facing';
    return { file, bank_id, title, version, language, audience };
  }
  return payload;
}

function validateUploadPayload(data: KbUploadPayload): void {
  const { file, bank_id, title, version, language } = data;
  if (!file) throw apiError('BAD_REQUEST', 'A file is required.');
  const isAllowedType =
    file.type === 'application/pdf' ||
    file.type === 'text/plain' ||
    file.name.toLowerCase().endsWith('.pdf') ||
    file.name.toLowerCase().endsWith('.txt');
  if (!isAllowedType) {
    throw apiError('BAD_REQUEST', 'Unsupported file type. Use PDF or TXT.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw apiError('FILE_TOO_LARGE', 'File is larger than 20 MB');
  }
  if (file.size === 0) throw apiError('BAD_REQUEST', 'File cannot be empty.');
  if (!bank_id) throw apiError('VALIDATION_ERROR', 'Bank is required.');
  if (!title.trim() || title.trim().length > 200) {
    throw apiError('VALIDATION_ERROR', 'Title must be between 1 and 200 characters.');
  }
  if (!version.trim() || version.trim().length > 40) {
    throw apiError('VALIDATION_ERROR', 'Version must be between 1 and 40 characters.');
  }
  if (!['en', 'ja', 'bn'].includes(language)) {
    throw apiError('VALIDATION_ERROR', 'Language must be en, ja, or bn.');
  }
}

function logAudit(
  action: AuditAction,
  bank_id: string,
  summary: string,
  changes: Record<string, { from: unknown; to: unknown }> | null,
  metadata: Record<string, unknown>
): void {
  const user = currentUser();
  addAudit({
    actor: actorOf(user),
    action,
    case_id: null,
    case_reference: null,
    bank_id,
    summary,
    changes,
    metadata,
  });
}

/* --- Mock Operations ----------------------------------------------------- */

function mockList(params: KbListParams): KbDocument[] {
  const user = currentUser();
  let list = [...db.kbDocuments];
  if (user.role === 'bank_viewer' && user.bank_id) {
    list = list.filter((d) => d.bank_id === user.bank_id);
  }
  if (params.bank_id) {
    list = list.filter((d) => d.bank_id === params.bank_id);
  }
  if (params.status) {
    list = list.filter((d) => d.status === params.status);
  }
  return list;
}

function mockUpload(data: KbUploadPayload): KbDocument {
  const user = currentUser();
  if (user.role !== 'supervisor') {
    throw apiError('FORBIDDEN', 'Only supervisors can upload bluebooks.');
  }
  const bank = DEMO_BANKS.find((b) => b.id === data.bank_id);
  const doc: KbDocument = {
    id: `kb-${Date.now()}`,
    bank_id: data.bank_id,
    bank_name: bank ? bank.name : data.bank_id,
    title: data.title.trim(),
    version: data.version.trim(),
    language: data.language,
    status: 'ready',
    passage_count: 24,
    error: null,
    uploaded_by: { id: user.id, name: user.name },
    uploaded_at: nowIso(),
    published_at: null,
    audience: data.audience ?? 'victim_facing',
  };
  db.kbDocuments = [doc, ...db.kbDocuments];
  logAudit(
    'kb.document_uploaded',
    doc.bank_id,
    `Bluebook uploaded: ${doc.title} (v${doc.version})`,
    null,
    { document_id: doc.id, bank_id: doc.bank_id, version: doc.version }
  );
  return doc;
}

function archiveSuperseded(older: KbDocument, newVersion: string): void {
  logAudit(
    'kb.document_archived',
    older.bank_id,
    `Bluebook archived: ${older.title} (v${older.version}) superseded by v${newVersion}`,
    { status: { from: 'published', to: 'archived' } },
    { document_id: older.id, version: older.version }
  );
}

function mockPublish(id: string): KbDocument {
  const user = currentUser();
  if (user.role !== 'supervisor') {
    throw apiError('FORBIDDEN', 'Only supervisors can publish bluebooks.');
  }
  const doc = db.kbDocuments.find((d) => d.id === id);
  if (!doc) throw apiError('RESOURCE_NOT_FOUND', 'Document not found.');
  if (doc.status !== 'ready') {
    throw apiError('INVALID_STATUS_TRANSITION', 'Only a ready document can be published', {
      from: doc.status,
      to: 'published',
      allowed: [],
    });
  }

  const older = db.kbDocuments.find(
    (d) =>
      d.id !== doc.id &&
      d.bank_id === doc.bank_id &&
      d.title.trim().toLowerCase() === doc.title.trim().toLowerCase() &&
      d.status === 'published'
  );

  const updated: KbDocument = { ...doc, status: 'published', published_at: nowIso() };
  db.kbDocuments = db.kbDocuments.map((d) => {
    if (d.id === doc.id) return updated;
    if (older && d.id === older.id) return { ...d, status: 'archived' as KbDocumentStatus };
    return d;
  });

  logAudit(
    'kb.document_published',
    doc.bank_id,
    `Bluebook published: ${doc.title} (v${doc.version})`,
    { status: { from: 'ready', to: 'published' } },
    { document_id: doc.id, version: doc.version }
  );

  if (older) archiveSuperseded(older, doc.version);
  return updated;
}

function mockArchive(id: string): KbDocument {
  const user = currentUser();
  if (user.role !== 'supervisor') {
    throw apiError('FORBIDDEN', 'Only supervisors can archive bluebooks.');
  }
  const doc = db.kbDocuments.find((d) => d.id === id);
  if (!doc) throw apiError('RESOURCE_NOT_FOUND', 'Document not found.');
  if (doc.status !== 'published') {
    throw apiError('INVALID_STATUS_TRANSITION', 'Only a published document can be archived', {
      from: doc.status,
      to: 'archived',
      allowed: [],
    });
  }

  const updated: KbDocument = { ...doc, status: 'archived' };
  db.kbDocuments = db.kbDocuments.map((d) => (d.id === doc.id ? updated : d));

  logAudit(
    'kb.document_archived',
    doc.bank_id,
    `Bluebook archived: ${doc.title} (v${doc.version})`,
    { status: { from: 'published', to: 'archived' } },
    { document_id: doc.id, version: doc.version }
  );
  return updated;
}

/* --- Public Client -------------------------------------------------------- */

export const kbApi = {
  list(params: KbListParams = {}): Promise<ApiResponse<KbDocument[]>> {
    if (!USE_MOCK) {
      const q = new URLSearchParams();
      if (params.bank_id) q.set('bank_id', params.bank_id);
      if (params.status) q.set('status', params.status);
      const qs = q.toString() ? `?${q.toString()}` : '';
      return request<KbDocument[]>(`/api/kb/documents${qs}`);
    }
    return mockEnvelope(mockList(params));
  },

  upload(payload: KbUploadPayload | FormData): Promise<ApiResponse<KbDocument>> {
    let data: KbUploadPayload;
    try {
      data = parseUploadPayload(payload);
      validateUploadPayload(data);
    } catch (err) {
      if (isApiError(err)) return mockFailure(err);
      return mockFailure(apiError('VALIDATION_ERROR', 'Validation failed.'));
    }

    if (USE_MOCK) {
      try {
        const doc = mockUpload(data);
        return mockEnvelope(doc, 'Uploaded. Document is ready.');
      } catch (err) {
        if (isApiError(err)) return mockFailure(err);
        return mockFailure(apiError('INTERNAL_ERROR', 'Could not upload bluebook.'));
      }
    }

    const formData = payload instanceof FormData ? payload : new FormData();
    if (!(payload instanceof FormData)) {
      formData.append('file', data.file);
      formData.append('bank_id', data.bank_id as BankId);
      formData.append('title', data.title.trim());
      formData.append('version', data.version.trim());
      formData.append('language', data.language);
      if (data.audience) formData.append('audience', data.audience);
    }

    return request<KbDocument>('/api/kb/documents', {
      method: 'POST',
      body: formData,
    });
  },

  publish(id: string): Promise<ApiResponse<KbDocument>> {
    if (!USE_MOCK) {
      return request<KbDocument>(`/api/kb/documents/${id}/publish`, { method: 'POST' });
    }
    try {
      const updated = mockPublish(id);
      return mockEnvelope(updated, 'Published');
    } catch (err) {
      if (isApiError(err)) return mockFailure(err);
      return mockFailure(apiError('INTERNAL_ERROR', 'Could not publish document.'));
    }
  },

  archive(id: string): Promise<ApiResponse<KbDocument>> {
    if (!USE_MOCK) {
      return request<KbDocument>(`/api/kb/documents/${id}/archive`, { method: 'POST' });
    }
    try {
      const updated = mockArchive(id);
      return mockEnvelope(updated, 'Archived');
    } catch (err) {
      if (isApiError(err)) return mockFailure(err);
      return mockFailure(apiError('INTERNAL_ERROR', 'Could not archive document.'));
    }
  },
};
