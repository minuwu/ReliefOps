/**
 * Dashboard & Alerts API client (contract v0.4.2, docs/API_SPEC.md §6.6).
 */
import type { ApiResponse, DashboardStats, SharedAccountAlert } from '@/types/api';
import { USE_MOCK, buildQuery, mockEnvelope, request } from './http';
import { DEMO_ALERTS, DEMO_STATS } from './mockData';

export const dashboardApi = {
  getDashboardStats(bankId?: string | null): Promise<ApiResponse<DashboardStats>> {
    return USE_MOCK
      ? mockEnvelope(DEMO_STATS)
      : request<DashboardStats>(`/api/dashboard/stats${buildQuery({ bank_id: bankId })}`);
  },

  getSharedAccountAlerts(): Promise<ApiResponse<SharedAccountAlert[]>> {
    return USE_MOCK ? mockEnvelope(DEMO_ALERTS) : request<SharedAccountAlert[]>('/api/alerts/shared-accounts');
  },
};
