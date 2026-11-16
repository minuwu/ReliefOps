import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reviewApi } from '@/services/reviewApi';
import { db } from '@/services/mockStore';
import { DEMO_CASES, DEMO_EXTRACTIONS, DEMO_REVIEW_QUEUE, DEMO_USERS } from '@/services/mockData';
import { clearSession } from '@/services/http';
import type { ReviewPayload } from '@/types/api';

describe('reviewApi module', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSession();
    db.cases = JSON.parse(JSON.stringify(DEMO_CASES));
    db.staff = JSON.parse(JSON.stringify(DEMO_USERS));
    db.extractions = JSON.parse(JSON.stringify(DEMO_EXTRACTIONS));
    db.reviewQueue = JSON.parse(JSON.stringify(DEMO_REVIEW_QUEUE));
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    clearSession();
    vi.restoreAllMocks();
  });

  it('lists review queue items filtered by lane', async () => {
    const standardQueue = await reviewApi.getReviewQueue({ lane: 'standard' });
    const lowConfidenceQueue = await reviewApi.getReviewQueue({ lane: 'low_confidence' });

    expect(standardQueue.success).toBe(true);
    expect(standardQueue.data.items.every((q) => q.review_lane === 'standard')).toBe(true);
    expect(lowConfidenceQueue.data.items.every((q) => q.review_lane === 'low_confidence')).toBe(true);
  });

  it('fetches an extraction by ID', async () => {
    const sampleId = Object.keys(db.extractions)[0];

    const res = await reviewApi.getExtraction(sampleId);

    expect(res.success).toBe(true);
    expect(res.data.id).toBe(sampleId);
  });

  it('throws error when fetching non-existent extraction', async () => {
    await expect(reviewApi.getExtraction('non-existent-ext')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('accepts extraction updating case fields, flags, and removes from queue', async () => {
    const sampleId = Object.keys(db.extractions)[0];
    const ext = db.extractions[sampleId];
    ext.status = 'pending_review';
    const caseItem = db.cases.find((c) => c.id === ext.case_id);
    expect(caseItem).toBeDefined();
    if (!caseItem) throw new Error('caseItem fixture not found');
    caseItem.status = 'verified';

    const payload: ReviewPayload = {
      decision: 'accept',
      expected_version: caseItem.version,
      fields: {
        amount: 2500000,
        account_number: '9988776655',
        account_holder_name: 'CERTIFIED HOLDER',
      },
      note: 'Verified from official ATM slip',
    };

    const res = await reviewApi.reviewExtraction(sampleId, payload);

    expect(res.success).toBe(true);
    expect(res.data.status).toBe('accepted');
    expect(res.data.review_note).toBe('Verified from official ATM slip');

    const updatedCase = db.cases.find((c) => c.id === caseItem.id);
    expect(updatedCase).toBeDefined();
    if (!updatedCase) throw new Error('updatedCase fixture not found');
    expect(updatedCase.amount).toBe(2500000);
    expect(updatedCase.account_number).toBe('9988776655');
    expect(updatedCase.flags.ai_review_pending).toBe(false);

    expect(db.reviewQueue.some((q) => q.extraction_id === sampleId)).toBe(false);
  });

  it('rejects extraction requiring a rejection note', async () => {
    const sampleId = Object.keys(db.extractions)[0];
    const ext = db.extractions[sampleId];
    ext.status = 'pending_review';
    const caseItem = db.cases.find((c) => c.id === ext.case_id);
    expect(caseItem).toBeDefined();
    if (!caseItem) throw new Error('caseItem fixture not found');

    const missingNotePayload: ReviewPayload = {
      decision: 'reject',
      expected_version: caseItem.version,
    };

    await expect(reviewApi.reviewExtraction(sampleId, missingNotePayload)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });

    const validRejectPayload: ReviewPayload = {
      decision: 'reject',
      expected_version: caseItem.version,
      note: 'Illegible voucher image',
    };

    const rejectRes = await reviewApi.reviewExtraction(sampleId, validRejectPayload);

    expect(rejectRes.success).toBe(true);
    expect(rejectRes.data.status).toBe('rejected');
    expect(rejectRes.data.review_note).toBe('Illegible voucher image');
  });

  it('rejects reviewing an extraction that has already been reviewed', async () => {
    const sampleId = Object.keys(db.extractions)[0];
    db.extractions[sampleId].status = 'accepted';
    const caseItem = db.cases.find((c) => c.id === db.extractions[sampleId].case_id);
    expect(caseItem).toBeDefined();
    if (!caseItem) throw new Error('caseItem fixture not found');

    const payload: ReviewPayload = {
      decision: 'accept',
      expected_version: caseItem.version,
    };

    await expect(reviewApi.reviewExtraction(sampleId, payload)).rejects.toMatchObject({
      code: 'ALREADY_REVIEWED',
    });
  });

  it('rejects review when case version is stale', async () => {
    const sampleId = Object.keys(db.extractions)[0];
    db.extractions[sampleId].status = 'pending_review';
    const caseItem = db.cases.find((c) => c.id === db.extractions[sampleId].case_id);
    expect(caseItem).toBeDefined();
    if (!caseItem) throw new Error('caseItem fixture not found');

    const stalePayload: ReviewPayload = {
      decision: 'accept',
      expected_version: caseItem.version + 999,
    };

    await expect(reviewApi.reviewExtraction(sampleId, stalePayload)).rejects.toMatchObject({
      code: 'STALE_CASE',
    });
  });

  it('interacts with live API review endpoints when in live mode', async () => {
    localStorage.setItem('reliefops_data_mode', 'live');
    vi.resetModules();

    const liveReview = await import('@/services/reviewApi');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/review-queue')) {
        return new Response(JSON.stringify({ success: true, data: { items: [], total: 0 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/api/extractions/ext-1/review')) {
        return new Response(JSON.stringify({ success: true, data: { id: 'ext-1', status: 'accepted' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/api/extractions/ext-1')) {
        return new Response(JSON.stringify({ success: true, data: { id: 'ext-1', status: 'pending_review' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    const queueRes = await liveReview.reviewApi.getReviewQueue({ lane: 'standard' });
    expect(queueRes.data.items).toEqual([]);

    const extRes = await liveReview.reviewApi.getExtraction('ext-1');
    expect(extRes.data.id).toBe('ext-1');

    const revRes = await liveReview.reviewApi.reviewExtraction('ext-1', {
      decision: 'accept',
      expected_version: 1,
    });
    expect(revRes.data.status).toBe('accepted');
  });
});
