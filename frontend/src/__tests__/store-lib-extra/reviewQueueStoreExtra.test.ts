import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useReviewQueueStore } from '@/store/useReviewQueueStore';
import { useToastStore } from '@/store/useToastStore';
import { useAuthStore } from '@/store/useAuthStore';
import { DEMO_USERS } from '@/services/mockData';
import { api } from '@/services/api';
import { apiError } from '@/services/http';
import type { Extraction, ReviewQueueItem, Case } from '@/types/api';

describe('useReviewQueueStore extra coverage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: DEMO_USERS[0],
      token: 'mock-operator-token',
    });
    useReviewQueueStore.setState({
      queue: [],
      activeExtraction: null,
      isLoading: false,
      isActionLoading: false,
      error: null,
      extractionNotice: null,
    });
    useToastStore.setState({ toasts: [] });
    vi.restoreAllMocks();
  });

  it('sets error when fetching review queue fails', async () => {
    vi.spyOn(api, 'getReviewQueue').mockRejectedValueOnce(new Error('Network offline'));

    await useReviewQueueStore.getState().fetchQueue();

    const state = useReviewQueueStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Failed to load the review queue.');
  });

  it('sets notice when extraction has already been accepted or rejected', async () => {
    const processedExtraction: Extraction = {
      id: 'ext-completed-1',
      case_id: 'c0000000-0000-4000-8000-000000000042',
      document_id: 'doc-1',
      status: 'accepted',
      fields: {},
      raw_ocr_text: 'sample text',
      overall_confidence: 0.95,
      review_lane: 'standard',
      source: 'gemini_flash',
      created_at: '2026-11-15T10:00:00Z',
      reviewed_at: '2026-11-15T11:00:00Z',
      reviewed_by: { id: 'u1', name: 'Operator' },
      review_note: 'Approved',
    };
    vi.spyOn(api, 'getExtraction').mockResolvedValueOnce({
      success: true,
      data: processedExtraction,
      message: 'OK',
    });

    await useReviewQueueStore.getState().fetchExtraction('ext-completed-1');

    const state = useReviewQueueStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.activeExtraction?.id).toBe('ext-completed-1');
    expect(state.extractionNotice).toContain('no longer waiting for review');
  });

  it('handles generic non-conflict error when fetching extraction', async () => {
    vi.spyOn(api, 'getExtraction').mockRejectedValueOnce(
      apiError('INTERNAL_SERVER_ERROR', 'Service temporarily down')
    );

    await useReviewQueueStore.getState().fetchExtraction('ext-failed-500');

    const state = useReviewQueueStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.activeExtraction).toBeNull();
    expect(state.extractionNotice).toBeNull();
    expect(state.error).toBe('Service temporarily down');
  });

  it('handles non-api error when fetching extraction', async () => {
    vi.spyOn(api, 'getExtraction').mockRejectedValueOnce(new Error('Socket disconnected'));

    await useReviewQueueStore.getState().fetchExtraction('ext-sock-err');

    const state = useReviewQueueStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.activeExtraction).toBeNull();
    expect(state.extractionNotice).toBeNull();
    expect(state.error).toBe('Failed to load the extraction.');
  });

  it('handles conflict codes like CONFLICT and HTTP_ERROR_404', async () => {
    vi.spyOn(api, 'getExtraction').mockRejectedValueOnce(
      apiError('CONFLICT', 'Version mismatch')
    );

    await useReviewQueueStore.getState().fetchExtraction('ext-conflict');

    const state = useReviewQueueStore.getState();
    expect(state.extractionNotice).toContain('no longer waiting for review');
    expect(state.error).toBeNull();
  });

  it('handles error message containing not found', async () => {
    vi.spyOn(api, 'getExtraction').mockRejectedValueOnce(
      apiError('UNKNOWN_CODE', 'Item was not found in remote cache')
    );

    await useReviewQueueStore.getState().fetchExtraction('ext-nf-str');

    const state = useReviewQueueStore.getState();
    expect(state.extractionNotice).toContain('no longer waiting for review');
    expect(state.error).toBeNull();
  });

  it('throws RESOURCE_NOT_FOUND when reviewing an extraction without case_id', async () => {
    useReviewQueueStore.setState({
      queue: [],
      activeExtraction: null,
    });

    await expect(
      useReviewQueueStore.getState().reviewExtraction('unknown-ext', 'accept')
    ).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });

    expect(useReviewQueueStore.getState().isActionLoading).toBe(false);
  });

  it('approves extraction with approved fields and updates case', async () => {
    const mockCase = {
      id: 'case-test-42',
      version: 2,
    } as Case;
    useReviewQueueStore.setState({
      activeExtraction: {
        id: 'ext-to-accept',
        case_id: 'case-test-42',
      } as Extraction,
    });
    vi.spyOn(api, 'getCaseById').mockResolvedValueOnce({
      success: true,
      data: mockCase,
      message: 'OK',
    });
    const reviewSpy = vi.spyOn(api, 'reviewExtraction').mockResolvedValueOnce({
      success: true,
      data: {} as Extraction,
      message: 'OK',
    });
    const queueSpy = vi.spyOn(api, 'getReviewQueue').mockResolvedValueOnce({
      success: true,
      data: { items: [], total: 0, page: 1, page_size: 10 },
      message: 'OK',
    });

    const success = await useReviewQueueStore.getState().reviewExtraction(
      'ext-to-accept',
      'accept',
      { amount: 1500000, account_number: '1234567' }
    );

    expect(success).toBe(true);
    expect(reviewSpy).toHaveBeenCalledWith('ext-to-accept', {
      decision: 'accept',
      expected_version: 2,
      fields: { amount: 1500000, account_number: '1234567' },
    });
    expect(useToastStore.getState().toasts.some((t) => t.message === 'Values saved to the case.')).toBe(true);
    expect(queueSpy).toHaveBeenCalled();
  });

  it('rejects extraction with explanatory note and displays rejection toast', async () => {
    const mockCase = {
      id: 'case-test-42',
      version: 3,
    } as Case;
    useReviewQueueStore.setState({
      activeExtraction: {
        id: 'ext-to-reject',
        case_id: 'case-test-42',
      } as Extraction,
    });
    vi.spyOn(api, 'getCaseById').mockResolvedValueOnce({
      success: true,
      data: mockCase,
      message: 'OK',
    });
    const reviewSpy = vi.spyOn(api, 'reviewExtraction').mockResolvedValueOnce({
      success: true,
      data: {} as Extraction,
      message: 'OK',
    });
    vi.spyOn(api, 'getReviewQueue').mockResolvedValueOnce({
      success: true,
      data: { items: [], total: 0, page: 1, page_size: 10 },
      message: 'OK',
    });

    const success = await useReviewQueueStore.getState().reviewExtraction(
      'ext-to-reject',
      'reject',
      undefined,
      'Image blurry and unreadable'
    );

    expect(success).toBe(true);
    expect(reviewSpy).toHaveBeenCalledWith('ext-to-reject', {
      decision: 'reject',
      expected_version: 3,
      note: 'Image blurry and unreadable',
    });
    expect(useToastStore.getState().toasts.some((t) => t.message === 'Extraction rejected.')).toBe(true);
  });

  it('resolves case id from queue when activeExtraction is null', async () => {
    const mockQueueItem: ReviewQueueItem = {
      extraction_id: 'ext-in-queue',
      case_id: 'case-from-queue',
      case_reference: 'RFR-2026-00099',
      document_filename: 'voucher.jpg',
      overall_confidence: 0.72,
      review_lane: 'low_confidence',
      fields: {},
      created_at: '2026-11-15T12:00:00Z',
    };
    useReviewQueueStore.setState({
      queue: [mockQueueItem],
      activeExtraction: null,
    });
    const caseSpy = vi.spyOn(api, 'getCaseById').mockResolvedValueOnce({
      success: true,
      data: { id: 'case-from-queue', version: 1 } as Case,
      message: 'OK',
    });
    vi.spyOn(api, 'reviewExtraction').mockResolvedValueOnce({
      success: true,
      data: {} as Extraction,
      message: 'OK',
    });
    vi.spyOn(api, 'getReviewQueue').mockResolvedValueOnce({
      success: true,
      data: { items: [], total: 0, page: 1, page_size: 10 },
      message: 'OK',
    });

    const success = await useReviewQueueStore.getState().reviewExtraction('ext-in-queue', 'accept');

    expect(success).toBe(true);
    expect(caseSpy).toHaveBeenCalledWith('case-from-queue');
  });

  it('handles STALE_CASE error when reviewing an extraction', async () => {
    useReviewQueueStore.setState({
      activeExtraction: {
        id: 'ext-stale',
        case_id: 'case-stale',
      } as Extraction,
    });
    vi.spyOn(api, 'getCaseById').mockResolvedValueOnce({
      success: true,
      data: { id: 'case-stale', version: 1 } as Case,
      message: 'OK',
    });
    vi.spyOn(api, 'reviewExtraction').mockRejectedValueOnce(
      apiError('STALE_CASE', 'Case was modified concurrently')
    );
    const queueSpy = vi.spyOn(api, 'getReviewQueue').mockResolvedValueOnce({
      success: true,
      data: { items: [], total: 0, page: 1, page_size: 10 },
      message: 'OK',
    });

    const success = await useReviewQueueStore.getState().reviewExtraction('ext-stale', 'accept');

    expect(success).toBe(false);
    expect(useToastStore.getState().toasts.some((t) => t.message.includes('The case changed while you were reviewing'))).toBe(true);
    expect(queueSpy).toHaveBeenCalled();
  });

  it('rethrows unexpected error on review submission', async () => {
    useReviewQueueStore.setState({
      activeExtraction: {
        id: 'ext-fatal',
        case_id: 'case-fatal',
      } as Extraction,
    });
    vi.spyOn(api, 'getCaseById').mockResolvedValueOnce({
      success: true,
      data: { id: 'case-fatal', version: 1 } as Case,
      message: 'OK',
    });
    vi.spyOn(api, 'reviewExtraction').mockRejectedValueOnce(new Error('Fatal database disk failure'));

    await expect(
      useReviewQueueStore.getState().reviewExtraction('ext-fatal', 'accept')
    ).rejects.toThrow('Fatal database disk failure');

    const state = useReviewQueueStore.getState();
    expect(state.isActionLoading).toBe(false);
    expect(state.error).toBe('Failed to submit the review.');
  });
});
