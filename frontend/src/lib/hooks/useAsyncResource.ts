import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncResource<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

/**
 * Loads data when `key` changes (or `reload()` is called). Stale responses are dropped.
 * Pass a stable string `key` that encodes every input of `load`; pass `null` to skip loading.
 */
export function useAsyncResource<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
): AsyncResource<T> {
  const loadRef = useRef(load);
  loadRef.current = load;
  const [state, setState] = useState<{ data: T | undefined; error: unknown; loading: boolean }>({
    data: undefined,
    error: undefined,
    loading: key !== null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: undefined }));
    loadRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: undefined, loading: false });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState((prev) => ({ ...prev, error, loading: false }));
      });
    return () => controller.abort();
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
