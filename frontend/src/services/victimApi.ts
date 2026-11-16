/**
 * Victim portal API (API_SPEC §6.7, contract v0.4.2).
 * Victims are logged-in accounts; every route works only on the caller's own cases.
 */
import type {
  ApiResponse,
  Case,
  ChatExchange,
  ChatMessage,
  ChatThread,
  Language,
  VictimCase,
  VictimCaseUpdate,
  VictimReport,
} from '@/types/api';
import { CHAT_TIMEOUT_MS, USE_MOCK, apiError, mockEnvelope, request } from './http';
import {
  actorOf,
  addAudit,
  consumeMockToken,
  currentUser,
  db,
  editableFieldsFor,
  findOwnCase,
  linkCaseToVictim,
  nowIso,
  ownCases,
  saveCase,
  toVictimCase,
} from './mockStore';
import { DEMO_BANKS } from './mockData';

const DAY_MS = 86_400_000;
const FIRST_DEADLINE_DAYS = 2;
const MAX_QUESTION = 1000;

function send<T>(endpoint: string, method: string, body?: unknown, timeoutMs?: number) {
  return request<T>(
    endpoint,
    { method, body: body === undefined ? undefined : JSON.stringify(body) },
    timeoutMs
  );
}

async function mocked<T>(fn: () => T, message = 'ok'): Promise<ApiResponse<T>> {
  return mockEnvelope(fn(), message);
}

/* --- Mock rules --------------------------------------------------------- */

function mockReport(body: VictimReport): VictimCase {
  const user = currentUser();
  if (!user.email_verified) {
    throw apiError('EMAIL_NOT_VERIFIED', 'Verify your email before reporting a case.');
  }
  const bank = DEMO_BANKS.find((b) => b.id === body.bank_id) ?? DEMO_BANKS[0];
  const at = nowIso();
  const created: Case = {
    id: crypto.randomUUID(),
    reference: `RFR-2026-${String(100 + db.cases.length).padStart(5, '0')}`,
    bank_id: bank.id,
    bank_name: bank.name,
    victim_name: body.victim.name,
    amount: body.amount,
    currency: body.currency ?? 'JPY',
    scam_type: body.scam_type,
    status: 'received',
    deadline: new Date(Date.now() + FIRST_DEADLINE_DAYS * DAY_MS).toISOString(),
    deadline_state: 'on_track',
    assigned_operator: null,
    reported_date: at.slice(0, 10),
    updated_at: at,
    flags: {
      missing_fields: body.account_number ? ['document'] : ['account_number', 'document'],
      ai_review_pending: false,
      shared_account_case_count: 0,
      victim_question_pending: false,
      possible_duplicate: false,
    },
    victim: {
      name: body.victim.name,
      phone: body.victim.phone ?? null,
      email: body.victim.email || user.email,
      address: body.victim.address ?? null,
      preferred_language: body.victim.preferred_language ?? 'ja',
    },
    transfer_date: body.transfer_date,
    account_number: body.account_number ?? null,
    account_holder_name: body.account_holder_name ?? null,
    description: body.description ?? null,
    channel: 'web_form',
    closure_reason: null,
    created_at: at,
    closed_at: null,
    allowed_transitions: ['verified', 'closed'],
    allowed_closure_reasons: ['rejected', 'withdrawn'],
    documents: [],
    notes: [],
    version: 1,
    payout_amount: null,
  };
  db.cases = [created, ...db.cases];
  linkCaseToVictim(user.email, created.reference);
  addAudit({
    actor: actorOf(user),
    action: 'case.created',
    case_id: created.id,
    case_reference: created.reference,
    bank_id: created.bank_id,
    summary: 'Case reported by the victim online',
    changes: null,
    metadata: null,
  });
  return toVictimCase(created);
}

function changedPaths(update: VictimCaseUpdate): string[] {
  const { victim } = update;
  const top = Object.keys(update).filter((k) => k !== 'expected_version' && k !== 'victim');
  const nested = victim ? Object.keys(victim).map((k) => `victim.${k}`) : [];
  return [...top, ...nested];
}

function mockUpdate(caseId: string, update: VictimCaseUpdate): VictimCase {
  const c = findOwnCase(caseId);
  if (c.status === 'closed') throw apiError('CASE_CLOSED', 'This case is closed.');
  if (c.version !== update.expected_version) {
    throw apiError('STALE_CASE', 'This case changed since you opened it. We reloaded it.', {
      current_version: c.version,
    });
  }
  const allowed: string[] = editableFieldsFor(c);
  const locked = changedPaths(update).filter((p) => !allowed.includes(p));
  if (locked.length) {
    throw apiError(
      'CASE_LOCKED',
      'Some details can no longer be changed online. Please call the operations center.',
      { locked_fields: locked }
    );
  }
  const { victim } = update;
  const rest: Partial<VictimCaseUpdate> = { ...update };
  delete rest.expected_version;
  delete rest.victim;
  const next: Case = {
    ...c,
    ...rest,
    victim: { ...c.victim, ...victim },
    victim_name: victim?.name ?? c.victim_name,
    version: c.version + 1,
    updated_at: nowIso(),
  };
  addAudit({
    actor: actorOf(currentUser()),
    action: 'case.updated',
    case_id: c.id,
    case_reference: c.reference,
    bank_id: c.bank_id,
    summary: `Victim updated ${changedPaths(update).join(', ')}`,
    changes: null,
    metadata: null,
  });
  return toVictimCase(saveCase(next));
}

function mockClaim(token: string): VictimCase {
  const mail = consumeMockToken('claim-case', token);
  const user = currentUser();
  if (mail.to.toLowerCase() !== user.email.toLowerCase()) {
    throw apiError('FORBIDDEN', 'This link was sent to a different email address.');
  }
  const c = db.cases.find((x) => x.reference === mail.subject);
  if (!c) throw apiError('INVALID_TOKEN', 'This link is no longer valid.');
  linkCaseToVictim(user.email, c.reference);
  return toVictimCase(c);
}

function threadFor(reference: string): ChatThread {
  return (
    db.chatThreads[reference] ?? {
      case_reference: reference,
      messages: [],
      victim_question_pending: false,
      assistant_available: true,
    }
  );
}

function chatMessage(partial: Partial<ChatMessage> & Pick<ChatMessage, 'role' | 'body'>): ChatMessage {
  return {
    id: crypto.randomUUID(),
    language: 'en',
    created_at: nowIso(),
    author: null,
    answer_type: null,
    citations: [],
    confidence: null,
    needs_staff: false,
    feedback: null,
    ...partial,
  };
}

function mockAsk(caseId: string, question: string, language?: Language): ChatExchange {
  const trimmed = question.trim();
  if (!trimmed || trimmed.length > MAX_QUESTION) {
    throw apiError('VALIDATION_ERROR', 'Please fix the highlighted fields.', {
      fields: [{ field: 'question', message: `Write 1 to ${MAX_QUESTION} characters.` }],
    });
  }
  const c = findOwnCase(caseId);
  const lang = language ?? c.victim.preferred_language;
  const asked = chatMessage({ role: 'victim', body: trimmed, language: lang });
  const answer = chatMessage({
    role: 'assistant',
    language: lang,
    answer_type: 'grounded',
    confidence: 0.9,
    body: `Your case ${c.reference} is at the "${c.status.replace('_', ' ')}" stage. ${c.bank_name}'s bluebook says the center processes claims in the order received and contacts you only if more documents are needed. This is general information, not a decision about a payout.`,
    citations: [
      {
        document_id: 'kb-birch-01',
        document_title: `${c.bank_name} — Fraud Relief Bluebook`,
        version: '2026.1',
        section: '3.1 After verification',
        page: 6,
        quote: 'The applicant is contacted only if further documents are required.',
      },
    ],
  });
  const thread = threadFor(c.reference);
  db.chatThreads = {
    ...db.chatThreads,
    [c.reference]: { ...thread, messages: [...thread.messages, asked, answer] },
  };
  return { question: asked, answer };
}

function mockRate(caseId: string, messageId: string, feedback: 'helpful' | 'not_helpful'): ChatMessage {
  const c = findOwnCase(caseId);
  const thread = threadFor(c.reference);
  const msg = thread.messages.find((m) => m.id === messageId && m.role === 'assistant');
  if (!msg) throw apiError('RESOURCE_NOT_FOUND', 'Message not found.');
  const rated = { ...msg, feedback };
  db.chatThreads = {
    ...db.chatThreads,
    [c.reference]: { ...thread, messages: thread.messages.map((m) => (m.id === messageId ? rated : m)) },
  };
  return rated;
}

/* --- Public API ----------------------------------------------------------- */

export const victimApi = {
  getMyCases(): Promise<ApiResponse<VictimCase[]>> {
    return USE_MOCK
      ? mocked(() => ownCases().map(toVictimCase))
      : request<VictimCase[]>('/api/victim/cases');
  },

  reportCase(body: VictimReport): Promise<ApiResponse<VictimCase>> {
    return USE_MOCK
      ? mocked(() => mockReport(body), 'Report received')
      : send<VictimCase>('/api/victim/cases', 'POST', body);
  },

  getMyCase(caseId: string): Promise<ApiResponse<VictimCase>> {
    return USE_MOCK
      ? mocked(() => toVictimCase(findOwnCase(caseId)))
      : request<VictimCase>(`/api/victim/cases/${caseId}`);
  },

  updateMyCase(caseId: string, update: VictimCaseUpdate): Promise<ApiResponse<VictimCase>> {
    return USE_MOCK
      ? mocked(() => mockUpdate(caseId, update), 'Saved')
      : send<VictimCase>(`/api/victim/cases/${caseId}`, 'PATCH', update);
  },

  claimCase(token: string): Promise<ApiResponse<VictimCase>> {
    return USE_MOCK
      ? mocked(() => mockClaim(token), 'Case linked to your account')
      : send<VictimCase>('/api/victim/claims', 'POST', { token });
  },

  getChat(caseId: string): Promise<ApiResponse<ChatThread>> {
    return USE_MOCK
      ? mocked(() => threadFor(findOwnCase(caseId).reference))
      : request<ChatThread>(`/api/victim/cases/${caseId}/chat`);
  },

  /** Always 201 even when the AI is down; check answer.answer_type. */
  askAssistant(caseId: string, question: string, language?: Language): Promise<ApiResponse<ChatExchange>> {
    return USE_MOCK
      ? mocked(() => mockAsk(caseId, question, language))
      : send<ChatExchange>(
          `/api/victim/cases/${caseId}/chat/messages`,
          'POST',
          language ? { question, language } : { question },
          CHAT_TIMEOUT_MS
        );
  },

  rateAnswer(
    caseId: string,
    messageId: string,
    feedback: 'helpful' | 'not_helpful'
  ): Promise<ApiResponse<ChatMessage>> {
    return USE_MOCK
      ? mocked(() => mockRate(caseId, messageId, feedback))
      : send<ChatMessage>(`/api/victim/cases/${caseId}/chat/messages/${messageId}/feedback`, 'POST', {
          feedback,
        });
  },
};
