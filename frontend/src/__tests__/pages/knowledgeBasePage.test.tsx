import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { KnowledgeBasePage } from '@/pages/KnowledgeBasePage';
import { useAuthStore } from '@/store/useAuthStore';
import { DEMO_USERS } from '@/services/mockData';
import { kbApi } from '@/services/kbApi';
import { apiError } from '@/services/http';

describe('KnowledgeBasePage rendering with mock data layer', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: DEMO_USERS[0],
      token: 'mock-operator-token',
    });
  });

  it('displays loading state while bluebooks are loading', () => {
    render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/loading documents/i)).toBeInTheDocument();
  });

  it('renders knowledge base header and document list after loading', async () => {
    render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', { name: 'Knowledge base', level: 1 })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText(/bank guidance documents and operations bluebooks/i)).toBeInTheDocument();
  });

  it('displays error banner when loading knowledge base documents fails', async () => {
    vi.spyOn(kbApi, 'list').mockRejectedValueOnce(
      apiError('FETCH_ERROR', 'Could not load bluebook documents.')
    );

    render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText(/could not load bluebook documents/i)).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
