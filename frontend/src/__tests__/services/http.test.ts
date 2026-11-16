import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { User } from '@/types/api';
import {
  apiError,
  buildQuery,
  clearSession,
  errorMessage,
  fieldErrors,
  getAuthToken,
  getStoredUser,
  isApiError,
  mockEnvelope,
  mockFailure,
  mocked,
  onUnauthorized,
  request,
  send,
  storeSession,
  triggerUnauthorized,
} from '@/services/http';

const testUser: User = {
  id: 'usr-1',
  email: 'operator@test.jp',
  name: 'Operator One',
  role: 'operator',
  bank_id: null,
  is_active: true,
  email_verified: true,
};

describe('session storage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSession();
  });

  afterEach(() => {
    localStorage.clear();
    clearSession();
  });

  it('stores token and user in localStorage and retrieves them', () => {
    storeSession('jwt-sample-token', testUser);

    expect(getAuthToken()).toBe('jwt-sample-token');
    expect(getStoredUser()).toEqual(testUser);
  });

  it('clears session from localStorage and memory', () => {
    storeSession('token-to-clear', testUser);
    clearSession();

    expect(getAuthToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it('returns null when no session is present', () => {
    expect(getAuthToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });
});

describe('error mapping and helper functions', () => {
  it('identifies valid ApiErrorDetail shapes', () => {
    const valid = apiError('INVALID_STATE', 'Case cannot advance');
    expect(isApiError(valid)).toBe(true);

    expect(isApiError(null)).toBe(false);
    expect(isApiError('error text')).toBe(false);
    expect(isApiError({ code: 123 })).toBe(false);
  });

  it('extracts error messages from ApiErrorDetail and provides default fallback', () => {
    const errorObj = apiError('NOT_FOUND', 'Case not found');
    expect(errorMessage(errorObj)).toBe('Case not found');
    expect(errorMessage(new Error('native error'), 'Fallback text')).toBe('Fallback text');
  });

  it('extracts field errors from validation error details', () => {
    const errorWithFields = apiError('VALIDATION_ERROR', 'Validation failed', {
      fields: [
        { field: 'amount', message: 'Amount must be positive' },
        { field: 'account_number', message: 'Account number is required' },
      ],
    });

    const fields = fieldErrors(errorWithFields);
    expect(fields.amount).toBe('Amount must be positive');
    expect(fields.account_number).toBe('Account number is required');

    expect(fieldErrors(null)).toEqual({});
    expect(fieldErrors(apiError('ERROR', 'No details'))).toEqual({});
  });

  it('constructs query strings filtering out empty or null parameters', () => {
    const query = buildQuery({
      status: 'verified',
      page: 1,
      empty: '',
      omitted: null,
      skipped: undefined,
    });

    expect(query).toBe('?status=verified&page=1');
    expect(buildQuery({})).toBe('');
  });
});

describe('mock helpers', () => {
  it('resolves mocked envelope asynchronously', async () => {
    const envelope = await mockEnvelope({ id: 42 }, 'created');

    expect(envelope.success).toBe(true);
    expect(envelope.data).toEqual({ id: 42 });
    expect(envelope.message).toBe('created');
  });

  it('rejects mockFailure asynchronously', async () => {
    const errorToThrow = apiError('FAIL', 'Mock failed');

    await expect(mockFailure(errorToThrow)).rejects.toEqual(errorToThrow);
  });

  it('turns synchronous functions into async ApiResponse envelopes', async () => {
    const envelope = await mocked(() => [1, 2, 3]);

    expect(envelope.success).toBe(true);
    expect(envelope.data).toEqual([1, 2, 3]);
  });
});

describe('HTTP request and envelope handling with mocked fetch', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    clearSession();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses standard 200 response with success true', async () => {
    const mockResponsePayload = {
      success: true,
      data: { reference: 'RFR-2026-0001' },
      message: 'Case loaded',
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockResponsePayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await request<{ reference: string }>('/api/cases/1');

    expect(result.success).toBe(true);
    expect(result.data.reference).toBe('RFR-2026-0001');
  });

  it('throws ApiErrorDetail on HTTP error with structured error body', async () => {
    const mockErrorPayload = {
      success: false,
      error: { code: 'STALE_CASE', message: 'Case version is outdated' },
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockErrorPayload), {
        status: 409,
        statusText: 'Conflict',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(request('/api/cases/1/transition')).rejects.toMatchObject({
      code: 'STALE_CASE',
      message: 'Case version is outdated',
    });
  });

  it('maps FastAPI validation detail arrays into formatted error messages and field details', async () => {
    const fastApiErrorPayload = {
      detail: [
        { loc: ['body', 'amount'], msg: 'Field required', type: 'value_error.missing' },
        { loc: ['body', 'victim_name'], msg: 'Must not be empty', type: 'value_error' },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(fastApiErrorPayload), {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    try {
      await request('/api/cases');
      expect.unreachable('Expected request to throw');
    } catch (err: unknown) {
      expect(isApiError(err)).toBe(true);
      if (isApiError(err)) {
        expect(err.code).toBe('HTTP_ERROR_422');
        expect(err.message).toContain('Field required');
        expect(err.message).toContain('Must not be empty');
        expect(err.details?.fields).toEqual([
          { field: 'amount', message: 'Field required' },
          { field: 'victim_name', message: 'Must not be empty' },
        ]);
      }
    }
  });

  it('triggers unauthorized callback on HTTP 401 when code is not INVALID_CREDENTIALS', async () => {
    const unauthorizedCallback = vi.fn();
    onUnauthorized(unauthorizedCallback);
    storeSession('expired-token', testUser);

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Signature has expired' },
        }),
        { status: 401, statusText: 'Unauthorized' }
      )
    );

    await expect(request('/api/cases')).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
    });

    expect(unauthorizedCallback).toHaveBeenCalledTimes(1);
    expect(getAuthToken()).toBeNull();
  });

  it('does not trigger unauthorized callback on 401 when code is INVALID_CREDENTIALS', async () => {
    const unauthorizedCallback = vi.fn();
    onUnauthorized(unauthorizedCallback);

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Wrong email or password' },
        }),
        { status: 401, statusText: 'Unauthorized' }
      )
    );

    await expect(request('/api/auth/login')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });

    expect(unauthorizedCallback).not.toHaveBeenCalled();
  });

  it('handles triggerUnauthorized directly', () => {
    const unauthorizedCallback = vi.fn();
    onUnauthorized(unauthorizedCallback);
    storeSession('some-token', testUser);

    triggerUnauthorized();

    expect(unauthorizedCallback).toHaveBeenCalledTimes(1);
    expect(getAuthToken()).toBeNull();
  });

  it('attaches retry_after attribute on HTTP 429 responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many requests' },
        }),
        {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'Retry-After': '30' },
        }
      )
    );

    await expect(request('/api/rate-limited')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retry_after: 30,
    });
  });

  it('maps network exceptions to NETWORK_ERROR ApiErrorDetail', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    await expect(request('/api/down-server')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection.',
    });
  });

  it('serializes JSON bodies correctly when using send helper', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { ok: true }, message: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await send('/api/test', 'POST', { key: 'value' });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'value' }),
      })
    );
  });
});
