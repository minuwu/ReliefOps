import { create } from 'zustand';
import type { ExtractableField, Extraction, ReviewQueueItem } from '@/types/api';
import { api } from '@/services/api';
import { apiError, errorMessage, isApiError } from '@/services/http';
import { toast } from './useToastStore';

type ApprovedFields = Partial<Record<ExtractableField, string | number | null>>;

function isNotFoundOrConflict(err: unknown): boolean {
  if (!isApiError(err)) return false;
  const code = (err.code || '').toUpperCase();
  if (
    code === 'RESOURCE_NOT_FOUND' ||
    code === 'NOT_FOUND' ||
    code === 'CONFLICT' ||
    code === 'ALREADY_REVIEWED' ||
    code === 'HTTP_ERROR_404' ||
    code === 'HTTP_ERROR_409' ||
    err.message.toLowerCase().includes('not found')
  ) {
    return true;
  }
  return false;
}

interface ReviewQueueState {
  queue: ReviewQueueItem[];
  activeExtraction: Extraction | null;
  isLoading: boolean;
  isActionLoading: boolean;
  error: string | null;
  extractionNotice: string | null;

  fetchQueue: () => Promise<void>;
  fetchExtraction: (extractionId: string) => Promise<void>;
  /** Returns true when the review was saved. */
  reviewExtraction: (
    extractionId: string,
    decision: 'accept' | 'reject',
    fields?: ApprovedFields,
    note?: string
  ) => Promise<boolean>;
  clearActive: () => void;
}

export const useReviewQueueStore = create<ReviewQueueState>((set, get) => ({
  queue: [],
  activeExtraction: null,
  isLoading: false,
  isActionLoading: false,
  error: null,
  extractionNotice: null,

  fetchQueue: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.getReviewQueue();
      set({ queue: res.data.items, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: errorMessage(err, 'Failed to load the review queue.') });
    }
  },

  fetchExtraction: async (extractionId) => {
    set({ isLoading: true, error: null, extractionNotice: null });
    try {
      const res = await api.getExtraction(extractionId);
      if (res.data.status !== 'pending_review') {
        set({
          activeExtraction: res.data,
          isLoading: false,
          extractionNotice:
            'This extraction is no longer waiting for review. It may already have been accepted or rejected.',
        });
      } else {
        set({ activeExtraction: res.data, isLoading: false, extractionNotice: null });
      }
    } catch (err) {
      if (isNotFoundOrConflict(err)) {
        set({
          isLoading: false,
          activeExtraction: null,
          error: null,
          extractionNotice:
            'This extraction is no longer waiting for review. It may already have been accepted or rejected.',
        });
      } else {
        set({
          isLoading: false,
          activeExtraction: null,
          error: errorMessage(err, 'Failed to load the extraction.'),
          extractionNotice: null,
        });
      }
    }
  },

  reviewExtraction: async (extractionId, decision, fields, note) => {
    set({ isActionLoading: true, error: null });
    try {
      // The version belongs to the CASE; extractions don't carry it, so load the case first.
      const caseId =
        get().activeExtraction?.case_id ??
        get().queue.find((q) => q.extraction_id === extractionId)?.case_id;
      if (!caseId) throw apiError('RESOURCE_NOT_FOUND', 'Extraction not found.');
      const { data: c } = await api.getCaseById(caseId);
      await api.reviewExtraction(extractionId, {
        decision,
        expected_version: c.version,
        ...(decision === 'accept' && fields ? { fields } : {}),
        ...(note ? { note } : {}),
      });
      set({ isActionLoading: false, activeExtraction: null, extractionNotice: null });
      toast(decision === 'accept' ? 'Values saved to the case.' : 'Extraction rejected.', 'success');
      void get().fetchQueue();
      return true;
    } catch (err) {
      set({ isActionLoading: false });
      if (isApiError(err) && (err.code === 'ALREADY_REVIEWED' || err.code === 'STALE_CASE')) {
        toast(
          err.code === 'ALREADY_REVIEWED'
            ? 'Someone else already reviewed this. The queue was refreshed.'
            : 'The case changed while you were reviewing. Please open it again.',
          'error'
        );
        set({ activeExtraction: null });
        void get().fetchQueue();
        return false;
      }
      set({ error: errorMessage(err, 'Failed to submit the review.') });
      throw err;
    }
  },

  clearActive: () => set({ activeExtraction: null, extractionNotice: null }),
}));
