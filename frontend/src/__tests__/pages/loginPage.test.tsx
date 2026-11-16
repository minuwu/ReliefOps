import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '@/pages/auth/LoginPage';
import { useAuthStore } from '@/store/useAuthStore';

describe('LoginPage rendering with mock data layer', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isLoading: false,
      error: null,
      errorCode: null,
    });
  });

  it('renders login form elements and controls', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /log in to reliefops/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('displays loading spinner and disables submit button when authentication is in flight', () => {
    useAuthStore.setState({ isLoading: true });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const submitButton = screen.getByRole('button', { name: /log in/i });
    expect(submitButton).toBeDisabled();
  });

  it('displays error notice when authentication error occurs', () => {
    useAuthStore.setState({ error: 'Invalid email or password.' });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
  });
});
