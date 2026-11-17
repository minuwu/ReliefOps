import { useEffect, useMemo, useRef } from 'react';

interface PendingRevoke {
  url: string;
  timer: number;
}

/**
 * Object URL for a Blob, revoked when the Blob changes or the component unmounts.
 * The revoke is deferred one tick so a StrictMode remount of the same URL cancels it.
 */
export function useObjectUrl(blob: Blob | undefined): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  const pending = useRef<PendingRevoke | null>(null);

  useEffect(() => {
    if (pending.current?.url === url) {
      window.clearTimeout(pending.current.timer);
      pending.current = null;
    }
    return () => {
      if (!url) return;
      const timer = window.setTimeout(() => URL.revokeObjectURL(url), 0);
      pending.current = { url, timer };
    };
  }, [url]);

  return url;
}
