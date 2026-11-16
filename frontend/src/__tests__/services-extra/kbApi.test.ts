import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { kbApi, type KbUploadPayload } from '@/services/kbApi';
import { db } from '@/services/mockStore';
import { DEMO_KB_DOCUMENTS, DEMO_USERS } from '@/services/mockData';
import { clearSession, storeSession } from '@/services/http';

describe('kbApi module', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSession();
    db.kbDocuments = JSON.parse(JSON.stringify(DEMO_KB_DOCUMENTS));
    db.staff = JSON.parse(JSON.stringify(DEMO_USERS));
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    clearSession();
    vi.restoreAllMocks();
  });

  it('lists knowledge base documents filtered by bank_id and status', async () => {
    const res = await kbApi.list({ bank_id: 'bank_b', status: 'published' });

    expect(res.success).toBe(true);
    expect(res.data.every((d) => d.bank_id === 'bank_b')).toBe(true);
    expect(res.data.every((d) => d.status === 'published')).toBe(true);
  });

  it('restricts bank viewer to viewing only their own bank documents', async () => {
    const bankBViewer = DEMO_USERS.find((u) => u.role === 'bank_viewer' && u.bank_id === 'bank_b')!;
    storeSession('token-viewer-b', bankBViewer);

    const res = await kbApi.list();

    expect(res.data.every((d) => d.bank_id === 'bank_b')).toBe(true);
  });

  it('validates upload payload rejection when file is missing or invalid', async () => {
    const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
    const emptyPayload: KbUploadPayload = {
      file: emptyFile,
      bank_id: 'bank_b',
      title: 'Empty',
      version: '1.0',
      language: 'ja',
    };
    await expect(kbApi.upload(emptyPayload)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    const badTypeFile = new File(['code'], 'guide.exe', { type: 'application/x-msdownload' });
    const badTypePayload: KbUploadPayload = {
      file: badTypeFile,
      bank_id: 'bank_b',
      title: 'Bad Type',
      version: '1.0',
      language: 'ja',
    };
    await expect(kbApi.upload(badTypePayload)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('validates upload payload metadata fields', async () => {
    const validFile = new File(['text content'], 'guide.pdf', { type: 'application/pdf' });

    await expect(
      kbApi.upload({
        file: validFile,
        bank_id: '',
        title: 'Title',
        version: '1.0',
        language: 'ja',
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });

    await expect(
      kbApi.upload({
        file: validFile,
        bank_id: 'bank_b',
        title: '',
        version: '1.0',
        language: 'ja',
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });

    await expect(
      kbApi.upload({
        file: validFile,
        bank_id: 'bank_b',
        title: 'Title',
        version: '1.0',
        language: 'fr' as unknown as 'ja',
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('parses FormData payload correctly on upload', async () => {
    const supervisor = DEMO_USERS.find((u) => u.role === 'supervisor')!;
    storeSession('token-supervisor', supervisor);
    const validFile = new File(['guidance content'], 'bluebook.txt', { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', validFile);
    formData.append('bank_id', 'bank_b');
    formData.append('title', 'FormData Bluebook');
    formData.append('version', '1.0.0');
    formData.append('language', 'en');
    formData.append('audience', 'staff_only');

    const res = await kbApi.upload(formData);

    expect(res.success).toBe(true);
    expect(res.data.title).toBe('FormData Bluebook');
    expect(res.data.audience).toBe('staff_only');
    expect(res.data.status).toBe('ready');
  });

  it('rejects upload when user is not a supervisor', async () => {
    const operator = DEMO_USERS.find((u) => u.role === 'operator')!;
    storeSession('token-operator', operator);
    const validFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' });

    await expect(
      kbApi.upload({
        file: validFile,
        bank_id: 'bank_b',
        title: 'Title',
        version: '1.0',
        language: 'ja',
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('uploads bluebook document successfully by supervisor', async () => {
    const supervisor = DEMO_USERS.find((u) => u.role === 'supervisor')!;
    storeSession('token-supervisor', supervisor);
    const file = new File(['bluebook content'], 'sop.pdf', { type: 'application/pdf' });

    const res = await kbApi.upload({
      file,
      bank_id: 'bank_b',
      title: 'Standard Operating Procedures',
      version: '2026.1',
      language: 'ja',
      audience: 'victim_facing',
    });

    expect(res.success).toBe(true);
    expect(res.data.title).toBe('Standard Operating Procedures');
    expect(res.data.status).toBe('ready');
    expect(db.kbDocuments.some((d) => d.id === res.data.id)).toBe(true);
  });

  it('publishes a ready document and supersedes older version with same title', async () => {
    const supervisor = DEMO_USERS.find((u) => u.role === 'supervisor')!;
    storeSession('token-supervisor', supervisor);

    const oldDoc = {
      id: 'kb-old-1',
      bank_id: 'bank_b',
      bank_name: 'Bank B',
      title: 'Furikomi Guideline',
      version: '1.0',
      language: 'ja' as const,
      status: 'published' as const,
      passage_count: 10,
      error: null,
      uploaded_by: { id: supervisor.id, name: supervisor.name },
      uploaded_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      audience: 'victim_facing' as const,
    };
    const newDoc = {
      ...oldDoc,
      id: 'kb-new-2',
      version: '2.0',
      status: 'ready' as const,
      published_at: null,
    };
    db.kbDocuments.push(oldDoc, newDoc);

    const res = await kbApi.publish(newDoc.id);

    expect(res.success).toBe(true);
    expect(res.data.status).toBe('published');

    const updatedOld = db.kbDocuments.find((d) => d.id === oldDoc.id);
    expect(updatedOld?.status).toBe('archived');
  });

  it('rejects publishing non-ready or non-existent document', async () => {
    const supervisor = DEMO_USERS.find((u) => u.role === 'supervisor')!;
    storeSession('token-supervisor', supervisor);

    await expect(kbApi.publish('missing-kb-id')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });

    const publishedDoc = db.kbDocuments.find((d) => d.status === 'published')!;
    await expect(kbApi.publish(publishedDoc.id)).rejects.toMatchObject({
      code: 'INVALID_STATUS_TRANSITION',
    });
  });

  it('archives a document successfully by supervisor', async () => {
    const supervisor = DEMO_USERS.find((u) => u.role === 'supervisor')!;
    storeSession('token-supervisor', supervisor);
    const targetDoc = db.kbDocuments[0];

    const res = await kbApi.archive(targetDoc.id);

    expect(res.success).toBe(true);
    expect(res.data.status).toBe('archived');

    const repeatArchive = await kbApi.archive(targetDoc.id);
    expect(repeatArchive.data.status).toBe('archived');
  });

  it('rejects archiving non-existent document', async () => {
    const supervisor = DEMO_USERS.find((u) => u.role === 'supervisor')!;
    storeSession('token-supervisor', supervisor);

    await expect(kbApi.archive('missing-kb-id')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('delegates to live endpoints when data mode is live', async () => {
    localStorage.setItem('reliefops_data_mode', 'live');
    vi.resetModules();

    const liveKb = await import('@/services/kbApi');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/kb/documents/kb-1/publish')) {
        return new Response(JSON.stringify({ success: true, data: { id: 'kb-1', status: 'published' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/api/kb/documents/kb-1/archive')) {
        return new Response(JSON.stringify({ success: true, data: { id: 'kb-1', status: 'archived' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/api/kb/documents')) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    const listRes = await liveKb.kbApi.list({ bank_id: 'bank_b' });
    expect(listRes.data).toEqual([]);

    const pubRes = await liveKb.kbApi.publish('kb-1');
    expect(pubRes.data.status).toBe('published');

    const arcRes = await liveKb.kbApi.archive('kb-1');
    expect(arcRes.data.status).toBe('archived');
  });
});
