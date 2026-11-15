import { create } from 'zustand';
import type { Case, CaseSummary, TransitionPayload } from '@/types/api';
import { api, type CaseQuery } from '@/services/api';
import { errorMessage, isApiError } from '@/services/http';
import { toast } from './useToastStore';

type CaseFilters = Omit<CaseQuery, 'page' | 'page_size'>;

/** Transition body without the version: the store fills it in from the loaded case. */
export type TransitionInput = Omit<TransitionPayload, 'expected_version'>;

interface CaseState {
  cases: CaseSummary[];
  selectedCase: Case | null;
  filters: CaseFilters;
  isLoading: boolean;
  isDetailLoading: boolean;
  error: string | null;

  fetchCases: () => Promise<void>;
  fetchCaseById: (caseId: string) => Promise<Case | null>;
  clearSelected: () => void;
  setFilters: (filters: Partial<CaseFilters>) => void;
  transitionCase: (caseId: string, input: TransitionInput) => Promise<Case | null>;
  assignCase: (caseId: string, operatorId: string | null) => Promise<void>;
  addNote: (caseId: string, body: string) => Promise<void>;
}

export const useCaseStore = create<CaseState>((set, get) => {
  /** Uses the loaded case's version when it is fresh, otherwise loads it first. */
  async function loadVersion(caseId: string): Promise<number> {
    const loaded = get().selectedCase;
    if (loaded?.id === caseId) return loaded.version;
    const res = await api.getCaseById(caseId);
    return res.data.version;
  }

  /** Never retries a stale write: reloads and tells the user, so nobody's change is lost. */
  async function guardStale<T>(caseId: string, write: () => Promise<T>): Promise<T | null> {
    try {
      return await write();
    } catch (err) {
      if (isApiError(err) && err.code === 'STALE_CASE') {
        await get().fetchCaseById(caseId);
        toast('Someone else changed this case. We reloaded it. Please check and try again.', 'error');
        return null;
      }
      set({ error: errorMessage(err) });
      throw err;
    }
  }

  return {
    cases: [],
    selectedCase: null,
    filters: {},
    isLoading: false,
    isDetailLoading: false,
    error: null,

    fetchCases: async () => {
      set({ isLoading: true, error: null });
      try {
        const res = await api.getCases(get().filters);
        set({ cases: res.data.items, isLoading: false });
      } catch (err) {
        set({ isLoading: false, error: errorMessage(err, 'Failed to load cases.') });
      }
    },

    fetchCaseById: async (caseId) => {
      set({ isDetailLoading: true, error: null });
      try {
        const res = await api.getCaseById(caseId);
        set({ selectedCase: res.data, isDetailLoading: false });
        return res.data;
      } catch (err) {
        set({ isDetailLoading: false, selectedCase: null, error: errorMessage(err, 'Failed to load case.') });
        return null;
      }
    },

    clearSelected: () => set({ selectedCase: null }),

    setFilters: (newFilters) => {
      set({ filters: { ...get().filters, ...newFilters } });
      void get().fetchCases();
    },

    transitionCase: (caseId, input) =>
      guardStale(caseId, async () => {
        const expected_version = await loadVersion(caseId);
        const res = await api.transitionCase(caseId, { ...input, expected_version });
        set({ selectedCase: res.data });
        void get().fetchCases();
        return res.data;
      }),

    assignCase: async (caseId, operatorId) => {
      try {
        const res = await api.assignCase(caseId, operatorId);
        set({ selectedCase: res.data });
        void get().fetchCases();
      } catch (err) {
        set({ error: errorMessage(err, 'Failed to assign operator.') });
        throw err;
      }
    },

    addNote: async (caseId, body) => {
      try {
        const res = await api.addCaseNote(caseId, body);
        set({ selectedCase: res.data });
      } catch (err) {
        set({ error: errorMessage(err, 'Failed to add note.') });
        throw err;
      }
    },
  };
});
