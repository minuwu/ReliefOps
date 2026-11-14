/**
 * Singular API Client Layer for ReliefOps
 *
 * ARCHITECTURAL TOGGLE:
 * Set USE_MOCK to false to immediately switch from in-memory contract demo data
 * to the live backend (FastAPI at http://localhost:8000 or Prism mock at :4010).
 */
export const USE_MOCK: boolean = true; // ← CHANGE THIS ONE LINE TO CONNECT TO LIVE BACKEND

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || (USE_MOCK ? '' : 'http://localhost:8000');

import {
  ApiResponse,
  ApiErrorDetail,
  User,
  AuthSession,
  Bank,
  Case,
  CaseSummary,
  CaseStatus,
  ClosureReason,
  ReviewQueueItem,
  Extraction,
  AuditEntry,
  DashboardStats,
  SharedAccountAlert,
  VictimCase,
  ChatThread,
  ChatMessage,
  KbDocument,
  PaginatedResult,
} from '@/types/api';

import {
  DEMO_BANKS,
  DEMO_USERS,
  DEMO_CASES,
  DEMO_EXTRACTIONS,
  DEMO_REVIEW_QUEUE,
  DEMO_AUDIT_LOGS,
  DEMO_STATS,
  DEMO_ALERTS,
  DEMO_CHAT_THREADS,
  DEMO_KB_DOCUMENTS,
} from './mockData';

// --- In-Memory State for Reactive Demo Experience ---
let memoryCases: Case[] = JSON.parse(JSON.stringify(DEMO_CASES));
let memoryExtractions: Record<string, Extraction> = JSON.parse(JSON.stringify(DEMO_EXTRACTIONS));
let memoryReviewQueue: ReviewQueueItem[] = JSON.parse(JSON.stringify(DEMO_REVIEW_QUEUE));
let memoryAuditLogs: AuditEntry[] = JSON.parse(JSON.stringify(DEMO_AUDIT_LOGS));
let memoryChatThreads: Record<string, ChatThread> = JSON.parse(JSON.stringify(DEMO_CHAT_THREADS));
let memoryKbDocuments: KbDocument[] = JSON.parse(JSON.stringify(DEMO_KB_DOCUMENTS));

// Token management helper
export function getAuthToken(): string | null {
  return localStorage.getItem('reliefops_auth_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('reliefops_auth_token', token);
}

export function clearAuthToken(): void {
  localStorage.removeItem('reliefops_auth_token');
  localStorage.removeItem('reliefops_auth_user');
}

export function getStoredUser(): User | null {
  const json = localStorage.getItem('reliefops_auth_user');
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem('reliefops_auth_user', JSON.stringify(user));
}

// Internal live request dispatcher
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await response.json();

  if (!response.ok || !json.success) {
    const error: ApiErrorDetail = json.error || {
      code: 'HTTP_ERROR_' + response.status,
      message: json.message || response.statusText || 'An unexpected error occurred',
    };
    throw error;
  }

  return json as ApiResponse<T>;
}

// Helper to wrap mock results in the official contract envelope
function mockEnvelope<T>(data: T, message: string = 'ok'): Promise<ApiResponse<T>> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        data,
        message,
      });
    }, 120); // Simulates realistic ~120ms network latency
  });
}

/**
 * ============================================================================
 * UNIFIED API INTERFACE (MOCK OR LIVE)
 * ============================================================================
 */
export const api = {
  /* --------------------------------------------------------------------------
   * 6.1 AUTH
   * -------------------------------------------------------------------------- */
  async login(email: string, password?: string): Promise<ApiResponse<AuthSession>> {
    if (!USE_MOCK) {
      return request<AuthSession>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: password || 'Demo@1234' }),
      });
    }

    const matchedUser = DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!matchedUser) {
      throw {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password. Use demo accounts (e.g., operator1@opscenter.test)',
      };
    }

    const session: AuthSession = {
      token: `demo_jwt_token_${matchedUser.role}_${matchedUser.id}`,
      expires_at: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
      user: matchedUser,
    };

    setAuthToken(session.token);
    setStoredUser(session.user);
    return mockEnvelope(session, 'Login successful');
  },

  async getMe(): Promise<ApiResponse<User>> {
    if (!USE_MOCK) {
      return request<User>('/api/auth/me');
    }
    const user = getStoredUser() || DEMO_USERS[0];
    return mockEnvelope(user);
  },

  async logout(): Promise<void> {
    clearAuthToken();
  },

  /* --------------------------------------------------------------------------
   * 6.2 METADATA & HEALTH
   * -------------------------------------------------------------------------- */
  async getHealth(): Promise<ApiResponse<{ status: string; ai: string; rag: string; version: string }>> {
    if (!USE_MOCK) {
      return request<{ status: string; ai: string; rag: string; version: string }>('/api/health');
    }
    return mockEnvelope({
      status: 'healthy',
      ai: 'available',
      rag: 'available',
      version: '0.3.0',
    });
  },

  async getBanks(): Promise<ApiResponse<Bank[]>> {
    if (!USE_MOCK) {
      return request<Bank[]>('/api/banks');
    }
    return mockEnvelope(DEMO_BANKS);
  },

  async getUsers(): Promise<ApiResponse<User[]>> {
    if (!USE_MOCK) {
      return request<User[]>('/api/users');
    }
    return mockEnvelope(DEMO_USERS);
  },

  /* --------------------------------------------------------------------------
   * 6.3 CASE MANAGEMENT
   * -------------------------------------------------------------------------- */
  async getCases(params?: {
    status?: string;
    bank_id?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<ApiResponse<PaginatedResult<CaseSummary>>> {
    if (!USE_MOCK) {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.bank_id) q.set('bank_id', params.bank_id);
      if (params?.search) q.set('search', params.search);
      if (params?.page) q.set('page', String(params.page));
      if (params?.page_size) q.set('page_size', String(params.page_size));
      return request<PaginatedResult<CaseSummary>>(`/api/cases?${q.toString()}`);
    }

    let items = memoryCases.map((c) => ({
      id: c.id,
      reference: c.reference,
      bank_id: c.bank_id,
      bank_name: c.bank_name,
      victim_name: c.victim.name,
      amount: c.amount,
      currency: c.currency,
      scam_type: c.scam_type,
      status: c.status,
      deadline: c.deadline,
      deadline_state: c.deadline_state,
      assigned_operator: c.assigned_operator,
      reported_date: c.reported_date,
      updated_at: c.updated_at,
      flags: c.flags,
    }));

    if (params?.status) {
      items = items.filter((c) => c.status === params.status);
    }
    if (params?.bank_id) {
      items = items.filter((c) => c.bank_id === params.bank_id);
    }
    if (params?.search) {
      const term = params.search.toLowerCase();
      items = items.filter(
        (c) =>
          c.reference.toLowerCase().includes(term) ||
          c.victim_name.toLowerCase().includes(term) ||
          c.bank_name.toLowerCase().includes(term)
      );
    }

    return mockEnvelope({
      items,
      page: params?.page || 1,
      page_size: params?.page_size || 20,
      total: items.length,
    });
  },

  async getCaseById(caseId: string): Promise<ApiResponse<Case>> {
    if (!USE_MOCK) {
      return request<Case>(`/api/cases/${caseId}`);
    }
    const found = memoryCases.find((c) => c.id === caseId || c.reference === caseId);
    if (!found) {
      throw {
        code: 'RESOURCE_NOT_FOUND',
        message: 'Case not found or belongs to another bank.',
      };
    }
    return mockEnvelope(found);
  },

  async transitionCase(
    caseId: string,
    payload: { status: CaseStatus; closure_reason?: ClosureReason; note?: string }
  ): Promise<ApiResponse<Case>> {
    if (!USE_MOCK) {
      return request<Case>(`/api/cases/${caseId}/transition`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    const caseItem = memoryCases.find((c) => c.id === caseId);
    if (!caseItem) throw { code: 'RESOURCE_NOT_FOUND', message: 'Case not found' };

    const oldStatus = caseItem.status;
    caseItem.status = payload.status;
    caseItem.updated_at = new Date().toISOString();

    if (payload.closure_reason) {
      caseItem.closure_reason = payload.closure_reason;
    }
    if (payload.status === 'closed') {
      caseItem.closed_at = new Date().toISOString();
      caseItem.deadline_state = 'none';
      caseItem.deadline = null;
      caseItem.allowed_transitions = [];
      caseItem.allowed_closure_reasons = [];
    }

    if (payload.note) {
      caseItem.notes.unshift({
        id: `note-${Date.now()}`,
        body: `[Transition: ${oldStatus} → ${payload.status}] ${payload.note}`,
        author: { id: DEMO_USERS[0].id, name: DEMO_USERS[0].name },
        created_at: new Date().toISOString(),
      });
    }

    // Add audit entry
    memoryAuditLogs.unshift({
      id: `aud-${Date.now()}`,
      at: new Date().toISOString(),
      actor: {
        type: 'user',
        id: DEMO_USERS[0].id,
        name: DEMO_USERS[0].name,
        role: 'operator',
      },
      action: 'case.status_changed',
      case_id: caseItem.id,
      case_reference: caseItem.reference,
      bank_id: caseItem.bank_id,
      summary: `Status ${oldStatus} → ${payload.status}`,
      changes: { status: { from: oldStatus, to: payload.status } },
      metadata: payload.closure_reason ? { closure_reason: payload.closure_reason } : null,
    });

    return mockEnvelope(caseItem, 'Status transitioned successfully');
  },

  async assignCase(caseId: string, operatorId: string | null): Promise<ApiResponse<Case>> {
    if (!USE_MOCK) {
      return request<Case>(`/api/cases/${caseId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ operator_id: operatorId }),
      });
    }

    const caseItem = memoryCases.find((c) => c.id === caseId);
    if (!caseItem) throw { code: 'RESOURCE_NOT_FOUND', message: 'Case not found' };

    const operator = DEMO_USERS.find((u) => u.id === operatorId);
    caseItem.assigned_operator = operator ? { id: operator.id, name: operator.name } : null;
    caseItem.updated_at = new Date().toISOString();

    return mockEnvelope(caseItem, 'Case assignment updated');
  },

  async addCaseNote(caseId: string, body: string): Promise<ApiResponse<Case>> {
    if (!USE_MOCK) {
      return request<Case>(`/api/cases/${caseId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
    }

    const caseItem = memoryCases.find((c) => c.id === caseId);
    if (!caseItem) throw { code: 'RESOURCE_NOT_FOUND', message: 'Case not found' };

    const newNote = {
      id: `note-${Date.now()}`,
      body,
      author: { id: DEMO_USERS[0].id, name: DEMO_USERS[0].name },
      created_at: new Date().toISOString(),
    };
    caseItem.notes.unshift(newNote);
    caseItem.updated_at = new Date().toISOString();

    return mockEnvelope(caseItem, 'Note added');
  },

  async issueVictimAccessCode(caseId: string): Promise<ApiResponse<{ access_code: string; expires_at: string }>> {
    if (!USE_MOCK) {
      return request<{ access_code: string; expires_at: string }>(`/api/cases/${caseId}/victim-access`, {
        method: 'POST',
      });
    }
    // Generate synthetic 12-char code
    const access_code = 'K7QM-4XHP-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    return mockEnvelope(
      {
        access_code,
        expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
      },
      'Access code issued'
    );
  },

  /* --------------------------------------------------------------------------
   * 6.4 PUBLIC INTAKE FORM (NO LOGIN)
   * -------------------------------------------------------------------------- */
  async submitIntake(data: {
    bank_id: string;
    victim_name: string;
    victim_phone: string;
    victim_email: string;
    victim_address?: string;
    preferred_language?: string;
    amount: number;
    currency: string;
    transfer_date: string;
    account_number: string;
    account_holder_name?: string;
    scam_type: string;
    description: string;
  }): Promise<ApiResponse<{ case_id: string; reference: string; access_code: string }>> {
    if (!USE_MOCK) {
      return request<{ case_id: string; reference: string; access_code: string }>('/api/intake', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }

    const reference = `RFR-2026-000${memoryCases.length + 50}`;
    const newCaseId = `c0000000-0000-4000-8000-${Date.now()}`;
    const bank = DEMO_BANKS.find((b) => b.id === data.bank_id) || DEMO_BANKS[0];
    const access_code = 'M3PX-8KWN-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    const newCase: Case = {
      id: newCaseId,
      reference,
      bank_id: bank.id,
      bank_name: bank.name,
      victim_name: data.victim_name,
      amount: data.amount,
      currency: data.currency || 'JPY',
      scam_type: data.scam_type as any,
      status: 'received',
      deadline: new Date(Date.now() + 2 * 86400 * 1000).toISOString(),
      deadline_state: 'on_track',
      assigned_operator: null,
      reported_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
      flags: {
        missing_fields: ['document'],
        ai_review_pending: false,
        shared_account_case_count: 0,
        victim_question_pending: false,
      },
      victim: {
        name: data.victim_name,
        phone: data.victim_phone || null,
        email: data.victim_email || null,
        address: data.victim_address || null,
        preferred_language: (data.preferred_language as any) || 'en',
      },
      transfer_date: data.transfer_date,
      account_number: data.account_number,
      account_holder_name: data.account_holder_name || null,
      description: data.description,
      channel: 'web_form',
      closure_reason: null,
      created_at: new Date().toISOString(),
      closed_at: null,
      allowed_transitions: ['verified', 'closed'],
      allowed_closure_reasons: ['withdrawn'],
      documents: [],
      notes: [],
    };

    memoryCases.unshift(newCase);

    return mockEnvelope(
      {
        case_id: newCaseId,
        reference,
        access_code,
      },
      'Intake report received successfully'
    );
  },

  /* --------------------------------------------------------------------------
   * 6.5 AI DOCUMENT EXTRACTION & HITL REVIEW
   * -------------------------------------------------------------------------- */
  async getReviewQueue(): Promise<ApiResponse<ReviewQueueItem[]>> {
    if (!USE_MOCK) {
      return request<ReviewQueueItem[]>('/api/review-queue');
    }
    return mockEnvelope(memoryReviewQueue);
  },

  async getExtraction(extractionId: string): Promise<ApiResponse<Extraction>> {
    if (!USE_MOCK) {
      return request<Extraction>(`/api/extractions/${extractionId}`);
    }
    const ext = memoryExtractions[extractionId];
    if (!ext) throw { code: 'RESOURCE_NOT_FOUND', message: 'Extraction not found' };
    return mockEnvelope(ext);
  },

  async reviewExtraction(
    extractionId: string,
    payload: {
      action: 'accept' | 'reject';
      approved_fields?: Record<string, string | number | null>;
      review_note?: string;
    }
  ): Promise<ApiResponse<Extraction>> {
    if (!USE_MOCK) {
      return request<Extraction>(`/api/extractions/${extractionId}/review`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    const ext = memoryExtractions[extractionId];
    if (!ext) throw { code: 'RESOURCE_NOT_FOUND', message: 'Extraction not found' };

    ext.status = payload.action === 'accept' ? 'accepted' : 'rejected';
    ext.reviewed_at = new Date().toISOString();
    ext.reviewed_by = { id: DEMO_USERS[0].id, name: DEMO_USERS[0].name };
    ext.review_note = payload.review_note || null;

    if (payload.action === 'accept' && payload.approved_fields) {
      const caseItem = memoryCases.find((c) => c.id === ext.case_id);
      if (caseItem) {
        if (payload.approved_fields.amount !== undefined) {
          caseItem.amount = Number(payload.approved_fields.amount);
        }
        if (payload.approved_fields.account_number !== undefined) {
          caseItem.account_number = String(payload.approved_fields.account_number);
        }
        if (payload.approved_fields.account_holder_name !== undefined) {
          caseItem.account_holder_name = String(payload.approved_fields.account_holder_name);
        }
        caseItem.flags.ai_review_pending = false;
        caseItem.updated_at = new Date().toISOString();
      }
    }

    // Remove from active review queue
    memoryReviewQueue = memoryReviewQueue.filter((q) => q.extraction_id !== extractionId);

    return mockEnvelope(ext, `Extraction ${payload.action}ed successfully`);
  },

  /* --------------------------------------------------------------------------
   * 6.6 DASHBOARD & AUDIT LOGS
   * -------------------------------------------------------------------------- */
  async getDashboardStats(bankId?: string | null): Promise<ApiResponse<DashboardStats>> {
    if (!USE_MOCK) {
      const q = bankId ? `?bank_id=${bankId}` : '';
      return request<DashboardStats>(`/api/dashboard/stats${q}`);
    }
    return mockEnvelope(DEMO_STATS);
  },

  async getAuditLogs(params?: { case_id?: string; bank_id?: string }): Promise<ApiResponse<AuditEntry[]>> {
    if (!USE_MOCK) {
      const q = new URLSearchParams();
      if (params?.case_id) q.set('case_id', params.case_id);
      if (params?.bank_id) q.set('bank_id', params.bank_id);
      return request<AuditEntry[]>(`/api/audit-logs?${q.toString()}`);
    }
    let logs = [...memoryAuditLogs];
    if (params?.case_id) logs = logs.filter((l) => l.case_id === params.case_id);
    if (params?.bank_id) logs = logs.filter((l) => l.bank_id === params.bank_id);
    return mockEnvelope(logs);
  },

  async getSharedAccountAlerts(): Promise<ApiResponse<SharedAccountAlert[]>> {
    if (!USE_MOCK) {
      return request<SharedAccountAlert[]>('/api/alerts/shared-accounts');
    }
    return mockEnvelope(DEMO_ALERTS);
  },

  /* --------------------------------------------------------------------------
   * 6.7 VICTIM SELF-SERVICE & CASE ASSISTANT (RAG)
   * -------------------------------------------------------------------------- */
  async createVictimSession(
    reference: string,
    access_code: string
  ): Promise<ApiResponse<{ token: string; case: VictimCase }>> {
    if (!USE_MOCK) {
      return request<{ token: string; case: VictimCase }>('/api/victim/session', {
        method: 'POST',
        body: JSON.stringify({ reference, access_code }),
      });
    }

    const matched = memoryCases.find((c) => c.reference.toUpperCase() === reference.toUpperCase());
    if (!matched) {
      throw {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid case reference or access code. Try demo: RFR-2026-00042 / K7QM-4XHP-2RTV',
      };
    }

    const victimCase: VictimCase = {
      reference: matched.reference,
      bank_name: matched.bank_name,
      status: matched.status,
      closure_reason: matched.closure_reason,
      victim: matched.victim,
      amount: matched.amount,
      currency: matched.currency,
      transfer_date: matched.transfer_date,
      account_number: matched.account_number,
      account_holder_name: matched.account_holder_name,
      scam_type: matched.scam_type,
      description: matched.description,
      missing_fields: matched.flags.missing_fields,
      editable_fields:
        matched.status === 'received'
          ? [
              'victim.name',
              'victim.phone',
              'victim.email',
              'victim.address',
              'amount',
              'currency',
              'transfer_date',
              'account_number',
              'account_holder_name',
              'scam_type',
              'description',
            ]
          : ['victim.phone', 'victim.email', 'victim.address', 'victim.preferred_language'],
      submitted_at: matched.created_at,
      updated_at: matched.updated_at,
    };

    return mockEnvelope(
      {
        token: `victim_session_token_${matched.reference}`,
        case: victimCase,
      },
      'Victim session authenticated'
    );
  },

  async getVictimChat(caseReference: string): Promise<ApiResponse<ChatThread>> {
    if (!USE_MOCK) {
      return request<ChatThread>('/api/victim/chat');
    }
    const thread = memoryChatThreads[caseReference] || {
      case_reference: caseReference,
      messages: [],
      victim_question_pending: false,
      assistant_available: true,
    };
    return mockEnvelope(thread);
  },

  async sendVictimMessage(caseReference: string, question: string): Promise<ApiResponse<ChatMessage>> {
    if (!USE_MOCK) {
      return request<ChatMessage>('/api/victim/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ question }),
      });
    }

    if (!memoryChatThreads[caseReference]) {
      memoryChatThreads[caseReference] = {
        case_reference: caseReference,
        messages: [],
        victim_question_pending: false,
        assistant_available: true,
      };
    }

    const thread = memoryChatThreads[caseReference];

    // User message
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'victim',
      body: question,
      language: 'en',
      created_at: new Date().toISOString(),
      author: null,
      answer_type: null,
      citations: [],
      confidence: null,
      needs_staff: false,
      feedback: null,
    };
    thread.messages.push(userMsg);

    // Simulated RAG Grounded Answer from bank bluebook
    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now()}-a`,
      role: 'assistant',
      body: `According to Birch Regional Bank's Fraud Relief Protocol, all transactions verified through the Operations Center are catalogued under the statutory restitution schedule. Operators review claims in the order received, and you will receive a formal notification once account verification completes.`,
      language: 'en',
      created_at: new Date().toISOString(),
      author: null,
      answer_type: 'grounded',
      citations: [
        {
          document_id: 'kb-birch-01',
          document_title: 'Birch Regional Bank — Fraud Relief Bluebook',
          version: '2026.1',
          section: '3.2 Restitution Notice Timeline',
          page: 6,
          quote: 'Restitution claims shall be processed sequentially by the Central Operations Bureau under standardized verification protocols.',
        },
      ],
      confidence: 0.93,
      needs_staff: false,
      feedback: null,
    };

    thread.messages.push(assistantMsg);
    return mockEnvelope(assistantMsg);
  },

  /* --------------------------------------------------------------------------
   * 6.8 KNOWLEDGE BASE (BLUEBOOKS)
   * -------------------------------------------------------------------------- */
  async getKbDocuments(): Promise<ApiResponse<KbDocument[]>> {
    if (!USE_MOCK) {
      return request<KbDocument[]>('/api/kb/documents');
    }
    return mockEnvelope(memoryKbDocuments);
  },
};
