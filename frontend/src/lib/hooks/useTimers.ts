import { useEffect, useRef } from 'react';

/** Calls `callback` every `delayMs`. Pass `null` to pause. */
export function useInterval(callback: () => void, delayMs: number | null): void {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (delayMs === null) return;
    const id = setInterval(() => saved.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}

/** Calls `callback` once after `delayMs`. Pass `null` to cancel. Restarts when `resetKey` changes. */
export function useTimeout(callback: () => void, delayMs: number | null, resetKey?: unknown): void {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (delayMs === null) return;
    const id = setTimeout(() => saved.current(), delayMs);
    return () => clearTimeout(id);
  }, [delayMs, resetKey]);
}
