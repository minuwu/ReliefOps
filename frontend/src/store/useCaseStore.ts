import { create } from 'zustand';
import { Case, CaseSummary, CaseStatus, ClosureReason } from '@/types/api';
import { api } from '@/services/api';

interface CaseFilters {
  status?: string;
  bank_id?: string;
  search?: string;
}

interface CaseState {
  cases: CaseSummary[];
  selectedCase: Case | null;
  filters: CaseFilters;
  isLoading: boolean;
  isDetailLoading: boolean;
  error: string | null;

  fetchCases: () => Promise<void>;
  fetchCaseById: (caseId: string) => Promise<void>;
  setFilters: (filters: Partial<CaseFilters>) => void;
  transitionCase: (
    caseId: string,
    payload: { status: CaseStatus; closure_reason?: ClosureReason; note?: string }
  ) => Promise<void>;
  assignCase: (caseId: string, operatorId: string | null) => Promise<void>;
  addNote: (caseId: string, body: string) => Promise<void>;
}

export const useCaseStore = create<CaseState>((set, get) => ({
  cases: [],
  selectedCase: null,
  filters: {},
  isLoading: false,
  isDetailLoading: false,
  error: null,

  fetchCases: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getCases(get().filters);
      set({ cases: response.data.items, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to load cases' });
    }
  },

  fetchCaseById: async (caseId: string) => {
    set({ isDetailLoading: true, error: null });
    try {
      const response = await api.getCaseById(caseId);
      set({ selectedCase: response.data, isDetailLoading: false });
    } catch (err: any) {
      set({ isDetailLoading: false, error: err.message || 'Failed to load case details' });
    }
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
    get().fetchCases();
  },

  transitionCase: async (caseId, payload) => {
    try {
      const response = await api.transitionCase(caseId, payload);
      set({ selectedCase: response.data });
      get().fetchCases();
    } catch (err: any) {
      set({ error: err.message || 'Transition failed' });
      throw err;
    }
  },

  assignCase: async (caseId, operatorId) => {
    try {
      const response = await api.assignCase(caseId, operatorId);
      set({ selectedCase: response.data });
      get().fetchCases();
    } catch (err: any) {
      set({ error: err.message || 'Failed to assign operator' });
      throw err;
    }
  },

  addNote: async (caseId, body) => {
    try {
      const response = await api.addCaseNote(caseId, body);
      set({ selectedCase: response.data });
    } catch (err: any) {
      set({ error: err.message || 'Failed to add note' });
      throw err;
    }
  },
}));
