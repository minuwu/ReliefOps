import { create } from 'zustand';
import { ReviewQueueItem, Extraction } from '@/types/api';
import { api } from '@/services/api';

interface ReviewQueueState {
  queue: ReviewQueueItem[];
  activeExtraction: Extraction | null;
  isLoading: boolean;
  isActionLoading: boolean;
  error: string | null;

  fetchQueue: () => Promise<void>;
  fetchExtraction: (extractionId: string) => Promise<void>;
  reviewExtraction: (
    extractionId: string,
    action: 'accept' | 'reject',
    approvedFields?: Record<string, string | number | null>,
    note?: string
  ) => Promise<void>;
  clearActive: () => void;
}

export const useReviewQueueStore = create<ReviewQueueState>((set, get) => ({
  queue: [],
  activeExtraction: null,
  isLoading: false,
  isActionLoading: false,
  error: null,

  fetchQueue: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getReviewQueue();
      set({ queue: response.data, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to load review queue' });
    }
  },

  fetchExtraction: async (extractionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getExtraction(extractionId);
      set({ activeExtraction: response.data, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to load extraction' });
    }
  },

  reviewExtraction: async (extractionId, action, approvedFields, note) => {
    set({ isActionLoading: true, error: null });
    try {
      await api.reviewExtraction(extractionId, {
        action,
        approved_fields: approvedFields,
        review_note: note,
      });
      set({ isActionLoading: false, activeExtraction: null });
      get().fetchQueue();
    } catch (err: any) {
      set({ isActionLoading: false, error: err.message || 'Failed to submit review' });
      throw err;
    }
  },

  clearActive: () => set({ activeExtraction: null }),
}));
