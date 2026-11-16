/**
 * AI extraction review API client (contract v0.4.2, docs/API_SPEC.md §6.5).
 */
import type { ApiResponse, Extraction, PaginatedResult, ReviewPayload, ReviewQueueItem } from '@/types/api';
import { USE_MOCK, apiError, buildQuery, mocked, request, send } from './http';
import {
  actorOf,
  addAudit,
  assertWritable,
  currentUser,
  db,
  findVisibleCase,
  nowIso,
  saveCase,
} from './mockStore';

function mockReview(extractionId: string, p: ReviewPayload): Extraction {
  const ext = db.extractions[extractionId];
  if (!ext) throw apiError('RESOURCE_NOT_FOUND', 'Extraction not found.');
  if (ext.status !== 'pending_review') {
    throw apiError('ALREADY_REVIEWED', 'Someone already reviewed this extraction.');
  }
  if (p.decision === 'reject' && !p.note) {
    throw apiError('VALIDATION_ERROR', 'Please fix the highlighted fields.', {
      fields: [{ field: 'note', message: 'Say why you are rejecting.' }],
    });
  }
  const c = findVisibleCase(ext.case_id);
  assertWritable(c, p.expected_version);

  const user = currentUser();
  const accepted = p.decision === 'accept';
  const f = p.fields ?? {};
  saveCase({
    ...c,
    version: c.version + 1,
    updated_at: nowIso(),
    amount: accepted && f.amount !== undefined ? Number(f.amount) : c.amount,
    account_number: accepted && f.account_number !== undefined ? String(f.account_number) : c.account_number,
    account_holder_name:
      accepted && f.account_holder_name !== undefined ? String(f.account_holder_name) : c.account_holder_name,
    flags: { ...c.flags, ai_review_pending: false },
  });
  const reviewed: Extraction = {
    ...ext,
    status: accepted ? 'accepted' : 'rejected',
    reviewed_at: nowIso(),
    reviewed_by: { id: user.id, name: user.name },
    review_note: p.note ?? null,
  };
  db.extractions = { ...db.extractions, [extractionId]: reviewed };
  db.reviewQueue = db.reviewQueue.filter((q) => q.extraction_id !== extractionId);
  addAudit({
    actor: actorOf(user),
    action: accepted ? 'ai.review_accepted' : 'ai.review_rejected',
    case_id: c.id,
    case_reference: c.reference,
    bank_id: c.bank_id,
    summary: `AI extraction ${accepted ? 'accepted' : 'rejected'} by ${user.name}`,
    changes: null,
    metadata: null,
  });
  return reviewed;
}

export const reviewApi = {
  /** A page of pending items, low_confidence first (contract §6.5). */
  getReviewQueue(
    params: { lane?: 'standard' | 'low_confidence'; page?: number; page_size?: number } = {}
  ): Promise<ApiResponse<PaginatedResult<ReviewQueueItem>>> {
    if (!USE_MOCK) {
      return request<PaginatedResult<ReviewQueueItem>>(`/api/review-queue${buildQuery(params)}`);
    }
    return mocked(() => {
      const items = db.reviewQueue.filter((q) => !params.lane || q.review_lane === params.lane);
      return { items, total: items.length, page: 1, page_size: Math.max(items.length, 1) };
    });
  },

  getExtraction(extractionId: string): Promise<ApiResponse<Extraction>> {
    if (!USE_MOCK) return request<Extraction>(`/api/extractions/${extractionId}`);
    return mocked(() => {
      const ext = db.extractions[extractionId];
      if (!ext) throw apiError('RESOURCE_NOT_FOUND', 'Extraction not found.');
      return ext;
    });
  },

  reviewExtraction(extractionId: string, payload: ReviewPayload): Promise<ApiResponse<Extraction>> {
    return USE_MOCK
      ? mocked(() => mockReview(extractionId, payload), `Extraction ${payload.decision}ed`)
      : send<Extraction>(`/api/extractions/${extractionId}/review`, 'POST', payload);
  },
};
