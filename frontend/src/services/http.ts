/**
 * HTTP layer shared by every API module.
 *
 * Mode is resolved once per page load (see ./dataMode.ts):
 *   demo -> in-memory demo data, no network
 *   live -> real HTTP to the API URL (Prism contract mock on :4010 or FastAPI)
 * The build env (VITE_USE_MOCK, VITE_API_URL) sets the default; the footer
 * switch overrides it and reloads.
 */
import type { ApiErrorDetail, ApiResponse, User } from '@/types/api';
import { type DataMode, persistDataMode, resolveApiUrl, resolveDataMode } from './dataMode';

export const USE_MOCK: boolean = resolveDataMode() === 'demo';

export const API_BASE_URL: string = USE_MOCK ? '' : resolveApiUrl();

export const DEFAULT_TIMEOUT_MS = 15_000;
/** The server waits up to 20 s for the assistant, so chat calls get more headroom. */
export const CHAT_TIMEOUT_MS = 30_000;
/** Uploads are capped at 10 MB and served from the database, so file downloads get the most headroom. */
export const FILE_TIMEOUT_MS = 60_000;

const MOCK_LATENCY_MS = 120;
const TOKEN_KEY = 'reliefops_auth_token';
const USER_KEY = 'reliefops_auth_user';

let memoryToken: string | null = null;
let memoryUser: User | null = null;

/* ---------------------------------------------------------------------------
 * Session storage. Wrapped in try/catch: storage can throw in private windows.
 * ------------------------------------------------------------------------- */

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch (err) {
    void err;
    return memoryToken;
  }
}

export function getStoredUser(): User | null {
  try {
    const json = localStorage.getItem(USER_KEY);
    return json ? (JSON.parse(json) as User) : memoryUser;
  } catch (err) {
    void err;
    return memoryUser;
  }
}

export function storeSession(token: string, user: User): void {
  memoryToken = token;
  memoryUser = user;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (err) {
    // Storage unavailable (quota exceeded or private window): in-memory fallback is retained
    void err;
  }
}

export function clearSession(): void {
  memoryToken = null;
  memoryUser = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (err) {
    // Storage unavailable: in-memory state is already cleared
    void err;
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

/**
 * Switches between demo and live data. Sessions do not carry across modes,
 * so this signs the user out and reloads at the sign-in page.
 */
export function switchDataMode(mode: DataMode, apiUrl?: string): void {
  persistDataMode(mode, apiUrl);
  clearSession();
  window.location.assign('/login');
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
  } catch (err) {
    void err;
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
  } catch (err) {
    void err;
    throw apiError('NETWORK_ERROR', 'Could not reach the server. Check your connection.');
  } finally {
    clearTimeout(timer);
  }

  let rawText = '';
  try {
    rawText = await response.text();
  } catch (err) {
    void err;
    rawText = '';
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

export function send<T>(endpoint: string, method: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function buildQuery(params: object): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') q.set(key, String(value));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Mock calls throw synchronously; turn that into a rejection like a network call. */
export async function mocked<T>(fn: () => T, message = 'ok'): Promise<ApiResponse<T>> {
  return mockEnvelope(fn(), message);
}
