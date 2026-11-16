import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { victimApi } from '@/services/victimApi';
import { db, outbox } from '@/services/mockStore';
import { DEMO_CASES, DEMO_CHAT_THREADS, DEMO_USERS, DEMO_VICTIMS, DEMO_VICTIM_CASES } from '@/services/mockData';
import { clearSession, storeSession } from '@/services/http';
import type { VictimReport, VictimCaseUpdate } from '@/types/api';

describe('victimApi module', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSession();
    db.cases = JSON.parse(JSON.stringify(DEMO_CASES));
    db.staff = JSON.parse(JSON.stringify(DEMO_USERS));
    db.victims = JSON.parse(JSON.stringify(DEMO_VICTIMS));
    db.victimCases = JSON.parse(JSON.stringify(DEMO_VICTIM_CASES));
    db.chatThreads = JSON.parse(JSON.stringify(DEMO_CHAT_THREADS));
    outbox.mails = [];
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    clearSession();
    vi.restoreAllMocks();
  });

  it('retrieves cases owned by the authenticated victim', async () => {
    const victimUser = DEMO_VICTIMS[0];
    storeSession('token-victim', victimUser);

    const res = await victimApi.getMyCases();

    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('rejects case reporting when victim email is not verified', async () => {
    const unverifiedVictim = { ...DEMO_VICTIMS[0], email_verified: false };
    storeSession('token-unverified', unverifiedVictim);

    const report: VictimReport = {
      bank_id: 'bank_b',
      victim: { name: 'Victim One', phone: '090-0000-0000', email: unverifiedVictim.email },
      amount: 1000000,
      currency: 'JPY',
      transfer_date: '2026-11-10',
      account_number: '1234567890',
      scam_type: 'impersonation',
      description: 'Scam report',
    };

    await expect(victimApi.reportCase(report)).rejects.toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('submits a new victim case report successfully', async () => {
    const verifiedVictim = DEMO_VICTIMS[0];
    storeSession('token-verified', verifiedVictim);

    const report: VictimReport = {
      bank_id: 'bank_b',
      victim: { name: 'Verified Victim', phone: '090-1234-5678', email: verifiedVictim.email },
      amount: 800000,
      currency: 'JPY',
      transfer_date: '2026-11-12',
      account_number: '9876543210',
      scam_type: 'investment',
      description: 'Crypto scam investment transfer',
    };

    const res = await victimApi.reportCase(report);

    expect(res.success).toBe(true);
    expect(res.data.status).toBe('received');
    expect(res.data.victim.name).toBe('Verified Victim');

    const createdInDb = db.cases.find((c) => c.id === res.data.id);
    expect(createdInDb).toBeDefined();
    expect(db.victimCases[verifiedVictim.email]?.includes(res.data.reference)).toBe(true);
  });

  it('retrieves single case details belonging to victim', async () => {
    const verifiedVictim = DEMO_VICTIMS[0];
    storeSession('token-verified', verifiedVictim);
    const ownedRef = db.victimCases[verifiedVictim.email][0];
    const ownedCase = db.cases.find((c) => c.reference === ownedRef)!;

    const res = await victimApi.getMyCase(ownedCase.id);

    expect(res.success).toBe(true);
    expect(res.data.id).toBe(ownedCase.id);
    expect(res.data.reference).toBe(ownedRef);
  });

  it('fails to fetch case that does not belong to the victim', async () => {
    const verifiedVictim = DEMO_VICTIMS[0];
    storeSession('token-verified', verifiedVictim);

    await expect(victimApi.getMyCase('non-existent-or-unowned')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('updates case details within permitted editable fields', async () => {
    const verifiedVictim = DEMO_VICTIMS[0];
    storeSession('token-verified', verifiedVictim);
    const ownedRef = db.victimCases[verifiedVictim.email][0];
    const ownedCase = db.cases.find((c) => c.reference === ownedRef)!;
    ownedCase.status = 'received';

    const update: VictimCaseUpdate = {
      expected_version: ownedCase.version,
      victim: {
        phone: '090-9999-8888',
      },
      description: 'Updated description of incident',
    };

    const res = await victimApi.updateMyCase(ownedCase.id, update);

    expect(res.success).toBe(true);
    expect(res.data.victim.phone).toBe('090-9999-8888');
    expect(res.data.description).toBe('Updated description of incident');
    expect(res.data.version).toBe(ownedCase.version + 1);
  });

  it('rejects case update when case version is stale', async () => {
    const verifiedVictim = DEMO_VICTIMS[0];
    storeSession('token-verified', verifiedVictim);
    const ownedRef = db.victimCases[verifiedVictim.email][0];
    const ownedCase = db.cases.find((c) => c.reference === ownedRef)!;

    const staleUpdate: VictimCaseUpdate = {
      expected_version: ownedCase.version + 99,
      description: 'Stale update',
    };

    await expect(victimApi.updateMyCase(ownedCase.id, staleUpdate)).rejects.toMatchObject({
      code: 'STALE_CASE',
    });
  });

  it('rejects editing locked fields on advanced status case', async () => {
    const verifiedVictim = DEMO_VICTIMS[0];
    storeSession('token-verified', verifiedVictim);
    const ownedRef = db.victimCases[verifiedVictim.email][0];
    const ownedCase = db.cases.find((c) => c.reference === ownedRef)!;
    ownedCase.status = 'verified';

    const lockedUpdate: VictimCaseUpdate = {
      expected_version: ownedCase.version,
      amount: 9999999,
    };

    await expect(victimApi.updateMyCase(ownedCase.id, lockedUpdate)).rejects.toMatchObject({
      code: 'CASE_LOCKED',
    });
  });

  it('claims a case using an invitation token', async () => {
    const verifiedVictim = DEMO_VICTIMS[0];
    storeSession('token-verified', verifiedVictim);
    const targetCase = db.cases.find((c) => !db.victimCases[verifiedVictim.email]?.includes(c.reference))!;
    outbox.mails.push({
      to: verifiedVictim.email,
      kind: 'claim-case',
      token: 'valid-claim-token',
      subject: targetCase.reference,
      sent_at: new Date().toISOString(),
      used: false,
    });

    const res = await victimApi.claimCase('valid-claim-token');

    expect(res.success).toBe(true);
    expect(res.data.reference).toBe(targetCase.reference);
    expect(db.victimCases[verifiedVictim.email]?.includes(targetCase.reference)).toBe(true);
  });

  it('rejects claim when token is sent to another email address', async () => {
    const verifiedVictim = DEMO_VICTIMS[0];
    storeSession('token-verified', verifiedVictim);
    outbox.mails.push({
      to: 'other@test.jp',
      kind: 'claim-case',
      token: 'foreign-token',
      subject: 'RFR-2026-99999',
      sent_at: new Date().toISOString(),
      used: false,
    });

    await expect(victimApi.claimCase('foreign-token')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('retrieves victim chat thread and asks assistant questions', async () => {
    const verifiedVictim = DEMO_VICTIMS[0];
    storeSession('token-verified', verifiedVictim);
    const ownedRef = db.victimCases[verifiedVictim.email][0];
    const ownedCase = db.cases.find((c) => c.reference === ownedRef)!;

    const threadRes = await victimApi.getChat(ownedCase.id);
    expect(threadRes.success).toBe(true);
    expect(threadRes.data.case_reference).toBe(ownedRef);

    const askRes = await victimApi.askAssistant(ownedCase.id, 'What documents do I need to prepare?');
    expect(askRes.success).toBe(true);
    expect(askRes.data.question.body).toBe('What documents do I need to prepare?');
    expect(askRes.data.answer.role).toBe('assistant');
  });

  it('rejects asking empty question to assistant', async () => {
    const verifiedVictim = DEMO_VICTIMS[0];
    storeSession('token-verified', verifiedVictim);
    const ownedRef = db.victimCases[verifiedVictim.email][0];
    const ownedCase = db.cases.find((c) => c.reference === ownedRef)!;

    await expect(victimApi.askAssistant(ownedCase.id, '    ')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('rates an assistant answer as helpful or not helpful', async () => {
    const verifiedVictim = DEMO_VICTIMS[0];
    storeSession('token-verified', verifiedVictim);
    const ownedRef = db.victimCases[verifiedVictim.email][0];
    const ownedCase = db.cases.find((c) => c.reference === ownedRef)!;

    const askRes = await victimApi.askAssistant(ownedCase.id, 'How long does review take?');
    const answerId = askRes.data.answer.id;

    const rateRes = await victimApi.rateAnswer(ownedCase.id, answerId, 'helpful');

    expect(rateRes.success).toBe(true);
    expect(rateRes.data.feedback).toBe('helpful');
  });

  it('interacts with live victim endpoints in live mode', async () => {
    localStorage.setItem('reliefops_data_mode', 'live');
    vi.resetModules();

    const liveVictim = await import('@/services/victimApi');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/victim/cases/c-1/chat/messages/msg-1/feedback')) {
        return new Response(JSON.stringify({ success: true, data: { id: 'msg-1', feedback: 'helpful' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/api/victim/cases/c-1/chat/messages')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { question: { id: 'q-1' }, answer: { id: 'msg-1' } },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('/api/victim/cases/c-1/chat')) {
        return new Response(JSON.stringify({ success: true, data: { case_reference: 'RFR-1', messages: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/api/victim/cases/c-1')) {
        return new Response(JSON.stringify({ success: true, data: { id: 'c-1', reference: 'RFR-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/api/victim/cases')) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/api/victim/claims')) {
        return new Response(JSON.stringify({ success: true, data: { id: 'c-claimed' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    const casesRes = await liveVictim.victimApi.getMyCases();
    expect(casesRes.data).toEqual([]);

    const singleRes = await liveVictim.victimApi.getMyCase('c-1');
    expect(singleRes.data.id).toBe('c-1');

    const chatRes = await liveVictim.victimApi.getChat('c-1');
    expect(chatRes.data.case_reference).toBe('RFR-1');

    const askRes = await liveVictim.victimApi.askAssistant('c-1', 'Live question', 'ja');
    expect(askRes.data.question.id).toBe('q-1');

    const rateRes = await liveVictim.victimApi.rateAnswer('c-1', 'msg-1', 'helpful');
    expect(rateRes.data.feedback).toBe('helpful');

    const claimRes = await liveVictim.victimApi.claimCase('token-1');
    expect(claimRes.data.id).toBe('c-claimed');
  });
});
