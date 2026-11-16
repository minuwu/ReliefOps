import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { staffChatApi } from '@/services/staffChatApi';
import { db } from '@/services/mockStore';
import { DEMO_CASES, DEMO_CHAT_THREADS, DEMO_USERS } from '@/services/mockData';
import { clearSession, storeSession } from '@/services/http';

describe('staffChatApi module', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSession();
    db.cases = JSON.parse(JSON.stringify(DEMO_CASES));
    db.staff = JSON.parse(JSON.stringify(DEMO_USERS));
    db.chatThreads = JSON.parse(JSON.stringify(DEMO_CHAT_THREADS));
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    clearSession();
    vi.restoreAllMocks();
  });

  it('retrieves chat thread for an existing case', async () => {
    const targetCase = db.cases[0];

    const res = await staffChatApi.getThread(targetCase.id);

    expect(res.success).toBe(true);
    expect(res.data.case_reference).toBe(targetCase.reference);
    expect(Array.isArray(res.data.messages)).toBe(true);
  });

  it('rejects reply when body text is empty or blank', async () => {
    const targetCase = db.cases[0];

    await expect(staffChatApi.reply(targetCase.id, '   ')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects reply when body exceeds maximum length limit', async () => {
    const targetCase = db.cases[0];
    const overlyLongText = 'A'.repeat(4001);

    await expect(staffChatApi.reply(targetCase.id, overlyLongText)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects reply when caller is a bank viewer', async () => {
    const targetCase = db.cases.find((c) => c.bank_id === 'bank_b');
    const bankViewer = DEMO_USERS.find((u) => u.role === 'bank_viewer');
    expect(targetCase).toBeDefined();
    expect(bankViewer).toBeDefined();
    if (!targetCase || !bankViewer) throw new Error('Missing fixtures');
    storeSession('token-viewer', bankViewer);

    await expect(
      staffChatApi.reply(targetCase.id, 'We are reviewing your claim.')
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('sends staff reply message clearing pending question flag and logging audit', async () => {
    const targetCase = db.cases[0];
    targetCase.flags.victim_question_pending = true;
    const operator = DEMO_USERS[0];
    storeSession('token-op', operator);

    const res = await staffChatApi.reply(targetCase.id, {
      body: 'Thank you for providing the receipt. We are investigating with the receiving bank.',
    });

    expect(res.success).toBe(true);
    expect(res.data.role).toBe('staff');
    expect(res.data.body).toContain('Thank you for providing the receipt');
    expect(res.data.author?.id).toBe(operator.id);

    const thread = db.chatThreads[targetCase.reference];
    expect(thread.victim_question_pending).toBe(false);
    expect(thread.messages.some((m) => m.id === res.data.id)).toBe(true);

    const updatedCase = db.cases.find((c) => c.id === targetCase.id);
    expect(updatedCase).toBeDefined();
    if (!updatedCase) throw new Error('updatedCase fixture not found');
    expect(updatedCase.flags.victim_question_pending).toBe(false);

    const chatAudit = db.auditLogs.find(
      (a) => a.action === 'chat.staff_replied' && a.case_id === targetCase.id
    );
    expect(chatAudit).toBeDefined();
  });

  it('interacts with live chat API endpoints in live mode', async () => {
    localStorage.setItem('reliefops_data_mode', 'live');
    vi.resetModules();

    const liveStaffChat = await import('@/services/staffChatApi');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/cases/c-1/chat/reply')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { id: 'msg-1', role: 'staff', body: 'Live staff reply' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('/api/cases/c-1/chat')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { case_reference: 'RFR-001', messages: [] },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const threadRes = await liveStaffChat.staffChatApi.getThread('c-1');
    expect(threadRes.data.case_reference).toBe('RFR-001');

    const replyRes = await liveStaffChat.staffChatApi.reply('c-1', 'Live staff reply');
    expect(replyRes.data.body).toBe('Live staff reply');
  });
});
