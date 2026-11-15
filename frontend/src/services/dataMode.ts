/**
 * Runtime data mode: "demo" (in-memory mock data) or "live" (real API).
 *
 * The build env sets the default (VITE_USE_MOCK, VITE_API_URL). A choice made
 * in the UI is stored in localStorage and wins over the env on the next load.
 * Switching reloads the page, so every module reads one consistent mode.
 */
export type DataMode = 'demo' | 'live';

const MODE_KEY = 'reliefops_data_mode';
const API_URL_KEY = 'reliefops_api_url';
const LOCAL_API_URL = 'http://localhost:8000';
const HEALTH_TIMEOUT_MS = 8_000;

const ENV_USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const ENV_API_URL = (import.meta.env.VITE_API_URL ?? '').trim();

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts until the reload only */
  }
}

/** Mode for this page load: the stored choice, else the build default. */
export function resolveDataMode(): DataMode {
  const stored = readStorage(MODE_KEY);
  if (stored === 'demo' || stored === 'live') return stored;
  return ENV_USE_MOCK ? 'demo' : 'live';
}

/** API base URL for live mode: the stored choice, else the build value, else a local backend. */
export function resolveApiUrl(): string {
  return readStorage(API_URL_KEY) || ENV_API_URL || LOCAL_API_URL;
}

/**
 * Accepts "https://host", "https://host/" or "https://host/api" and returns the
 * base without a trailing slash or /api suffix. Returns null for anything that
 * is not an http(s) URL.
 */
export function normalizeApiUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  const path = parsed.pathname.replace(/\/+$/, '').replace(/\/api$/, '');
  return `${parsed.origin}${path}`;
}

export type HealthCheck = { ok: true; ai: string } | { ok: false; reason: string };

/** Calls GET {base}/api/health (no auth) to confirm the API is reachable from this page. */
export async function checkApiHealth(baseUrl: string): Promise<HealthCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
    if (!res.ok) return { ok: false, reason: `The server answered ${res.status}.` };
    const json = (await res.json()) as { success?: boolean; data?: { ai?: string } };
    if (!json.success) return { ok: false, reason: 'The server did not return a ReliefOps health response.' };
    return { ok: true, ai: json.data?.ai ?? 'unknown' };
  } catch {
    return {
      ok: false,
      reason: 'We could not reach that URL. Check the address, and that the server allows this site (CORS).',
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Stores the choice. The caller clears the session and reloads. */
export function persistDataMode(mode: DataMode, apiUrl?: string): void {
  writeStorage(MODE_KEY, mode);
  if (apiUrl) writeStorage(API_URL_KEY, apiUrl);
}
