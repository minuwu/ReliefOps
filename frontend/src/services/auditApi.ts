/**
 * Audit Logs API client (contract v0.4.2, docs/API_SPEC.md §6.4).
 */
import type { ApiResponse, AuditEntry, PaginatedResult } from '@/types/api';
import { USE_MOCK, buildQuery, mocked, request } from './http';
import { db } from './mockStore';

export const auditApi = {
  /** A page of audit entries, newest first (contract §6.4). Bank scoping is done by the server. */
  getAuditLogs(
    params: {
      case_id?: string;
      actor_id?: string;
      action?: AuditEntry['action'];
      from?: string;
      to?: string;
      page?: number;
      page_size?: number;
    } = {}
  ): Promise<ApiResponse<PaginatedResult<AuditEntry>>> {
    if (!USE_MOCK) return request<PaginatedResult<AuditEntry>>(`/api/audit-logs${buildQuery(params)}`);
    return mocked(() => {
      const filtered = db.auditLogs
        .filter((l) => !params.case_id || l.case_id === params.case_id)
        .filter((l) => !params.actor_id || l.actor.id === params.actor_id)
        .filter((l) => !params.action || l.action === params.action)
        .filter((l) => !params.from || l.at >= params.from)
        .filter((l) => !params.to || l.at <= params.to);
      const page = Math.max(1, params.page ?? 1);
      const pageSize = Math.max(1, params.page_size ?? 10);
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);
      return { items, total, page, page_size: pageSize };
    });
  },
};
