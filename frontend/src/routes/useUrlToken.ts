import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Reads the one-time ?token= from an email link, then removes it from the address bar
 * so it does not stay in browser history or get shared by copy-paste.
 */
export function useUrlToken(): string | null {
  const [params, setParams] = useSearchParams();
  const [token] = useState(() => params.get('token'));

  useEffect(() => {
    if (!params.has('token')) return;
    const rest = new URLSearchParams(params);
    rest.delete('token');
    setParams(rest, { replace: true });
  }, [params, setParams]);

  return token;
}
