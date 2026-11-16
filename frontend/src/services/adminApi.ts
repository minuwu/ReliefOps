/**
 * Staff and Bank Administration API client (contract v0.4.2, docs/API_SPEC.md §6.1, §6.2).
 */
import type { ApiResponse, Bank, Health, Invitation, InvitationCreate, User } from '@/types/api';
import { USE_MOCK, apiError, buildQuery, mockEnvelope, mocked, request, send } from './http';
import { currentUser, db, nowIso, sendMockMail } from './mockStore';
import { DEMO_BANKS } from './mockData';

const DAY_MS = 86_400_000;

function mockInvite(body: InvitationCreate): Invitation {
  const exists =
    db.staff.some((u) => u.email === body.email) ||
    db.invitations.some((i) => i.email === body.email && i.status === 'pending');
  if (exists) throw apiError('BAD_REQUEST', 'That email already has an account or a pending invitation.');
  const user = currentUser();
  const invite: Invitation = {
    id: crypto.randomUUID(),
    email: body.email,
    name: body.name,
    role: body.role,
    bank_id: body.role === 'bank_viewer' ? body.bank_id ?? null : null,
    status: 'pending',
    invited_by: { id: user.id, name: user.name },
    created_at: nowIso(),
    expires_at: new Date(Date.now() + 3 * DAY_MS).toISOString(),
  };
  db.invitations = [invite, ...db.invitations];
  sendMockMail(invite.email, 'accept-invitation', invite.id);
  return invite;
}

function mockRevoke(invitationId: string): Invitation {
  const invite = db.invitations.find((i) => i.id === invitationId);
  if (!invite) throw apiError('RESOURCE_NOT_FOUND', 'Invitation not found.');
  if (invite.status !== 'pending') {
    throw apiError('INVALID_STATUS_TRANSITION', 'Only a pending invitation can be revoked.', {
      from: invite.status,
      to: 'revoked',
      allowed: [],
    });
  }
  const revoked: Invitation = { ...invite, status: 'revoked' };
  db.invitations = db.invitations.map((i) => (i.id === invitationId ? revoked : i));
  return revoked;
}

function mockSetActive(userId: string, isActive: boolean): User {
  if (userId === currentUser().id && !isActive) {
    throw apiError('VALIDATION_ERROR', "You can't deactivate your own account.");
  }
  const found = db.staff.find((u) => u.id === userId);
  if (!found) throw apiError('RESOURCE_NOT_FOUND', 'User not found.');
  const next = { ...found, is_active: isActive };
  db.staff = db.staff.map((u) => (u.id === userId ? next : u));
  return next;
}

export const adminApi = {
  /* 6.2 Reference data */
  getHealth(): Promise<ApiResponse<Health>> {
    return USE_MOCK
      ? mockEnvelope({
          status: 'healthy',
          db: 'ok',
          ai: 'available',
          rag: 'available',
          timestamp: new Date().toISOString(),
        })
      : request<Health>('/api/health');
  },

  getBanks(): Promise<ApiResponse<Bank[]>> {
    return USE_MOCK ? mockEnvelope(DEMO_BANKS) : request<Bank[]>('/api/banks');
  },

  getUsers(params: { role?: string; include_inactive?: boolean } = {}): Promise<ApiResponse<User[]>> {
    if (!USE_MOCK) return request<User[]>(`/api/users${buildQuery(params)}`);
    return mocked(() =>
      db.staff
        .filter((u) => !params.role || u.role === params.role)
        .filter((u) => params.include_inactive || u.is_active)
    );
  },

  /* 6.1 Staff administration (supervisor) */
  setUserActive(userId: string, isActive: boolean): Promise<ApiResponse<User>> {
    return USE_MOCK
      ? mocked(() => mockSetActive(userId, isActive))
      : send<User>(`/api/users/${userId}`, 'PATCH', { is_active: isActive });
  },

  getInvitations(): Promise<ApiResponse<Invitation[]>> {
    return USE_MOCK ? mocked(() => db.invitations) : request<Invitation[]>('/api/invitations');
  },

  createInvitation(body: InvitationCreate): Promise<ApiResponse<Invitation>> {
    return USE_MOCK
      ? mocked(() => mockInvite(body), 'Invitation sent')
      : send<Invitation>('/api/invitations', 'POST', body);
  },

  revokeInvitation(invitationId: string): Promise<ApiResponse<Invitation>> {
    return USE_MOCK
      ? mocked(() => mockRevoke(invitationId))
      : send<Invitation>(`/api/invitations/${invitationId}/revoke`, 'POST');
  },
};
