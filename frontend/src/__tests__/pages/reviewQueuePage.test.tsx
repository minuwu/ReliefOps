import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReviewQueuePage } from '@/pages/ReviewQueuePage';
import { useAuthStore } from '@/store/useAuthStore';
import { useReviewQueueStore } from '@/store/useReviewQueueStore';
import { DEMO_USERS } from '@/services/mockData';
import { api } from '@/services/api';
import { apiError } from '@/services/http';

describe('ReviewQueuePage rendering with mock data layer', () => {
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
  });

  it('displays loading state when queue items are being loaded initially', () => {
    useReviewQueueStore.setState({ isLoading: true, queue: [] });

    render(
      <MemoryRouter>
        <ReviewQueuePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/loading review queue/i)).toBeInTheDocument();
  });

  it('renders review queue table after successful fetch', async () => {
    render(
      <MemoryRouter>
        <ReviewQueuePage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', { name: 'Review queue', level: 1 })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(
      screen.getByText(/ai-extracted documents waiting for a person to confirm/i)
    ).toBeInTheDocument();
  });

  it('displays error alert when review queue loading encounters an error', async () => {
    vi.spyOn(api, 'getReviewQueue').mockRejectedValueOnce(
      apiError('FETCH_ERROR', 'Failed to retrieve queue items')
    );

    render(
      <MemoryRouter>
        <ReviewQueuePage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText(/failed to retrieve queue items/i)).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
