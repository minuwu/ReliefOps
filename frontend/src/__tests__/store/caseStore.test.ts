import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCaseStore } from '@/store/useCaseStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';
import { DEMO_USERS } from '@/services/mockData';
import { api } from '@/services/api';
import { apiError } from '@/services/http';

const targetCaseId = 'c0000000-0000-4000-8000-000000000042';

describe('useCaseStore with mock data layer', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: DEMO_USERS[0],
      token: 'mock-operator-token',
    });
    useCaseStore.setState({
      cases: [],
      selectedCase: null,
      filters: {},
      isLoading: false,
      isDetailLoading: false,
      error: null,
    });
    useToastStore.setState({ toasts: [] });
  });

  it('fetches list of cases and updates store items', async () => {
    await useCaseStore.getState().fetchCases();

    const state = useCaseStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.cases.length).toBeGreaterThan(0);
    expect(state.cases[0].reference).toMatch(/^RFR-2026-/);
  });

  it('fetches a single case by id and sets selectedCase', async () => {
    const loaded = await useCaseStore.getState().fetchCaseById(targetCaseId);

    const state = useCaseStore.getState();
    expect(loaded).not.toBeNull();
    expect(state.selectedCase?.id).toBe(targetCaseId);
    expect(state.isDetailLoading).toBe(false);
  });

  it('clears selected case', async () => {
    await useCaseStore.getState().fetchCaseById(targetCaseId);
    expect(useCaseStore.getState().selectedCase).not.toBeNull();

    useCaseStore.getState().clearSelected();

    expect(useCaseStore.getState().selectedCase).toBeNull();
  });

  it('updates filters and automatically reloads cases', async () => {
    useCaseStore.getState().setFilters({ status: 'verified' });

    expect(useCaseStore.getState().filters.status).toBe('verified');
  });

  it('assigns operator to a case and updates selected case', async () => {
    await useCaseStore.getState().fetchCaseById(targetCaseId);
    const operatorId = DEMO_USERS[1].id;

    await useCaseStore.getState().assignCase(targetCaseId, operatorId);

    const state = useCaseStore.getState();
    expect(state.selectedCase?.assigned_operator?.id).toBe(operatorId);
  });

  it('appends notes to the selected case', async () => {
    await useCaseStore.getState().fetchCaseById(targetCaseId);
    const initialCount = useCaseStore.getState().selectedCase?.notes.length ?? 0;

    await useCaseStore.getState().addNote(targetCaseId, 'Auditor confirmed voucher matching.');

    const state = useCaseStore.getState();
    expect(state.selectedCase?.notes.length).toBe(initialCount + 1);
    expect(state.selectedCase?.notes[0].body).toBe('Auditor confirmed voucher matching.');
  });

  it('reloads case and notifies operator when transition triggers STALE_CASE', async () => {
    await useCaseStore.getState().fetchCaseById(targetCaseId);

    vi.spyOn(api, 'transitionCase').mockRejectedValueOnce(
      apiError('STALE_CASE', 'Conflict: case was modified elsewhere', { current_version: 5 })
    );

    const result = await useCaseStore.getState().transitionCase(targetCaseId, {
      to_status: 'account_check',
      note: 'Voucher check verified',
    });

    expect(result).toBeNull();
    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.message.includes('Someone else changed this case'))).toBe(true);

    vi.restoreAllMocks();
  });
});
