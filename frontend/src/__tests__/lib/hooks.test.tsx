import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { useInterval, useTimeout } from '@/lib/hooks/useTimers';
import { useWindowEvent } from '@/lib/hooks/useEventListener';

describe('useAsyncResource', () => {
  it('loads data when given a valid key and updates state on resolve', async () => {
    const fetcher = vi.fn().mockResolvedValue('loaded payload');

    const { result } = renderHook(() => useAsyncResource('key-1', fetcher));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe('loaded payload');
    expect(result.current.error).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('skips loading when key is null', async () => {
    const fetcher = vi.fn().mockResolvedValue('should not run');

    const { result } = renderHook(() => useAsyncResource(null, fetcher));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeUndefined();

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('drops stale responses when key changes before promise resolves', async () => {
    let resolveFirst: (value: string) => void = () => {};
    const firstPromise = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });

    const secondPromise = Promise.resolve('second result');

    const fetcher = vi.fn().mockImplementation((signal: AbortSignal) => {
      if (signal.aborted) {
        return Promise.reject(new Error('aborted'));
      }
      if (fetcher.mock.calls.length === 1) {
        return firstPromise;
      }
      return secondPromise;
    });

    const { result, rerender } = renderHook(
      ({ key }) => useAsyncResource(key, fetcher),
      { initialProps: { key: 'first-key' } }
    );

    expect(result.current.loading).toBe(true);

    rerender({ key: 'second-key' });

    await act(async () => {
      await secondPromise;
    });

    expect(result.current.data).toBe('second result');

    await act(async () => {
      resolveFirst('stale first result');
      await Promise.resolve();
    });

    expect(result.current.data).toBe('second result');
  });

  it('re-fetches when reload is invoked', async () => {
    let count = 0;
    const fetcher = vi.fn().mockImplementation(() => {
      count += 1;
      return Promise.resolve(`count-${count}`);
    });

    const { result } = renderHook(() => useAsyncResource('counter-key', fetcher));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.data).toBe('count-1');

    act(() => {
      result.current.reload();
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.data).toBe('count-2');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('captures error when loader promise rejects', async () => {
    const failureError = new Error('network failure');
    const fetcher = vi.fn().mockRejectedValue(failureError);

    const { result } = renderHook(() => useAsyncResource('error-key', fetcher));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(failureError);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useInterval and useTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes interval callback repeatedly at specified delay', () => {
    const callback = vi.fn();

    renderHook(() => useInterval(callback, 500));

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('pauses interval when delay is null and resumes when restored', () => {
    const callback = vi.fn();

    const { rerender } = renderHook(
      ({ delay }: { delay: number | null }) => useInterval(callback, delay),
      { initialProps: { delay: null as number | null } }
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(callback).not.toHaveBeenCalled();

    rerender({ delay: 200 });

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('cleans up interval timer upon unmount', () => {
    const callback = vi.fn();

    const { unmount } = renderHook(() => useInterval(callback, 250));

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('executes timeout callback once after delay', () => {
    const callback = vi.fn();

    renderHook(() => useTimeout(callback, 1000));

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('restarts timeout when resetKey changes', () => {
    const callback = vi.fn();

    const { rerender } = renderHook(
      ({ key }: { key: number }) => useTimeout(callback, 1000, key),
      { initialProps: { key: 1 } }
    );

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(callback).not.toHaveBeenCalled();

    rerender({ key: 2 });

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('useWindowEvent', () => {
  it('subscribes to window events and triggers callback', () => {
    const handler = vi.fn();

    renderHook(() => useWindowEvent('resize', handler));

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('removes window event listener on unmount', () => {
    const handler = vi.fn();

    const { unmount } = renderHook(() => useWindowEvent('click', handler));

    act(() => {
      window.dispatchEvent(new Event('click'));
    });
    expect(handler).toHaveBeenCalledTimes(1);

    unmount();

    act(() => {
      window.dispatchEvent(new Event('click'));
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not attach listener when enabled is false', () => {
    const handler = vi.fn();

    renderHook(() => useWindowEvent('keydown', handler, false));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
