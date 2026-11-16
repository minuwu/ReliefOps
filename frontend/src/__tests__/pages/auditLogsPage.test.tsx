import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuditLogsPage } from '@/pages/AuditLogsPage';
import { useAuthStore } from '@/store/useAuthStore';
import { DEMO_USERS } from '@/services/mockData';
import { api } from '@/services/api';
import { apiError } from '@/services/http';

describe('AuditLogsPage rendering with mock data layer', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: DEMO_USERS[2],
      token: 'mock-supervisor-token',
    });
  });

  it('displays loading indicator initially', () => {
    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/loading audit log/i)).toBeInTheDocument();
  });

  it('renders audit events table after successful load', async () => {
    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', { name: 'Audit log', level: 1 })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText(/every action taken on a case, newest first/i)).toBeInTheDocument();
  });

  it('displays error banner when loading audit logs fails', async () => {
    vi.spyOn(api, 'getAuditLogs').mockRejectedValueOnce(
      apiError('FETCH_ERROR', 'Unable to retrieve audit history')
    );

    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText(/unable to retrieve audit history/i)).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
