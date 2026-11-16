import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminUsersPage } from '@/pages/AdminUsersPage';
import { useAuthStore } from '@/store/useAuthStore';
import { DEMO_USERS } from '@/services/mockData';
import { api } from '@/services/api';
import { apiError } from '@/services/http';

describe('AdminUsersPage rendering with mock data layer', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: DEMO_USERS[2],
      token: 'mock-supervisor-token',
    });
  });

  it('displays loading state for staff list initially', () => {
    render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/loading staff accounts/i)).toBeInTheDocument();
  });

  it('renders team management panels and user list upon successful fetch', async () => {
    render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', { name: 'Team', level: 1 })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText(/staff accounts and invitations/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /invite someone/i })).toBeInTheDocument();
  });

  it('displays error notice when fetching team members fails', async () => {
    vi.spyOn(api, 'getUsers').mockRejectedValueOnce(
      apiError('FETCH_ERROR', 'Could not load the team.')
    );

    render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(screen.getByText(/could not load the team/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
