import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MAX_DOCUMENT_BYTES,
  documentsApi,
  validateDocumentFile,
} from '@/services/documentsApi';
import { db } from '@/services/mockStore';
import { DEMO_CASES, DEMO_USERS } from '@/services/mockData';
import { clearSession, storeSession } from '@/services/http';

describe('documentsApi module', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSession();
    db.cases = JSON.parse(JSON.stringify(DEMO_CASES));
    db.staff = JSON.parse(JSON.stringify(DEMO_USERS));
    db.extractions = {};
    db.reviewQueue = [];
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    clearSession();
    vi.restoreAllMocks();
  });

  it('validates accepted file formats correctly', () => {
    const pdfFile = new File(['content'], 'slip.pdf', { type: 'application/pdf' });
    const pngFile = new File(['content'], 'receipt.png', { type: 'image/png' });
    const txtFile = new File(['content'], 'note.txt', { type: 'text/plain' });

    expect(() => validateDocumentFile(pdfFile)).not.toThrow();
    expect(() => validateDocumentFile(pngFile)).not.toThrow();
    expect(() => validateDocumentFile(txtFile)).not.toThrow();
  });

  it('rejects files exceeding maximum size limit', () => {
    const largeBlob = new Uint8Array(MAX_DOCUMENT_BYTES + 1024);
    const largeFile = new File([largeBlob], 'big.pdf', { type: 'application/pdf' });

    expect(() => validateDocumentFile(largeFile)).toThrowError();
  });

  it('rejects unsupported file extensions or mime types', () => {
    const badFile = new File(['content'], 'script.exe', { type: 'application/x-msdownload' });

    expect(() => validateDocumentFile(badFile)).toThrowError();
  });

  it('lists documents for a valid case', async () => {
    const targetCase = db.cases[0];

    const res = await documentsApi.listCaseDocuments(targetCase.id);

    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('fails to list documents for a non-existent case', async () => {
    await expect(documentsApi.listCaseDocuments('non-existent-case')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('uploads a document to a case successfully by an operator', async () => {
    const targetCase = db.cases[0];
    const file = new File(['receipt data'], 'furikomi_receipt.pdf', { type: 'application/pdf' });

    const res = await documentsApi.uploadDocument(targetCase.id, file, 'furikomi_receipt');

    expect(res.success).toBe(true);
    expect(res.data.filename).toBe('furikomi_receipt.pdf');
    expect(res.data.doc_type).toBe('furikomi_receipt');

    const updatedCase = db.cases.find((c) => c.id === targetCase.id);
    expect(updatedCase?.documents.some((d) => d.id === res.data.id)).toBe(true);
    expect(updatedCase?.flags.missing_fields.includes('document')).toBe(false);
  });

  it('rejects document upload if authenticated user is a bank viewer', async () => {
    const targetCase = db.cases.find((c) => c.bank_id === 'bank_b')!;
    const bankViewer = DEMO_USERS.find((u) => u.role === 'bank_viewer')!;
    storeSession('token-viewer', bankViewer);
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

    await expect(documentsApi.uploadDocument(targetCase.id, file, 'furikomi_receipt')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects document upload on a closed case', async () => {
    const closedCase = db.cases.find((c) => c.status === 'closed') ?? db.cases[0];
    closedCase.status = 'closed';
    const file = new File(['test'], 'closed_case_doc.pdf', { type: 'application/pdf' });

    await expect(documentsApi.uploadDocument(closedCase.id, file, 'furikomi_receipt')).rejects.toMatchObject({
      code: 'CASE_CLOSED',
    });
  });

  it('downloads an existing uploaded document', async () => {
    const targetCase = db.cases[0];
    const file = new File(['dummy binary receipt'], 'transfer_slip.png', { type: 'image/png' });
    const uploaded = await documentsApi.uploadDocument(targetCase.id, file, 'furikomi_receipt');

    const downloadRes = await documentsApi.downloadDocument(uploaded.data.id);

    expect(downloadRes.filename).toBe('transfer_slip.png');
    expect(downloadRes.blob).toBeDefined();
  });

  it('downloads a pre-seeded document creating synthetic fallback blob', async () => {
    const brandNewCase = {
      ...db.cases[0],
      id: 'brand-new-case-with-preseeded-doc',
      documents: [
        {
          id: 'doc-pre-seeded-unique',
          case_id: 'brand-new-case-with-preseeded-doc',
          filename: 'pre_seeded.pdf',
          doc_type: 'furikomi_receipt' as const,
          mime_type: 'application/pdf',
          size_bytes: 1234,
          uploaded_by: { id: 'usr-1', name: 'User' },
          uploaded_at: new Date().toISOString(),
          latest_extraction: null,
        },
      ],
    };
    db.cases.push(brandNewCase);

    const downloadRes = await documentsApi.downloadDocument('doc-pre-seeded-unique');

    expect(downloadRes.filename).toBe('pre_seeded.pdf');
    expect(downloadRes.blob).toBeDefined();
  });

  it('prevents bank viewer from downloading document belonging to another bank', async () => {
    const bankACase = db.cases.find((c) => c.bank_id === 'bank_a')!;
    const file = new File(['secret bank a doc'], 'bank_a_doc.pdf', { type: 'application/pdf' });
    const uploaded = await documentsApi.uploadDocument(bankACase.id, file, 'furikomi_receipt');

    const bankBViewer = DEMO_USERS.find((u) => u.role === 'bank_viewer' && u.bank_id === 'bank_b')!;
    storeSession('token-viewer-b', bankBViewer);

    await expect(documentsApi.downloadDocument(uploaded.data.id)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('throws error when downloading a non-existent document', async () => {
    await expect(documentsApi.downloadDocument('missing-doc-id')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('triggers AI extraction for an uploaded document and enqueues review item', async () => {
    const targetCase = db.cases[0];
    const file = new File(['ocr slip content'], 'voucher.pdf', { type: 'application/pdf' });
    const uploaded = await documentsApi.uploadDocument(targetCase.id, file, 'furikomi_receipt');

    const extractRes = await documentsApi.extractDocument(uploaded.data.id);

    expect(extractRes.success).toBe(true);
    expect(extractRes.data.document_id).toBe(uploaded.data.id);
    expect(extractRes.data.status).toBe('pending_review');
    expect(db.extractions[extractRes.data.id]).toBeDefined();
    expect(db.reviewQueue.some((q) => q.extraction_id === extractRes.data.id)).toBe(true);
  });

  it('supersedes previous pending extraction when a new extraction is run on the same document', async () => {
    const targetCase = db.cases[0];
    const file = new File(['ocr slip content'], 'voucher_v2.pdf', { type: 'application/pdf' });
    const uploaded = await documentsApi.uploadDocument(targetCase.id, file, 'furikomi_receipt');

    const firstExtract = await documentsApi.extractDocument(uploaded.data.id);
    const secondExtract = await documentsApi.extractDocument(uploaded.data.id);

    expect(secondExtract.data.id).not.toBe(firstExtract.data.id);
    expect(db.extractions[firstExtract.data.id].status).toBe('rejected');
    expect(db.extractions[firstExtract.data.id].review_note).toBe('superseded');
    expect(db.reviewQueue.some((q) => q.extraction_id === firstExtract.data.id)).toBe(false);
    expect(db.reviewQueue.some((q) => q.extraction_id === secondExtract.data.id)).toBe(true);
  });

  it('rejects AI extraction execution when caller is a bank viewer', async () => {
    const targetCase = db.cases.find((c) => c.bank_id === 'bank_b')!;
    const file = new File(['test'], 'atm_slip.pdf', { type: 'application/pdf' });
    const uploaded = await documentsApi.uploadDocument(targetCase.id, file, 'furikomi_receipt');

    const bankViewer = DEMO_USERS.find((u) => u.role === 'bank_viewer')!;
    storeSession('token-viewer', bankViewer);

    await expect(documentsApi.extractDocument(uploaded.data.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('calls live endpoints when data mode is configured to live', async () => {
    localStorage.setItem('reliefops_data_mode', 'live');
    vi.resetModules();

    const liveHttp = await import('@/services/http');
    const liveDocs = await import('@/services/documentsApi');

    expect(liveHttp.USE_MOCK).toBe(false);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/cases/c-123/documents')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { id: 'doc-live-1', filename: 'live.pdf', doc_type: 'furikomi_receipt' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('/api/cases/c-123')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { id: 'c-123', documents: [{ id: 'doc-1', filename: 'seeded.pdf' }] },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('/api/documents/doc-1/file')) {
        return new Response(new Blob(['file content']), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': "attachment; filename*=UTF-8''live_doc.pdf",
          },
        });
      }
      if (urlStr.includes('/api/documents/doc-1/extract')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { id: 'ext-live-1', status: 'pending_review' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const listRes = await liveDocs.documentsApi.listCaseDocuments('c-123');
    expect(listRes.data.length).toBe(1);

    const testFile = new File(['content'], 'live.pdf', { type: 'application/pdf' });
    const uploadRes = await liveDocs.documentsApi.uploadDocument('c-123', testFile, 'furikomi_receipt');
    expect(uploadRes.data.id).toBe('doc-live-1');

    const downloadRes = await liveDocs.documentsApi.downloadDocument('doc-1');
    expect(downloadRes.filename).toBe('live_doc.pdf');

    const extractRes = await liveDocs.documentsApi.extractDocument('doc-1');
    expect(extractRes.data.id).toBe('ext-live-1');
  });
});
