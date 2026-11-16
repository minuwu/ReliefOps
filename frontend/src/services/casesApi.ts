/**
 * Cases API client (contract v0.4.2, docs/API_SPEC.md §6.3).
 */
import type {
  ApiResponse,
  BankId,
  Case,
  CaseStatus,
  CaseSummary,
  ChatThread,
  ClosureReason,
  IntakeChannel,
  Note,
  PaginatedResult,
  ScamType,
  TransitionPayload,
  Victim,
} from '@/types/api';
import { USE_MOCK, apiError, buildQuery, mocked, request, send } from './http';
import {
  actorOf,
  addAudit,
  assertWritable,
  currentUser,
  db,
  findVisibleCase,
  nowIso,
  saveCase,
  sendMockMail,
  toSummary,
} from './mockStore';
import { DEMO_BANKS } from './mockData';

const STAGES: CaseStatus[] = [
  'received',
  'verified',
  'account_check',
  'notice_published',
  'payout_review',
  'closed',
];
const DAY_MS = 86_400_000;
const STAGE_DEADLINE_DAYS = 5;

export interface CaseQuery {
  status?: string;
  bank_id?: string;
  deadline_state?: string;
  search?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

export interface CaseCreate {
  bank_id: BankId;
  channel: IntakeChannel;
  victim: Partial<Victim> & { name: string };
  amount?: number | null;
  currency?: string;
  transfer_date?: string | null;
  account_number?: string | null;
  account_holder_name?: string | null;
  scam_type?: ScamType | null;
  description?: string | null;
}

function allowedFrom(status: CaseStatus): CaseStatus[] {
  const i = STAGES.indexOf(status);
  if (status === 'closed') return [];
  const next = STAGES[i + 1];
  const prev = i > 0 ? STAGES[i - 1] : undefined;
  return [next, prev, 'closed'].filter(
    (s, idx, all): s is CaseStatus => !!s && all.indexOf(s) === idx
  );
}

function closureReasonsAt(status: CaseStatus): ClosureReason[] {
  return status === 'payout_review'
    ? ['paid_out', 'rejected', 'withdrawn']
    : ['rejected', 'withdrawn'];
}

function mockTransition(caseId: string, p: TransitionPayload): Case {
  const c = findVisibleCase(caseId);
  assertWritable(c, p.expected_version);
  const allowed = allowedFrom(c.status);
  if (!allowed.includes(p.to_status)) {
    throw apiError('INVALID_STATUS_TRANSITION', `Can't move from ${c.status} to ${p.to_status}.`, {
      from: c.status,
      to: p.to_status,
      allowed,
    });
  }
  const closing = p.to_status === 'closed';
  const fields: { field: string; message: string }[] = [];
  if (closing && !p.closure_reason) fields.push({ field: 'closure_reason', message: 'Required to close.' });
  if (p.closure_reason === 'paid_out' && p.payout_amount == null) {
    fields.push({ field: 'payout_amount', message: 'Required for a paid-out closure.' });
  }
  if (fields.length) throw apiError('VALIDATION_ERROR', 'Please fix the highlighted fields.', { fields });

  const user = currentUser();
  const at = nowIso();
  const notes = p.note
    ? [{ id: `note-${Date.now()}`, body: p.note, author: { id: user.id, name: user.name }, created_at: at }, ...c.notes]
    : c.notes;
  const next: Case = {
    ...c,
    status: p.to_status,
    version: c.version + 1,
    updated_at: at,
    notes,
    closure_reason: closing ? p.closure_reason ?? null : c.closure_reason,
    payout_amount: closing ? p.payout_amount ?? null : c.payout_amount,
    closed_at: closing ? at : null,
    deadline: closing ? null : new Date(Date.now() + STAGE_DEADLINE_DAYS * DAY_MS).toISOString(),
    deadline_state: closing ? 'none' : 'on_track',
    allowed_transitions: allowedFrom(p.to_status),
    allowed_closure_reasons: closing ? [] : closureReasonsAt(p.to_status),
  };
  addAudit({
    actor: actorOf(user),
    action: 'case.status_changed',
    case_id: c.id,
    case_reference: c.reference,
    bank_id: c.bank_id,
    summary: `Status ${c.status} → ${p.to_status}`,
    changes: { status: { from: c.status, to: p.to_status } },
    metadata: p.closure_reason ? { closure_reason: p.closure_reason } : null,
  });
  return saveCase(next);
}

function mockListCases(params: CaseQuery): PaginatedResult<CaseSummary> {
  const user = currentUser();
  const term = (params.q ?? params.search)?.toLowerCase();
  const cleanTerm = term?.replace(/[\s-]/g, '');
  const items = db.cases
    .filter((c) => user.role !== 'bank_viewer' || c.bank_id === user.bank_id)
    .filter((c) => !params.status || c.status === params.status)
    .filter((c) => !params.bank_id || c.bank_id === params.bank_id)
    .filter((c) => !params.deadline_state || c.deadline_state === params.deadline_state)
    .filter((c) => {
      if (!term) return true;
      if (
        c.reference.toLowerCase().includes(term) ||
        c.victim.name.toLowerCase().includes(term) ||
        c.bank_name.toLowerCase().includes(term)
      ) {
        return true;
      }
      if (c.account_number) {
        const accLower = c.account_number.toLowerCase();
        if (accLower.includes(term)) return true;
        const cleanAcc = accLower.replace(/[\s-]/g, '');
        if (cleanTerm && cleanTerm.length > 0 && cleanAcc.includes(cleanTerm)) return true;
      }
      return false;
    })
    .map(toSummary);
  return { items, page: params.page ?? 1, page_size: params.page_size ?? 20, total: items.length };
}

function mockCreateCase(body: CaseCreate): Case {
  const user = currentUser();
  const bank = DEMO_BANKS.find((b) => b.id === body.bank_id) ?? DEMO_BANKS[0];
  const at = nowIso();
  const created: Case = {
    id: crypto.randomUUID(),
    reference: `RFR-2026-${String(100 + db.cases.length).padStart(5, '0')}`,
    bank_id: bank.id,
    bank_name: bank.name,
    victim_name: body.victim.name,
    amount: body.amount ?? null,
    currency: body.currency ?? 'JPY',
    scam_type: body.scam_type ?? null,
    status: 'received',
    deadline: new Date(Date.now() + STAGE_DEADLINE_DAYS * DAY_MS).toISOString(),
    deadline_state: 'on_track',
    assigned_operator: null,
    reported_date: at.slice(0, 10),
    updated_at: at,
    flags: {
      missing_fields: ['document'],
      ai_review_pending: false,
      shared_account_case_count: 0,
      victim_question_pending: false,
      possible_duplicate: false,
    },
    victim: {
      name: body.victim.name,
      phone: body.victim.phone ?? null,
      email: body.victim.email ?? null,
      address: body.victim.address ?? null,
      preferred_language: body.victim.preferred_language ?? 'ja',
    },
    transfer_date: body.transfer_date ?? null,
    account_number: body.account_number ?? null,
    account_holder_name: body.account_holder_name ?? null,
    description: body.description ?? null,
    channel: body.channel,
    closure_reason: null,
    created_at: at,
    closed_at: null,
    allowed_transitions: allowedFrom('received'),
    allowed_closure_reasons: closureReasonsAt('received'),
    documents: [],
    notes: [],
    version: 1,
    payout_amount: null,
  };
  db.cases = [created, ...db.cases];
  addAudit({
    actor: actorOf(user),
    action: 'case.created',
    case_id: created.id,
    case_reference: created.reference,
    bank_id: created.bank_id,
    summary: `Case created from ${body.channel}`,
    changes: null,
    metadata: null,
  });
  return created;
}

export function mockUpdateCase(caseId: string, patch: (c: Case) => Partial<Case>): Case {
  const c = findVisibleCase(caseId);
  if (c.status === 'closed') throw apiError('CASE_CLOSED', 'This case is closed.');
  return saveCase({ ...c, ...patch(c), updated_at: nowIso() });
}

function mockVictimInvite(caseId: string): null {
  const c = findVisibleCase(caseId);
  if (!c.victim.email) {
    throw apiError('VALIDATION_ERROR', 'This case has no victim email to invite.');
  }
  sendMockMail(c.victim.email, 'claim-case', c.reference);
  return null;
}

export const casesApi = {
  getCases(params: CaseQuery = {}): Promise<ApiResponse<PaginatedResult<CaseSummary>>> {
    if (USE_MOCK) return mocked(() => mockListCases(params));
    const { search, q: queryParam, ...rest } = params;
    const term = queryParam ?? search;
    const liveParams = { ...rest, ...(term ? { q: term } : {}) };
    return request<PaginatedResult<CaseSummary>>(`/api/cases${buildQuery(liveParams)}`);
  },

  getCaseById(caseId: string): Promise<ApiResponse<Case>> {
    return USE_MOCK ? mocked(() => findVisibleCase(caseId)) : request<Case>(`/api/cases/${caseId}`);
  },

  createCase(body: CaseCreate): Promise<ApiResponse<Case>> {
    return USE_MOCK
      ? mocked(() => mockCreateCase(body), 'Case created')
      : send<Case>('/api/cases', 'POST', body);
  },

  transitionCase(caseId: string, payload: TransitionPayload): Promise<ApiResponse<Case>> {
    return USE_MOCK
      ? mocked(() => mockTransition(caseId, payload), 'Case moved')
      : send<Case>(`/api/cases/${caseId}/transition`, 'POST', payload);
  },

  assignCase(caseId: string, operatorId: string | null): Promise<ApiResponse<Case>> {
    if (!USE_MOCK) return send<Case>(`/api/cases/${caseId}/assign`, 'POST', { operator_id: operatorId });
    return mocked(() =>
      mockUpdateCase(caseId, () => {
        const op = db.staff.find((u) => u.id === operatorId);
        return { assigned_operator: op ? { id: op.id, name: op.name } : null };
      })
    );
  },

  addCaseNote(caseId: string, body: string): Promise<ApiResponse<Note>> {
    if (!USE_MOCK) return send<Note>(`/api/cases/${caseId}/notes`, 'POST', { body });
    return mocked(() => {
      const c = findVisibleCase(caseId);
      const user = currentUser();
      const note: Note = {
        id: `note-${Date.now()}`,
        body,
        author: { id: user.id, name: user.name },
        created_at: nowIso(),
      };
      saveCase({ ...c, notes: [note, ...c.notes], updated_at: nowIso() });
      addAudit({
        actor: actorOf(user),
        action: 'note.added',
        case_id: c.id,
        case_reference: c.reference,
        bank_id: c.bank_id,
        summary: `Note added by ${user.name}`,
        changes: null,
        metadata: null,
      });
      return note;
    }, 'Note added');
  },

  /** Emails the victim a link to attach this phone/paper case to their account. */
  inviteVictim(caseId: string): Promise<ApiResponse<null>> {
    return USE_MOCK
      ? mocked(() => mockVictimInvite(caseId), 'Invitation emailed to the victim')
      : send<null>(`/api/cases/${caseId}/victim-invite`, 'POST');
  },

  getCaseChat(caseId: string): Promise<ApiResponse<ChatThread>> {
    if (!USE_MOCK) return request<ChatThread>(`/api/cases/${caseId}/chat`);
    return mocked(() => {
      const c = findVisibleCase(caseId);
      return (
        db.chatThreads[c.reference] ?? {
          case_reference: c.reference,
          messages: [],
          victim_question_pending: false,
          assistant_available: true,
        }
      );
    });
  },
};
