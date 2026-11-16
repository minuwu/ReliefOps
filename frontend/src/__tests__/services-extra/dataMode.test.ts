import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkApiHealth,
  normalizeApiUrl,
  persistDataMode,
  resolveApiUrl,
  resolveDataMode,
} from '@/services/dataMode';

describe('dataMode module', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('resolves data mode from localStorage when set to live', () => {
    localStorage.setItem('reliefops_data_mode', 'live');

    const mode = resolveDataMode();

    expect(mode).toBe('live');
  });

  it('resolves data mode from localStorage when set to demo', () => {
    localStorage.setItem('reliefops_data_mode', 'demo');

    const mode = resolveDataMode();

    expect(mode).toBe('demo');
  });

  it('falls back to default demo mode when localStorage has no entry', () => {
    const mode = resolveDataMode();

    expect(mode).toBe('demo');
  });

  it('handles localStorage throwing an exception gracefully when resolving mode', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('Storage disabled');
    });

    const mode = resolveDataMode();

    expect(mode).toBe('demo');
  });

  it('resolves custom API URL from storage', () => {
    localStorage.setItem('reliefops_api_url', 'https://api.reliefops.test');

    const url = resolveApiUrl();

    expect(url).toBe('https://api.reliefops.test');
  });

  it('falls back to default local API URL when storage is empty', () => {
    const url = resolveApiUrl();

    expect(url).toBe('http://localhost:8000');
  });

  it('normalizes valid URLs removing trailing slashes and /api suffix', () => {
    expect(normalizeApiUrl('https://example.com/api')).toBe('https://example.com');
    expect(normalizeApiUrl('https://example.com/api/')).toBe('https://example.com');
    expect(normalizeApiUrl('https://example.com///')).toBe('https://example.com');
    expect(normalizeApiUrl('http://localhost:8000/')).toBe('http://localhost:8000');
  });

  it('returns null for invalid or non-http protocols in normalizeApiUrl', () => {
    expect(normalizeApiUrl('not-a-valid-url')).toBeNull();
    expect(normalizeApiUrl('ftp://example.com')).toBeNull();
    expect(normalizeApiUrl('file:///path/to/file')).toBeNull();
  });

  it('persists data mode and optional apiUrl to localStorage', () => {
    persistDataMode('live', 'https://live.reliefops.test');

    expect(localStorage.getItem('reliefops_data_mode')).toBe('live');
    expect(localStorage.getItem('reliefops_api_url')).toBe('https://live.reliefops.test');
  });

  it('persists data mode without changing apiUrl when not provided', () => {
    persistDataMode('demo');

    expect(localStorage.getItem('reliefops_data_mode')).toBe('demo');
    expect(localStorage.getItem('reliefops_api_url')).toBeNull();
  });

  it('handles localStorage throwing when persisting data mode', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('Quota exceeded');
    });

    expect(() => persistDataMode('live')).not.toThrow();
  });

  it('returns success health check when backend responds with valid status', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { ai: 'gemini-1.5' } }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as unknown as Response);

    const result = await checkApiHealth('https://api.reliefops.test');

    expect(result).toEqual({ ok: true, ai: 'gemini-1.5' });
  });

  it('returns default unknown ai string if health response lacks ai field', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: {} }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as unknown as Response);

    const result = await checkApiHealth('https://api.reliefops.test');

    expect(result).toEqual({ ok: true, ai: 'unknown' });
  });

  it('returns failure reason when server returns non-ok HTTP status', async () => {
    const mockResponse = {
      ok: false,
      status: 503,
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as unknown as Response);

    const result = await checkApiHealth('https://api.reliefops.test');

    expect(result).toEqual({ ok: false, reason: 'The server answered 503.' });
  });

  it('returns failure reason when server response payload has success false', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ success: false }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as unknown as Response);

    const result = await checkApiHealth('https://api.reliefops.test');

    expect(result).toEqual({
      ok: false,
      reason: 'The server did not return a ReliefOps health response.',
    });
  });

  it('returns connection error reason when network fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const result = await checkApiHealth('https://unreachable.test');

    expect(result).toEqual({
      ok: false,
      reason: 'We could not reach that URL. Check the address, and that the server allows this site (CORS).',
    });
  });
});
