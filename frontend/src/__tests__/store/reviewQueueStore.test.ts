import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useReviewQueueStore } from '@/store/useReviewQueueStore';
import { useToastStore } from '@/store/useToastStore';
import { useAuthStore } from '@/store/useAuthStore';
import { DEMO_USERS } from '@/services/mockData';
import { api } from '@/services/api';
import { apiError } from '@/services/http';

describe('useReviewQueueStore with mock data layer', () => {
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
  });

  it('fetches review queue items', async () => {
    await useReviewQueueStore.getState().fetchQueue();

    const state = useReviewQueueStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.queue.length).toBeGreaterThan(0);
    expect(state.queue[0].extraction_id).toBeTruthy();
  });

  it('fetches extraction detail by id', async () => {
    await useReviewQueueStore.getState().fetchExtraction('ext-42-01');

    const state = useReviewQueueStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.activeExtraction?.id).toBe('ext-42-01');
  });

  it('sets extractionNotice when extraction is not found or already processed', async () => {
    await useReviewQueueStore.getState().fetchExtraction('ext-non-existent-999');

    const state = useReviewQueueStore.getState();
    expect(state.activeExtraction).toBeNull();
    expect(state.extractionNotice).toContain('no longer waiting for review');
  });

  it('clears active extraction and notices', async () => {
    await useReviewQueueStore.getState().fetchExtraction('ext-42-01');
    expect(useReviewQueueStore.getState().activeExtraction).not.toBeNull();

    useReviewQueueStore.getState().clearActive();

    expect(useReviewQueueStore.getState().activeExtraction).toBeNull();
    expect(useReviewQueueStore.getState().extractionNotice).toBeNull();
  });

  it('handles ALREADY_REVIEWED error gracefully during review submission', async () => {
    await useReviewQueueStore.getState().fetchExtraction('ext-42-01');

    vi.spyOn(api, 'reviewExtraction').mockRejectedValueOnce(
      apiError('ALREADY_REVIEWED', 'Extraction has already been certified')
    );

    const success = await useReviewQueueStore
      .getState()
      .reviewExtraction('ext-42-01', 'accept', { amount: 250000 });

    expect(success).toBe(false);
    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.message.includes('Someone else already reviewed this'))).toBe(true);

    vi.restoreAllMocks();
  });
});
