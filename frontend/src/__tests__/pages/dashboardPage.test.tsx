import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '@/pages/DashboardPage';
import { useAuthStore } from '@/store/useAuthStore';
import { useCaseStore } from '@/store/useCaseStore';
import { DEMO_USERS } from '@/services/mockData';
import { api } from '@/services/api';

describe('DashboardPage rendering with mock data layer', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: DEMO_USERS[2],
      token: 'mock-supervisor-token',
    });
    useCaseStore.setState({
      cases: [],
      selectedCase: null,
      filters: {},
      isLoading: false,
      isDetailLoading: false,
      error: null,
    });
  });

  it('displays loading indicator initially', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
  });

  it('renders dashboard content and statistics after successful load', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', { name: 'Dashboard', level: 1 })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText(/case volume, deadlines and items waiting for review/i)).toBeInTheDocument();
  });

  it('displays error alert banner when loading fails', async () => {
    vi.spyOn(api, 'getDashboardStats').mockRejectedValueOnce(
      new Error('Failed to retrieve statistics')
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(
      screen.getByRole('heading', { name: /could not load the dashboard/i, level: 1 })
    ).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
