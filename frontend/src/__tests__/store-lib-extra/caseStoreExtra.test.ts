import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCaseStore } from '@/store/useCaseStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';
import { DEMO_USERS } from '@/services/mockData';
import { api } from '@/services/api';
import type { Case, Note } from '@/types/api';

function makeCase(overrides: Partial<Case> = {}): Case {
  return {
    id: 'case-test-42',
    reference: 'RFR-2026-00042',
    bank_id: 'bank_b',
    bank_name: 'Birch Regional Bank',
    victim_name: 'Rina Example',
    amount: 250000,
    currency: 'JPY',
    scam_type: 'impersonation',
    status: 'received',
    deadline: null,
    deadline_state: 'on_track',
    assigned_operator: null,
    reported_date: '2026-11-01',
    updated_at: '2026-11-11T14:20:00Z',
    flags: {
      missing_fields: [],
      ai_review_pending: false,
      shared_account_case_count: 0,
      victim_question_pending: false,
      possible_duplicate: false,
    },
    victim: {
      name: 'Rina Example',
      phone: null,
      email: null,
      address: null,
      preferred_language: 'ja',
    },
    transfer_date: null,
    account_number: null,
    account_holder_name: null,
    description: null,
    channel: 'web_form',
    closure_reason: null,
    version: 1,
    payout_amount: null,
    created_at: '2026-11-01T09:15:00Z',
    closed_at: null,
    allowed_transitions: ['verified'],
    allowed_closure_reasons: ['withdrawn', 'rejected'],
    documents: [],
    notes: [],
    ...overrides,
  };
}

describe('useCaseStore extra coverage', () => {
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
    vi.restoreAllMocks();
  });

  it('sets error when fetching cases fails', async () => {
    vi.spyOn(api, 'getCases').mockRejectedValueOnce(new Error('Failed to reach backend'));

    await useCaseStore.getState().fetchCases();

    const state = useCaseStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Failed to load cases.');
  });

  it('sets error and returns null when fetching case by id fails', async () => {
    vi.spyOn(api, 'getCaseById').mockRejectedValueOnce(new Error('Case not found'));

    const res = await useCaseStore.getState().fetchCaseById('unknown-case-id');

    const state = useCaseStore.getState();
    expect(res).toBeNull();
    expect(state.isDetailLoading).toBe(false);
    expect(state.selectedCase).toBeNull();
    expect(state.error).toBe('Failed to load case.');
  });

  it('transitions case using existing selected case version', async () => {
    const existingCase = makeCase({
      id: 'case-sel-1',
      version: 5,
      status: 'received',
    });
    const transitionedCase = makeCase({
      ...existingCase,
      version: 6,
      status: 'verified',
    });
    useCaseStore.setState({ selectedCase: existingCase });

    const getCaseSpy = vi.spyOn(api, 'getCaseById');
    const transitionSpy = vi.spyOn(api, 'transitionCase').mockResolvedValueOnce({
      success: true,
      data: transitionedCase,
      message: 'OK',
    });
    vi.spyOn(api, 'getCases').mockResolvedValueOnce({
      success: true,
      data: { items: [], total: 0, page: 1, page_size: 10 },
      message: 'OK',
    });

    const result = await useCaseStore.getState().transitionCase('case-sel-1', {
      to_status: 'verified',
      note: 'Verified manually',
    });

    expect(result).toEqual(transitionedCase);
    expect(getCaseSpy).not.toHaveBeenCalled();
    expect(transitionSpy).toHaveBeenCalledWith('case-sel-1', {
      to_status: 'verified',
      note: 'Verified manually',
      expected_version: 5,
    });
    expect(useCaseStore.getState().selectedCase).toEqual(transitionedCase);
  });

  it('transitions case by fetching version when selectedCase is absent or mismatched', async () => {
    useCaseStore.setState({ selectedCase: null });
    const fetchedCase = makeCase({
      id: 'case-unloaded-1',
      version: 9,
      status: 'verified',
    });
    const transitionedCase = makeCase({
      ...fetchedCase,
      version: 10,
      status: 'account_check',
    });

    const getCaseSpy = vi.spyOn(api, 'getCaseById').mockResolvedValueOnce({
      success: true,
      data: fetchedCase,
      message: 'OK',
    });
    const transitionSpy = vi.spyOn(api, 'transitionCase').mockResolvedValueOnce({
      success: true,
      data: transitionedCase,
      message: 'OK',
    });
    vi.spyOn(api, 'getCases').mockResolvedValueOnce({
      success: true,
      data: { items: [], total: 0, page: 1, page_size: 10 },
      message: 'OK',
    });

    const result = await useCaseStore.getState().transitionCase('case-unloaded-1', {
      to_status: 'account_check',
    });

    expect(result).toEqual(transitionedCase);
    expect(getCaseSpy).toHaveBeenCalledWith('case-unloaded-1');
    expect(transitionSpy).toHaveBeenCalledWith('case-unloaded-1', {
      to_status: 'account_check',
      expected_version: 9,
    });
  });

  it('rethrows unexpected error on transition failure', async () => {
    useCaseStore.setState({
      selectedCase: makeCase({ id: 'case-err', version: 1 }),
    });
    vi.spyOn(api, 'transitionCase').mockRejectedValueOnce(new Error('Gateway timeout'));

    await expect(
      useCaseStore.getState().transitionCase('case-err', { to_status: 'closed' })
    ).rejects.toThrow('Gateway timeout');

    expect(useCaseStore.getState().error).toBe('Something went wrong.');
  });

  it('sets error and rethrows when assignCase fails', async () => {
    vi.spyOn(api, 'assignCase').mockRejectedValueOnce(new Error('Permission denied'));

    await expect(
      useCaseStore.getState().assignCase('case-1', 'op-2')
    ).rejects.toThrow('Permission denied');

    expect(useCaseStore.getState().error).toBe('Failed to assign operator.');
  });

  it('adds note when selectedCase is not currently loaded', async () => {
    useCaseStore.setState({ selectedCase: null });
    const mockNote: Note = {
      id: 'note-1',
      body: 'Detached note',
      author: { id: 'u1', name: 'Op' },
      created_at: '2026-11-15T12:00:00Z',
    };
    const addNoteSpy = vi.spyOn(api, 'addCaseNote').mockResolvedValueOnce({
      success: true,
      data: mockNote,
      message: 'OK',
    });

    await useCaseStore.getState().addNote('case-other', 'Detached note');

    expect(addNoteSpy).toHaveBeenCalledWith('case-other', 'Detached note');
    expect(useCaseStore.getState().selectedCase).toBeNull();
  });

  it('sets error and rethrows when addNote fails', async () => {
    vi.spyOn(api, 'addCaseNote').mockRejectedValueOnce(new Error('Disk write failed'));

    await expect(
      useCaseStore.getState().addNote('case-1', 'Test note')
    ).rejects.toThrow('Disk write failed');

    expect(useCaseStore.getState().error).toBe('Failed to add note.');
  });
});
