import { useCallback, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface UseUrlTokenResult {
  token: string | null;
  /** Attach to any rendered element to clear ?token= from the address bar on mount. */
  clearUrlRef: (node: HTMLElement | null) => void;
  /** Call in an event handler (e.g. form submit) to clear ?token= from the address bar. */
  clearToken: () => void;
}

/**
 * Reads the one-time ?token= from an email link during render,
 * then clears it from the address bar via a ref callback or navigate helper
 * so it does not stay in browser history or get shared by copy-paste.
 */
export function useUrlToken(): UseUrlTokenResult {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(location.search).get('token'));
  const cleared = useRef(false);

  const clearToken = useCallback(() => {
    if (cleared.current) return;
    const params = new URLSearchParams(location.search);
    if (!params.has('token')) return;
    cleared.current = true;
    params.delete('token');
    const search = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: search ? `?${search}` : '',
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.pathname, location.search, location.hash, navigate]);

  const clearUrlRef = useCallback(
    (node: HTMLElement | null) => {
      if (node) {
        clearToken();
      }
    },
    [clearToken],
  );

  return { token, clearUrlRef, clearToken };
}
