import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PortalHomePage } from '@/pages/portal/PortalHomePage';
import { useAuthStore } from '@/store/useAuthStore';
import { DEMO_VICTIMS } from '@/services/mockData';
import { victimApi } from '@/services/victimApi';
import { apiError } from '@/services/http';

describe('PortalHomePage rendering with mock data layer', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: DEMO_VICTIMS[0],
      token: 'mock-victim-token',
    });
  });

  it('displays loading state while victim cases are being loaded', () => {
    render(
      <MemoryRouter>
        <PortalHomePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/loading your cases/i)).toBeInTheDocument();
  });

  it('renders victim portal dashboard and claims after data resolves', async () => {
    render(
      <MemoryRouter>
        <PortalHomePage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', { name: /hello,|my cases/i, level: 1 })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText(/track your relief claims, update information/i)).toBeInTheDocument();
  });

  it('displays error notice when fetching victim cases fails', async () => {
    vi.spyOn(victimApi, 'getMyCases').mockRejectedValueOnce(
      apiError('FETCH_ERROR', 'Could not load your cases.')
    );

    render(
      <MemoryRouter>
        <PortalHomePage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(screen.getByText(/could not load your cases/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    vi.restoreAllMocks();
  });
});
