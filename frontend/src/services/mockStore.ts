/**
 * In-memory demo backend used when VITE_USE_MOCK is not 'false'.
 * It mirrors the contract's rules closely enough for the demo
 * (versions, stale writes, tenant isolation, victim ownership).
 */
import type {
  AuditEntry,
  Case,
  CaseSummary,
  ChatThread,
  Extraction,
  Invitation,
  KbDocument,
  ReviewQueueItem,
  User,
  VictimCase,
  VictimEditableField,
} from '@/types/api';
import { apiError, getStoredUser } from './http';
import {
  DEMO_AUDIT_LOGS,
  DEMO_CASES,
  DEMO_CHAT_THREADS,
  DEMO_EXTRACTIONS,
  DEMO_KB_DOCUMENTS,
  DEMO_REVIEW_QUEUE,
  DEMO_USERS,
  DEMO_VICTIMS,
  DEMO_VICTIM_CASES,
} from './mockData';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const db = {
  cases: clone(DEMO_CASES),
  extractions: clone(DEMO_EXTRACTIONS) as Record<string, Extraction>,
  reviewQueue: clone(DEMO_REVIEW_QUEUE) as ReviewQueueItem[],
  auditLogs: clone(DEMO_AUDIT_LOGS) as AuditEntry[],
  chatThreads: clone(DEMO_CHAT_THREADS) as Record<string, ChatThread>,
  kbDocuments: clone(DEMO_KB_DOCUMENTS) as KbDocument[],
  staff: clone(DEMO_USERS),
  victims: clone(DEMO_VICTIMS),
  victimCases: clone(DEMO_VICTIM_CASES),
  invitations: [] as Invitation[],
};

export function allAccounts(): User[] {
  return [...db.staff, ...db.victims];
}

/** The signed-in demo user. Falls back to the first operator only in mock mode. */
export function currentUser(): User {
  return getStoredUser() ?? db.staff[0];
}

export function nowIso(): string {
  return new Date().toISOString();
}

/* --- Cases --------------------------------------------------------------- */

export function toSummary(c: Case): CaseSummary {
  return {
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
  };
}

/** A bank viewer sees only their own bank. Anything else is 404, never 403. */
export function findVisibleCase(caseId: string): Case {
  const user = currentUser();
  const found = db.cases.find((c) => c.id === caseId || c.reference === caseId);
  if (!found || (user.role === 'bank_viewer' && found.bank_id !== user.bank_id)) {
    throw apiError('RESOURCE_NOT_FOUND', 'Case not found.');
  }
  return found;
}

/** Checks optimistic concurrency the same way the backend does. */
export function assertWritable(c: Case, expectedVersion: number): void {
  if (c.status === 'closed') {
    throw apiError('CASE_CLOSED', 'This case is closed and can no longer be changed.');
  }
  if (c.version !== expectedVersion) {
    throw apiError('STALE_CASE', 'Someone else changed this case. Reload it and try again.', {
      current_version: c.version,
    });
  }
}

export function saveCase(next: Case): Case {
  db.cases = db.cases.map((c) => (c.id === next.id ? next : c));
  return next;
}

export function addAudit(entry: Omit<AuditEntry, 'id' | 'at'>): void {
  db.auditLogs = [{ id: `aud-${Date.now()}`, at: nowIso(), ...entry }, ...db.auditLogs];
}

export function actorOf(user: User): AuditEntry['actor'] {
  return {
    type: user.role === 'victim' ? 'victim' : 'user',
    id: user.id,
    name: user.name,
    role: user.role,
  };
}

/* --- Victim view --------------------------------------------------------- */

const CONTACT_FIELDS: VictimEditableField[] = [
  'victim.phone',
  'victim.email',
  'victim.address',
  'victim.preferred_language',
];

const REPORT_FIELDS: VictimEditableField[] = [
  'victim.name',
  'amount',
  'currency',
  'transfer_date',
  'account_number',
  'account_holder_name',
  'scam_type',
  'description',
];

export function editableFieldsFor(c: Case): VictimEditableField[] {
  if (c.status === 'closed') return [];
  return c.status === 'received' ? [...CONTACT_FIELDS, ...REPORT_FIELDS] : CONTACT_FIELDS;
}

export function toVictimCase(c: Case): VictimCase {
  return {
    id: c.id,
    version: c.version,
    reference: c.reference,
    bank_name: c.bank_name,
    status: c.status,
    closure_reason: c.closure_reason,
    victim: c.victim,
    amount: c.amount,
    currency: c.currency,
    transfer_date: c.transfer_date,
    account_number: c.account_number,
    account_holder_name: c.account_holder_name,
    scam_type: c.scam_type,
    description: c.description,
    missing_fields: c.flags.missing_fields,
    editable_fields: editableFieldsFor(c),
    submitted_at: c.created_at,
    updated_at: c.updated_at,
  };
}

/** The victim's own case, or 404 (another victim's case looks the same as a missing one). */
export function findOwnCase(caseId: string): Case {
  const user = currentUser();
  const owned = db.victimCases[user.email] ?? [];
  const found = db.cases.find((c) => c.id === caseId);
  if (!found || !owned.includes(found.reference)) {
    throw apiError('RESOURCE_NOT_FOUND', 'Case not found.');
  }
  return found;
}

export function ownCases(): Case[] {
  const owned = db.victimCases[currentUser().email] ?? [];
  return db.cases.filter((c) => owned.includes(c.reference));
}

/* --- Demo outbox: stands in for the email the backend would send ---------- */

export type MailKind = 'verify-email' | 'reset-password' | 'accept-invitation' | 'claim-case';

export interface MockMail {
  to: string;
  kind: MailKind;
  token: string;
  /** Who the token belongs to (email) or what it links (case reference / invitation id). */
  subject: string;
  sent_at: string;
  used: boolean;
}

export const outbox: { mails: MockMail[] } = { mails: [] };

export function sendMockMail(to: string, kind: MailKind, subject: string): MockMail {
  const token = `${kind}-${crypto.randomUUID()}`;
  const mail: MockMail = { to, kind, token, subject, sent_at: nowIso(), used: false };
  outbox.mails = [mail, ...outbox.mails];
  return mail;
}

/** Marks a token as used and returns its mail, or throws 400 INVALID_TOKEN. */
export function consumeMockToken(kind: MailKind, token: string): MockMail {
  const mail = outbox.mails.find((m) => m.kind === kind && m.token === token && !m.used);
  if (!mail) {
    throw apiError('INVALID_TOKEN', 'This link has expired or was already used.');
  }
  outbox.mails = outbox.mails.map((m) => (m === mail ? { ...m, used: true } : m));
  return mail;
}

export function linkCaseToVictim(email: string, reference: string): void {
  const owned = db.victimCases[email] ?? [];
  db.victimCases = { ...db.victimCases, [email]: [reference, ...owned] };
}
