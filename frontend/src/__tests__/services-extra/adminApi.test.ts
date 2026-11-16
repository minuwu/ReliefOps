import { describe, it, expect, beforeEach } from 'vitest';
import { adminApi } from '@/services/adminApi';
import { db } from '@/services/mockStore';
import { DEMO_USERS } from '@/services/mockData';
import { storeSession, clearSession } from '@/services/http';
import type { InvitationCreate } from '@/types/api';

describe('adminApi module', () => {
  beforeEach(() => {
    clearSession();
    db.staff = JSON.parse(JSON.stringify(DEMO_USERS));
    db.invitations = [];
  });

  it('fetches health status for demo environment', async () => {
    const res = await adminApi.getHealth();

    expect(res.success).toBe(true);
    expect(res.data.status).toBe('healthy');
    expect(res.data.ai).toBe('available');
  });

  it('fetches list of demo banks', async () => {
    const res = await adminApi.getBanks();

    expect(res.success).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data[0]).toHaveProperty('id');
    expect(res.data[0]).toHaveProperty('name');
  });

  it('filters active users and by role', async () => {
    const operatorRes = await adminApi.getUsers({ role: 'operator' });
    const supervisorRes = await adminApi.getUsers({ role: 'supervisor' });

    expect(operatorRes.data.every((u) => u.role === 'operator')).toBe(true);
    expect(supervisorRes.data.every((u) => u.role === 'supervisor')).toBe(true);
  });

  it('filters out inactive users unless include_inactive is true', async () => {
    db.staff.push({
      id: 'inactive-user-1',
      name: 'Inactive User',
      email: 'inactive@test.jp',
      role: 'operator',
      bank_id: null,
      is_active: false,
      email_verified: true,
    });

    const activeOnly = await adminApi.getUsers({ include_inactive: false });
    const includeInactive = await adminApi.getUsers({ include_inactive: true });

    expect(activeOnly.data.some((u) => u.id === 'inactive-user-1')).toBe(false);
    expect(includeInactive.data.some((u) => u.id === 'inactive-user-1')).toBe(true);
  });

  it('prevents deactivating own account', async () => {
    storeSession('token-1', DEMO_USERS[0]);

    await expect(adminApi.setUserActive(DEMO_USERS[0].id, false)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('throws error when updating status of non-existent user', async () => {
    await expect(adminApi.setUserActive('non-existent-user', true)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('updates active status of an existing user successfully', async () => {
    const target = DEMO_USERS[1];
    storeSession('token-supervisor', DEMO_USERS[2]);

    const res = await adminApi.setUserActive(target.id, false);

    expect(res.data.is_active).toBe(false);
    const updatedInDb = db.staff.find((u) => u.id === target.id);
    expect(updatedInDb?.is_active).toBe(false);
  });

  it('creates an invitation for a bank viewer with bank_id assigned', async () => {
    storeSession('token-supervisor', DEMO_USERS[2]);
    const payload: InvitationCreate = {
      email: 'newviewer@bank-a.test',
      name: 'New Viewer',
      role: 'bank_viewer',
      bank_id: 'bank_a',
    };

    const res = await adminApi.createInvitation(payload);

    expect(res.success).toBe(true);
    expect(res.data.email).toBe(payload.email);
    expect(res.data.bank_id).toBe('bank_a');
    expect(res.data.status).toBe('pending');
    expect(db.invitations.length).toBe(1);
  });

  it('clears bank_id when inviting non bank_viewer roles', async () => {
    storeSession('token-supervisor', DEMO_USERS[2]);
    const payload: InvitationCreate = {
      email: 'newoperator@center.test',
      name: 'New Operator',
      role: 'operator',
      bank_id: 'bank_a',
    };

    const res = await adminApi.createInvitation(payload);

    expect(res.data.bank_id).toBeNull();
  });

  it('rejects invitation creation if email already belongs to an existing staff member', async () => {
    const payload: InvitationCreate = {
      email: DEMO_USERS[0].email,
      name: 'Duplicate Staff',
      role: 'operator',
    };

    await expect(adminApi.createInvitation(payload)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects invitation creation if email already has a pending invitation', async () => {
    const payload: InvitationCreate = {
      email: 'pending.invitee@test.jp',
      name: 'Pending Invitee',
      role: 'operator',
    };
    await adminApi.createInvitation(payload);

    await expect(adminApi.createInvitation(payload)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('retrieves the current invitations list', async () => {
    const payload: InvitationCreate = {
      email: 'listtest@test.jp',
      name: 'List Test',
      role: 'operator',
    };
    await adminApi.createInvitation(payload);

    const res = await adminApi.getInvitations();

    expect(res.data.length).toBe(1);
    expect(res.data[0].email).toBe('listtest@test.jp');
  });

  it('revokes a pending invitation', async () => {
    const payload: InvitationCreate = {
      email: 'to-revoke@test.jp',
      name: 'To Revoke',
      role: 'operator',
    };
    const created = await adminApi.createInvitation(payload);

    const revoked = await adminApi.revokeInvitation(created.data.id);

    expect(revoked.data.status).toBe('revoked');
    const stored = db.invitations.find((i) => i.id === created.data.id);
    expect(stored?.status).toBe('revoked');
  });

  it('throws error when revoking a non-existent invitation', async () => {
    await expect(adminApi.revokeInvitation('unknown-id')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('throws error when revoking an invitation that is not in pending status', async () => {
    const payload: InvitationCreate = {
      email: 'revoke-twice@test.jp',
      name: 'Revoke Twice',
      role: 'operator',
    };
    const created = await adminApi.createInvitation(payload);
    await adminApi.revokeInvitation(created.data.id);

    await expect(adminApi.revokeInvitation(created.data.id)).rejects.toMatchObject({
      code: 'INVALID_STATUS_TRANSITION',
    });
  });
});
