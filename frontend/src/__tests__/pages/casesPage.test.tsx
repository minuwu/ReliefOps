import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CasesPage } from '@/pages/CasesPage';
import { useAuthStore } from '@/store/useAuthStore';
import { useCaseStore } from '@/store/useCaseStore';
import { DEMO_USERS } from '@/services/mockData';
import { apiError } from '@/services/http';
import { api } from '@/services/api';

describe('CasesPage rendering with mock data layer', () => {
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
  });

  it('displays loading state when cases are being fetched initially', () => {
    useCaseStore.setState({ isLoading: true, cases: [] });

    render(
      <MemoryRouter>
        <CasesPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/loading relief claims/i)).toBeInTheDocument();
  });

  it('renders cases table and controls after data loads', async () => {
    render(
      <MemoryRouter>
        <CasesPage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', { name: 'Cases', level: 1 })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText(/all relief claims across the partner banks/i)).toBeInTheDocument();
  });

  it('displays error alert banner when cases loading encounters an error', async () => {
    vi.spyOn(api, 'getCases').mockRejectedValueOnce(
      apiError('SERVER_ERROR', 'Network failure loading cases')
    );

    render(
      <MemoryRouter>
        <CasesPage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText(/network failure loading cases/i)).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
