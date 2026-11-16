import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '@/store/useAuthStore';
import { authApi } from '@/services/authApi';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useTimeout } from '@/lib/hooks/useTimers';

describe('useAuthStore extra coverage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isLoading: false,
      error: null,
      errorCode: null,
    });
    vi.restoreAllMocks();
  });

  it('sets errorCode to null when login fails with a generic Error', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValueOnce(new Error('Generic failure without api code'));

    await expect(
      useAuthStore.getState().login('user@example.test', 'secret123')
    ).rejects.toThrow('Generic failure without api code');

    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.errorCode).toBeNull();
    expect(state.error).toBe('Login failed.');
  });
});

describe('utils extra coverage', () => {
  it('returns raw string when formatDate encounters an invalid date string', () => {
    const raw = 'completely-invalid-date-value';
    const result = formatDate(raw);
    expect(result).toBe(raw);
  });

  it('returns raw string when formatDateTime encounters an invalid date string', () => {
    const raw = 'completely-invalid-date-value';
    const result = formatDateTime(raw);
    expect(result).toBe(raw);
  });
});

describe('useTimeout extra coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not schedule timer when delayMs is null', () => {
    const callback = vi.fn();

    renderHook(() => useTimeout(callback, null));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
