import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { historyApi } from '@/services/historyApi';
import { db } from '@/services/mockStore';
import { DEMO_CASES, DEMO_USERS } from '@/services/mockData';
import { clearSession } from '@/services/http';

describe('historyApi module', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSession();
    db.cases = JSON.parse(JSON.stringify(DEMO_CASES));
    db.staff = JSON.parse(JSON.stringify(DEMO_USERS));
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    clearSession();
    vi.restoreAllMocks();
  });

  it('retrieves paginated audit history for a case sorted newest first', async () => {
    const targetCase = db.cases[0];

    const res = await historyApi.getCaseHistory(targetCase.id, { page: 1, page_size: 5 });

    expect(res.success).toBe(true);
    expect(res.data.page).toBe(1);
    expect(res.data.page_size).toBe(5);
    expect(Array.isArray(res.data.items)).toBe(true);
  });

  it('fails to retrieve history for a non-existent case', async () => {
    await expect(historyApi.getCaseHistory('missing-case-id')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('downloads case history as CSV and logs export audit entry', async () => {
    const targetCase = db.cases[0];

    const result = await historyApi.downloadCaseHistoryCsv(targetCase.id);

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.filename).toContain(targetCase.reference);

    const exportAudit = db.auditLogs.find(
      (a) => a.action === 'export.generated' && a.case_id === targetCase.id
    );
    expect(exportAudit).toBeDefined();
  });

  it('fails to download CSV for a non-existent case', async () => {
    await expect(historyApi.downloadCaseHistoryCsv('missing-case-id')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('interacts with live API endpoints in live mode', async () => {
    localStorage.setItem('reliefops_data_mode', 'live');
    vi.resetModules();

    const liveHistory = await import('@/services/historyApi');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/cases/c-1/history?format=csv')) {
        return new Response('at,actor,action\n2026-11-15,Operator,test', {
          status: 200,
          headers: {
            'Content-Disposition': 'attachment; filename="case-c-1.csv"',
          },
        });
      }
      if (urlStr.includes('/api/cases/c-1/history')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { items: [], page: 1, page_size: 10, total: 0 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const paginatedRes = await liveHistory.historyApi.getCaseHistory('c-1', { page: 1, page_size: 10 });
    expect(paginatedRes.data.page).toBe(1);

    const csvRes = await liveHistory.historyApi.downloadCaseHistoryCsv('c-1');
    expect(csvRes.filename).toBe('case-c-1.csv');
    expect(csvRes.blob).toBeDefined();
  });

  it('handles live CSV download error responses', async () => {
    localStorage.setItem('reliefops_data_mode', 'live');
    vi.resetModules();

    const liveHistory = await import('@/services/historyApi');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'No access' } }), {
        status: 403,
        statusText: 'Forbidden',
      })
    );

    await expect(liveHistory.historyApi.downloadCaseHistoryCsv('c-err')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('handles live CSV download network failure', async () => {
    localStorage.setItem('reliefops_data_mode', 'live');
    vi.resetModules();

    const liveHistory = await import('@/services/historyApi');

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));

    await expect(liveHistory.historyApi.downloadCaseHistoryCsv('c-net')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });
});
