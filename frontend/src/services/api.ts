/**
 * Staff API client (contract v0.4.3, docs/API_SPEC.md).
 * Thin barrel re-exporting domain-specific API clients.
 * Accounts live in authApi.ts, the victim portal in victimApi.ts.
 */
import type { ApiResponse, KbDocument } from '@/types/api';
import { USE_MOCK, mocked, request } from './http';
import { db } from './mockStore';
import { adminApi } from './adminApi';
import { casesApi } from './casesApi';
import { reviewApi } from './reviewApi';
import { dashboardApi } from './dashboardApi';
import { auditApi } from './auditApi';

export { USE_MOCK, API_BASE_URL, getAuthToken, getStoredUser } from './http';
export type { CaseQuery, CaseCreate } from './casesApi';
export { casesApi } from './casesApi';
export { adminApi } from './adminApi';
export { reviewApi } from './reviewApi';
export { dashboardApi } from './dashboardApi';
export { auditApi } from './auditApi';

export const api = {
  ...adminApi,
  ...casesApi,
  ...reviewApi,
  ...dashboardApi,
  ...auditApi,

  /* 6.8 Bluebooks */
  getKbDocuments(): Promise<ApiResponse<KbDocument[]>> {
    return USE_MOCK ? mocked(() => db.kbDocuments) : request<KbDocument[]>('/api/kb/documents');
  },
};
