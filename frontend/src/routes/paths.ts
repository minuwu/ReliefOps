import type { Role } from '@/types/api';

/** Every URL the app serves. Email links from the backend land on the auth paths. */
export const PATHS = {
  dashboard: '/dashboard',
  cases: '/cases',
  caseDetail: (caseId: string) => `/cases/${caseId}`,
  review: '/review',
  reviewDetail: (extractionId: string) => `/review/${extractionId}`,
  audit: '/audit',
  adminUsers: '/admin/users',
  knowledge: '/knowledge',

  login: '/login',
  signup: '/signup',
  verifyEmail: '/verify-email',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  acceptInvitation: '/accept-invitation',
  claimCase: '/claim-case',

  portal: '/portal',
  portalReport: '/portal/report',
  portalCase: (caseId: string) => `/portal/cases/${caseId}`,
} as const;

export const STAFF_ROLES: Role[] = ['operator', 'supervisor', 'bank_viewer'];
export const CASE_WORKERS: Role[] = ['operator', 'supervisor'];
/** Roles that may read dashboard stats and audit logs (contract §6.4, §6.6). */
export const INSIGHT_ROLES: Role[] = ['supervisor', 'bank_viewer'];

/** Where each role starts after logging in. */
export function homeFor(role: Role | undefined): string {
  switch (role) {
    case 'victim':
      return PATHS.portal;
    case 'supervisor':
      return PATHS.dashboard;
    case 'operator':
    case 'bank_viewer':
      return PATHS.cases;
    default:
      return PATHS.login;
  }
}

/** Only follows same-site relative paths, so a crafted ?next= cannot send users elsewhere. */
export function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}
