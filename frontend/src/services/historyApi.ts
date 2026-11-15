/**
 * Case history API client (contract v0.4.2, docs/API_SPEC.md §6.4).
 * Provides paginated audit trail for a case and CSV export.
 */
import type { ApiErrorDetail, ApiResponse, AuditEntry, PaginatedResult } from '@/types/api';
import {
  API_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  USE_MOCK,
  apiError,
  getAuthToken,
  isApiError,
  mockEnvelope,
  mockFailure,
  request,
  triggerUnauthorized,
} from './http';
import { actorOf, addAudit, currentUser, db, findVisibleCase } from './mockStore';

export interface CaseHistoryQuery {
  page?: number;
  page_size?: number;
}

export interface CsvDownloadResult {
  blob: Blob;
  filename: string;
}

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseFilenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }
  const match = /filename=(?:"([^"]+)"|([^;]+))/i.exec(disposition);
  if (match) {
    return (match[1] || match[2] || '').trim();
  }
  return null;
}

function buildCaseCsv(entries: AuditEntry[]): string {
  const header = 'at,actor_name,actor_role,action,summary';
  const rows = entries.map((entry) =>
    [
      escapeCsvField(entry.at),
      escapeCsvField(entry.actor?.name ?? ''),
      escapeCsvField(entry.actor?.role ?? ''),
      escapeCsvField(entry.action),
      escapeCsvField(entry.summary),
    ].join(',')
  );
  return [header, ...rows].join('\r\n') + '\r\n';
}

function getMockCaseEntries(caseId: string): AuditEntry[] {
  const caseItem = findVisibleCase(caseId);
  const matching = db.auditLogs.filter(
    (entry) =>
      entry.case_id === caseItem.id ||
      entry.case_id === caseId ||
      (caseItem.reference && entry.case_reference === caseItem.reference)
  );
  return [...matching].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

async function fetchLiveCsv(caseId: string): Promise<CsvDownloadResult> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/cases/${encodeURIComponent(caseId)}/history?format=csv`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
  } catch {
    throw apiError('NETWORK_ERROR', 'Could not reach the server. Check your connection.');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    if (response.status === 401) {
      triggerUnauthorized();
    }
    let errorDetail: ApiErrorDetail;
    try {
      const text = await response.text();
      const parsed = text ? (JSON.parse(text) as { error?: ApiErrorDetail }) : null;
      errorDetail = parsed?.error ?? apiError(`HTTP_ERROR_${response.status}`, response.statusText || 'Export failed');
    } catch {
      errorDetail = apiError(`HTTP_ERROR_${response.status}`, response.statusText || 'Export failed');
    }
    throw errorDetail;
  }

  const blob = await response.blob();
  const fallback = `case-${caseId}-history.csv`;
  const filename = parseFilenameFromDisposition(response.headers.get('Content-Disposition')) || fallback;
  return { blob, filename };
}

export const historyApi = {
  /**
   * Retrieves paginated audit history for a case, newest first (contract §6.4).
   */
  getCaseHistory(
    caseId: string,
    params: CaseHistoryQuery = {}
  ): Promise<ApiResponse<PaginatedResult<AuditEntry>>> {
    if (!USE_MOCK) {
      const q = new URLSearchParams();
      if (params.page !== undefined && params.page !== null) q.set('page', String(params.page));
      if (params.page_size !== undefined && params.page_size !== null) q.set('page_size', String(params.page_size));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return request<PaginatedResult<AuditEntry>>(`/api/cases/${encodeURIComponent(caseId)}/history${qs}`);
    }

    try {
      const page = Math.max(1, params.page ?? 1);
      const pageSize = Math.max(1, params.page_size ?? 10);
      const sorted = getMockCaseEntries(caseId);
      const total = sorted.length;
      const start = (page - 1) * pageSize;
      const items = sorted.slice(start, start + pageSize);

      return mockEnvelope<PaginatedResult<AuditEntry>>({
        items,
        page,
        page_size: pageSize,
        total,
      });
    } catch (err) {
      if (isApiError(err)) return mockFailure(err);
      throw err;
    }
  },

  /**
   * Downloads case audit history as a CSV file (contract §6.4 Nice tier).
   * In mock mode, builds the CSV client-side and logs an export.generated audit event.
   */
  async downloadCaseHistoryCsv(caseId: string): Promise<CsvDownloadResult> {
    if (!USE_MOCK) {
      return fetchLiveCsv(caseId);
    }

    try {
      const caseItem = findVisibleCase(caseId);
      const sorted = getMockCaseEntries(caseId);
      const user = currentUser();

      addAudit({
        actor: actorOf(user),
        action: 'export.generated',
        case_id: caseItem.id,
        case_reference: caseItem.reference,
        bank_id: caseItem.bank_id,
        summary: `Exported case audit history to CSV (${caseItem.reference})`,
        changes: null,
        metadata: { format: 'csv', count: sorted.length },
      });

      const csvText = buildCaseCsv(sorted);
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const filename = `case-${caseItem.reference || caseId}-history.csv`;

      return await new Promise<CsvDownloadResult>((resolve) => {
        setTimeout(() => resolve({ blob, filename }), 120);
      });
    } catch (err) {
      if (isApiError(err)) return mockFailure(err);
      throw err;
    }
  },
};
