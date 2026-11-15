/**
 * Staff API client (contract v0.4.2, docs/API_SPEC.md).
 * Every call has a live branch (request) and a mock branch (in-memory demo store).
 * Accounts live in authApi.ts, the victim portal in victimApi.ts.
 */
import type {
  ApiResponse,
  AuditEntry,
  Bank,
  BankId,
  Case,
  CaseStatus,
  CaseSummary,
  ChatThread,
  ClosureReason,
  DashboardStats,
  Extraction,
  Health,
  Invitation,
  InvitationCreate,
  IntakeChannel,
  KbDocument,
  Note,
  PaginatedResult,
  ReviewPayload,
  ReviewQueueItem,
  ScamType,
  SharedAccountAlert,
  TransitionPayload,
  User,
  Victim,
} from '@/types/api';
import { USE_MOCK, apiError, mockEnvelope, request } from './http';
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
import { DEMO_ALERTS, DEMO_BANKS, DEMO_STATS } from './mockData';

export { USE_MOCK, API_BASE_URL, getAuthToken, getStoredUser } from './http';

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

function send<T>(endpoint: string, method: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function query(params: object): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') q.set(key, String(value));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Mock calls throw synchronously; turn that into a rejection like a network call. */
async function mocked<T>(fn: () => T, message = 'ok'): Promise<ApiResponse<T>> {
  return mockEnvelope(fn(), message);
}

/* --- Mock rules --------------------------------------------------------- */

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

function mockReview(extractionId: string, p: ReviewPayload): Extraction {
  const ext = db.extractions[extractionId];
  if (!ext) throw apiError('RESOURCE_NOT_FOUND', 'Extraction not found.');
  if (ext.status !== 'pending_review') {
    throw apiError('ALREADY_REVIEWED', 'Someone already reviewed this extraction.');
  }
  if (p.decision === 'reject' && !p.note) {
    throw apiError('VALIDATION_ERROR', 'Please fix the highlighted fields.', {
      fields: [{ field: 'note', message: 'Say why you are rejecting.' }],
    });
  }
  const c = findVisibleCase(ext.case_id);
  assertWritable(c, p.expected_version);

  const user = currentUser();
  const accepted = p.decision === 'accept';
  const f = p.fields ?? {};
  saveCase({
    ...c,
    version: c.version + 1,
    updated_at: nowIso(),
    amount: accepted && f.amount !== undefined ? Number(f.amount) : c.amount,
    account_number: accepted && f.account_number !== undefined ? String(f.account_number) : c.account_number,
    account_holder_name:
      accepted && f.account_holder_name !== undefined ? String(f.account_holder_name) : c.account_holder_name,
    flags: { ...c.flags, ai_review_pending: false },
  });
  const reviewed: Extraction = {
    ...ext,
    status: accepted ? 'accepted' : 'rejected',
    reviewed_at: nowIso(),
    reviewed_by: { id: user.id, name: user.name },
    review_note: p.note ?? null,
  };
  db.extractions = { ...db.extractions, [extractionId]: reviewed };
  db.reviewQueue = db.reviewQueue.filter((q) => q.extraction_id !== extractionId);
  addAudit({
    actor: actorOf(user),
    action: accepted ? 'ai.review_accepted' : 'ai.review_rejected',
    case_id: c.id,
    case_reference: c.reference,
    bank_id: c.bank_id,
    summary: `AI extraction ${accepted ? 'accepted' : 'rejected'} by ${user.name}`,
    changes: null,
    metadata: null,
  });
  return reviewed;
}

function mockListCases(params: CaseQuery): PaginatedResult<CaseSummary> {
  const user = currentUser();
  const term = (params.q ?? params.search)?.toLowerCase();
  const items = db.cases
    .filter((c) => user.role !== 'bank_viewer' || c.bank_id === user.bank_id)
    .filter((c) => !params.status || c.status === params.status)
    .filter((c) => !params.bank_id || c.bank_id === params.bank_id)
    .filter((c) => !params.deadline_state || c.deadline_state === params.deadline_state)
    .filter(
      (c) =>
        !term ||
        c.reference.toLowerCase().includes(term) ||
        c.victim.name.toLowerCase().includes(term) ||
        c.bank_name.toLowerCase().includes(term)
    )
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

function mockUpdateCase(caseId: string, patch: (c: Case) => Partial<Case>): Case {
  const c = findVisibleCase(caseId);
  if (c.status === 'closed') throw apiError('CASE_CLOSED', 'This case is closed.');
  return saveCase({ ...c, ...patch(c), updated_at: nowIso() });
}

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

function mockVictimInvite(caseId: string): null {
  const c = findVisibleCase(caseId);
  if (!c.victim.email) {
    throw apiError('VALIDATION_ERROR', 'This case has no victim email to invite.');
  }
  sendMockMail(c.victim.email, 'claim-case', c.reference);
  return null;
}

/* --- Public API ----------------------------------------------------------- */

export const api = {
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
    if (!USE_MOCK) return request<User[]>(`/api/users${query(params)}`);
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

  /* 6.3 Cases */
  getCases(params: CaseQuery = {}): Promise<ApiResponse<PaginatedResult<CaseSummary>>> {
    if (USE_MOCK) return mocked(() => mockListCases(params));
    const { search, q: queryParam, ...rest } = params;
    const term = queryParam ?? search;
    const liveParams = { ...rest, ...(term ? { q: term } : {}) };
    return request<PaginatedResult<CaseSummary>>(`/api/cases${query(liveParams)}`);
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

  /* 6.5 AI extraction review */
  /** A page of pending items, low_confidence first (contract §6.5). */
  getReviewQueue(
    params: { lane?: 'standard' | 'low_confidence'; page?: number; page_size?: number } = {}
  ): Promise<ApiResponse<PaginatedResult<ReviewQueueItem>>> {
    if (!USE_MOCK) {
      return request<PaginatedResult<ReviewQueueItem>>(`/api/review-queue${query(params)}`);
    }
    return mocked(() => {
      const items = db.reviewQueue.filter((q) => !params.lane || q.review_lane === params.lane);
      return { items, total: items.length, page: 1, page_size: Math.max(items.length, 1) };
    });
  },

  getExtraction(extractionId: string): Promise<ApiResponse<Extraction>> {
    if (!USE_MOCK) return request<Extraction>(`/api/extractions/${extractionId}`);
    return mocked(() => {
      const ext = db.extractions[extractionId];
      if (!ext) throw apiError('RESOURCE_NOT_FOUND', 'Extraction not found.');
      return ext;
    });
  },

  reviewExtraction(extractionId: string, payload: ReviewPayload): Promise<ApiResponse<Extraction>> {
    return USE_MOCK
      ? mocked(() => mockReview(extractionId, payload), `Extraction ${payload.decision}ed`)
      : send<Extraction>(`/api/extractions/${extractionId}/review`, 'POST', payload);
  },

  /* 6.6 Dashboard, audit, alerts */
  getDashboardStats(bankId?: string | null): Promise<ApiResponse<DashboardStats>> {
    return USE_MOCK
      ? mockEnvelope(DEMO_STATS)
      : request<DashboardStats>(`/api/dashboard/stats${query({ bank_id: bankId })}`);
  },

  /** A page of audit entries, newest first (contract §6.4). */
  getAuditLogs(
    params: { case_id?: string; bank_id?: string; page?: number; page_size?: number } = {}
  ): Promise<ApiResponse<PaginatedResult<AuditEntry>>> {
    if (!USE_MOCK) return request<PaginatedResult<AuditEntry>>(`/api/audit-logs${query(params)}`);
    return mocked(() => {
      const items = db.auditLogs
        .filter((l) => !params.case_id || l.case_id === params.case_id)
        .filter((l) => !params.bank_id || l.bank_id === params.bank_id);
      return { items, total: items.length, page: 1, page_size: Math.max(items.length, 1) };
    });
  },

  getSharedAccountAlerts(): Promise<ApiResponse<SharedAccountAlert[]>> {
    return USE_MOCK ? mockEnvelope(DEMO_ALERTS) : request<SharedAccountAlert[]>('/api/alerts/shared-accounts');
  },

  /* 6.8 Bluebooks */
  getKbDocuments(): Promise<ApiResponse<KbDocument[]>> {
    return USE_MOCK ? mocked(() => db.kbDocuments) : request<KbDocument[]>('/api/kb/documents');
  },
};
