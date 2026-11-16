import { describe, it, expect, beforeEach } from 'vitest';
import { casesApi } from '@/services/casesApi';
import { db, outbox } from '@/services/mockStore';
import { DEMO_CASES, DEMO_USERS } from '@/services/mockData';
import { clearSession, storeSession } from '@/services/http';
import type { CaseCreate, TransitionPayload } from '@/types/api';

describe('casesApi module', () => {
  beforeEach(() => {
    clearSession();
    db.cases = JSON.parse(JSON.stringify(DEMO_CASES));
    db.staff = JSON.parse(JSON.stringify(DEMO_USERS));
    outbox.mails = [];
  });

  it('lists cases with default pagination and filters', async () => {
    const res = await casesApi.getCases();

    expect(res.success).toBe(true);
    expect(res.data.items.length).toBeGreaterThan(0);
    expect(res.data.page).toBe(1);
  });

  it('filters cases by status and bank_id', async () => {
    const res = await casesApi.getCases({ status: 'verified', bank_id: 'bank_b' });

    expect(res.data.items.every((c) => c.status === 'verified')).toBe(true);
    expect(res.data.items.every((c) => c.bank_id === 'bank_b')).toBe(true);
  });

  it('filters cases by deadline state', async () => {
    const res = await casesApi.getCases({ deadline_state: 'on_track' });

    expect(res.data.items.every((c) => c.deadline_state === 'on_track')).toBe(true);
  });

  it('searches cases by reference, victim name, and cleaned account number', async () => {
    const targetCase = db.cases[0];

    const refSearch = await casesApi.getCases({ q: targetCase.reference });
    expect(refSearch.data.items.some((c) => c.id === targetCase.id)).toBe(true);

    const nameSearch = await casesApi.getCases({ search: targetCase.victim.name });
    expect(nameSearch.data.items.some((c) => c.id === targetCase.id)).toBe(true);

    if (targetCase.account_number) {
      const formattedAcc = targetCase.account_number.slice(0, 3) + '-' + targetCase.account_number.slice(3);
      const accSearch = await casesApi.getCases({ q: formattedAcc });
      expect(accSearch.data.items.some((c) => c.id === targetCase.id)).toBe(true);
    }
  });

  it('enforces tenant privacy for bank viewers', async () => {
    const bankBViewer = DEMO_USERS.find((u) => u.role === 'bank_viewer' && u.bank_id === 'bank_b')!;
    storeSession('token-viewer-b', bankBViewer);

    const listRes = await casesApi.getCases();
    expect(listRes.data.items.every((c) => c.bank_id === 'bank_b')).toBe(true);

    const bankACase = db.cases.find((c) => c.bank_id === 'bank_a')!;
    await expect(casesApi.getCaseById(bankACase.id)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('retrieves case details by ID for authorized operators', async () => {
    const targetCase = db.cases[0];

    const res = await casesApi.getCaseById(targetCase.id);

    expect(res.data.id).toBe(targetCase.id);
    expect(res.data.reference).toBe(targetCase.reference);
  });

  it('creates a new intake case and records audit log', async () => {
    const payload: CaseCreate = {
      bank_id: 'bank_b',
      channel: 'phone',
      victim: {
        name: 'Taro Yamada',
        email: 'taro.yamada@test.jp',
        phone: '090-1111-2222',
        preferred_language: 'ja',
      },
      amount: 1500000,
      currency: 'JPY',
      account_number: '1234567890',
      account_holder_name: 'FRAUDULENT HOLDER',
      scam_type: 'impersonation',
      description: 'Phone fraud incident',
    };

    const res = await casesApi.createCase(payload);

    expect(res.success).toBe(true);
    expect(res.data.victim.name).toBe('Taro Yamada');
    expect(res.data.status).toBe('received');
    expect(res.data.channel).toBe('phone');
    expect(db.cases.some((c) => c.id === res.data.id)).toBe(true);
  });

  it('transitions case to next valid stage and records transition note', async () => {
    const receivedCase = db.cases.find((c) => c.status === 'received')!;
    const transitionPayload: TransitionPayload = {
      to_status: 'verified',
      expected_version: receivedCase.version,
      note: 'Voucher verified by operator',
    };

    const res = await casesApi.transitionCase(receivedCase.id, transitionPayload);

    expect(res.data.status).toBe('verified');
    expect(res.data.version).toBe(receivedCase.version + 1);
    expect(res.data.notes.some((n) => n.body === 'Voucher verified by operator')).toBe(true);
  });

  it('rejects invalid status transitions', async () => {
    const receivedCase = db.cases.find((c) => c.status === 'received')!;
    const invalidPayload: TransitionPayload = {
      to_status: 'payout_review',
      expected_version: receivedCase.version,
    };

    await expect(casesApi.transitionCase(receivedCase.id, invalidPayload)).rejects.toMatchObject({
      code: 'INVALID_STATUS_TRANSITION',
    });
  });

  it('rejects transitions with stale case version', async () => {
    const targetCase = db.cases[0];
    const stalePayload: TransitionPayload = {
      to_status: 'closed',
      expected_version: targetCase.version + 99,
      closure_reason: 'rejected',
    };

    await expect(casesApi.transitionCase(targetCase.id, stalePayload)).rejects.toMatchObject({
      code: 'STALE_CASE',
    });
  });

  it('validates required fields when closing a case', async () => {
    const targetCase = db.cases.find((c) => c.status !== 'closed')!;
    const missingClosureReason: TransitionPayload = {
      to_status: 'closed',
      expected_version: targetCase.version,
    };

    await expect(casesApi.transitionCase(targetCase.id, missingClosureReason)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });

    const missingPayoutAmount: TransitionPayload = {
      to_status: 'closed',
      expected_version: targetCase.version,
      closure_reason: 'paid_out',
    };

    await expect(casesApi.transitionCase(targetCase.id, missingPayoutAmount)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('assigns and reassigns an operator to a case', async () => {
    const targetCase = db.cases[0];
    const operator = DEMO_USERS[0];

    const assignRes = await casesApi.assignCase(targetCase.id, operator.id);
    expect(assignRes.data.assigned_operator?.id).toBe(operator.id);

    const unassignRes = await casesApi.assignCase(targetCase.id, null);
    expect(unassignRes.data.assigned_operator).toBeNull();
  });

  it('adds an internal note to a case', async () => {
    const targetCase = db.cases[0];

    const res = await casesApi.addCaseNote(targetCase.id, 'Investigation details noted.');

    expect(res.data.body).toBe('Investigation details noted.');
    const updated = db.cases.find((c) => c.id === targetCase.id);
    expect(updated?.notes.some((n) => n.body === 'Investigation details noted.')).toBe(true);
  });

  it('invites victim by sending mock claim mail if victim has an email', async () => {
    const targetCase = db.cases.find((c) => !!c.victim.email)!;

    const res = await casesApi.inviteVictim(targetCase.id);

    expect(res.success).toBe(true);
    const sent = outbox.mails.find((m) => m.to === targetCase.victim.email && m.kind === 'claim-case');
    expect(sent).toBeDefined();
  });

  it('rejects victim invitation if case has no victim email', async () => {
    const noEmailCase = db.cases[0];
    noEmailCase.victim.email = null;

    await expect(casesApi.inviteVictim(noEmailCase.id)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('retrieves chat thread associated with a case', async () => {
    const targetCase = db.cases[0];

    const res = await casesApi.getCaseChat(targetCase.id);

    expect(res.success).toBe(true);
    expect(res.data.case_reference).toBe(targetCase.reference);
  });
});
