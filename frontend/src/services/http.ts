/**
 * HTTP layer shared by every API module.
 *
 * Mode is chosen by env (see frontend/.env.example):
 *   VITE_USE_MOCK=true  (default) -> in-memory demo data, no network
 *   VITE_USE_MOCK=false           -> real HTTP to VITE_API_URL
 *                                    (Prism contract mock on :4010 or FastAPI on :8000)
 */
import type { ApiErrorDetail, ApiResponse, User } from '@/types/api';

export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK !== 'false';

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || (USE_MOCK ? '' : 'http://localhost:8000');

export const DEFAULT_TIMEOUT_MS = 15_000;
/** The server waits up to 20 s for the assistant, so chat calls get more headroom. */
export const CHAT_TIMEOUT_MS = 30_000;

const MOCK_LATENCY_MS = 120;
const TOKEN_KEY = 'reliefops_auth_token';
const USER_KEY = 'reliefops_auth_user';

/* ---------------------------------------------------------------------------
 * Session storage. Wrapped in try/catch: storage can throw in private windows.
 * ------------------------------------------------------------------------- */

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): User | null {
  try {
    const json = localStorage.getItem(USER_KEY);
    return json ? (JSON.parse(json) as User) : null;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: User): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* storage unavailable: session lives in memory only */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* nothing to clear */
  }
}

/* ---------------------------------------------------------------------------
 * 401 handling: the auth store subscribes so any expired session logs out.
 * ------------------------------------------------------------------------- */

type UnauthorizedListener = () => void;
let unauthorizedListener: UnauthorizedListener | null = null;

export function onUnauthorized(listener: UnauthorizedListener): void {
  unauthorizedListener = listener;
}

export function triggerUnauthorized(): void {
  clearSession();
  unauthorizedListener?.();
}

/* ---------------------------------------------------------------------------
 * Errors
 * ------------------------------------------------------------------------- */

export function apiError(
  code: string,
  message: string,
  details?: ApiErrorDetail['details']
): ApiErrorDetail {
  return details ? { code, message, details } : { code, message };
}

export function isApiError(value: unknown): value is ApiErrorDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as ApiErrorDetail).message === 'string'
  );
}

export function errorMessage(value: unknown, fallback = 'Something went wrong.'): string {
  return isApiError(value) ? value.message : fallback;
}

/** Field-level messages from a 422 VALIDATION_ERROR, keyed by field path. */
export function fieldErrors(value: unknown): Record<string, string> {
  if (!isApiError(value) || !value.details?.fields) return {};
  return Object.fromEntries(value.details.fields.map((f) => [f.field, f.message]));
}

/* ---------------------------------------------------------------------------
 * Live request
 * ------------------------------------------------------------------------- */

function buildHeaders(options: RequestInit): Headers {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function retryAfterSeconds(response: Response): number | undefined {
  const raw = response.headers.get('Retry-After');
  const seconds = raw ? Number(raw) : NaN;
  return Number.isFinite(seconds) ? seconds : undefined;
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: buildHeaders(options),
      signal: controller.signal,
    });
  } catch {
    throw apiError('NETWORK_ERROR', 'Could not reach the server. Check your connection.');
  } finally {
    clearTimeout(timer);
  }

  let rawText = '';
  try {
    rawText = await response.text();
  } catch {
    /* ignore read failure; rawText remains empty */
  }

  const parsed = parseJson(rawText) as
    | {
        success?: boolean;
        error?: ApiErrorDetail;
        detail?: unknown;
        message?: string;
      }
    | null;

  if (response.ok && parsed?.success) {
    return parsed as ApiResponse<T>;
  }

  let errorMessageText = response.statusText || 'Unexpected error';
  let details: ApiErrorDetail['details'] | undefined;

  if (parsed?.detail) {
    if (typeof parsed.detail === 'string') {
      errorMessageText = parsed.detail;
    } else if (Array.isArray(parsed.detail)) {
      const msgs: string[] = [];
      const fields: Array<{ field: string; message: string }> = [];
      for (const item of parsed.detail) {
        if (typeof item === 'string') {
          msgs.push(item);
        } else if (item && typeof item === 'object') {
          const obj = item as { loc?: unknown[]; msg?: string };
          if (obj.msg) {
            msgs.push(obj.msg);
            const fieldPath = Array.isArray(obj.loc)
              ? obj.loc.filter((p) => p !== 'body').join('.')
              : 'body';
            fields.push({ field: fieldPath || 'body', message: obj.msg });
          }
        }
      }
      if (msgs.length > 0) errorMessageText = msgs.join('; ');
      if (fields.length > 0) details = { fields };
    }
  } else if (typeof parsed?.message === 'string' && parsed.message) {
    errorMessageText = parsed.message;
  }

  const error: ApiErrorDetail = parsed?.error ?? {
    code: `HTTP_ERROR_${response.status}`,
    message: errorMessageText,
    ...(details ? { details } : {}),
  };

  if (response.status === 401 && error.code !== 'INVALID_CREDENTIALS') {
    triggerUnauthorized();
  }
  if (response.status === 429) {
    throw { ...error, retry_after: retryAfterSeconds(response) };
  }
  throw error;
}

/* ---------------------------------------------------------------------------
 * Mock helpers
 * ------------------------------------------------------------------------- */

export function mockEnvelope<T>(data: T, message = 'ok'): Promise<ApiResponse<T>> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ success: true, data, message }), MOCK_LATENCY_MS);
  });
}

export function mockFailure(error: ApiErrorDetail): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(error), MOCK_LATENCY_MS);
  });
}
