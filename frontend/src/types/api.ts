/**
 * API Contract Types matching docs/API_SPEC.md (v0.3.0)
 * Single Source of Truth for Frontend, Backend, and AI interfaces.
 */

export type Role = 'operator' | 'supervisor' | 'bank_viewer';

export type CaseStatus =
  | 'received'
  | 'verified'
  | 'account_check'
  | 'notice_published'
  | 'payout_review'
  | 'closed';

export type ClosureReason = 'paid_out' | 'rejected' | 'withdrawn';

export type DeadlineState = 'on_track' | 'due_soon' | 'overdue' | 'none';

export type ScamType =
  | 'phishing'
  | 'impersonation'
  | 'investment'
  | 'romance'
  | 'lottery_prize'
  | 'job_offer'
  | 'other';

export type IntakeChannel = 'web_form' | 'phone' | 'paper';

export type Language = 'en' | 'ja' | 'bn';

export type DocumentType =
  | 'intake_form'
  | 'transfer_receipt'
  | 'bank_statement'
  | 'police_report'
  | 'id_document'
  | 'other';

export type MissingField =
  | 'victim_contact'
  | 'amount'
  | 'transfer_date'
  | 'account_number'
  | 'scam_type'
  | 'document';

export type ExtractionStatus = 'pending_review' | 'accepted' | 'rejected' | 'failed';

export type ExtractionSource = 'llm' | 'rules_fallback';

export type ReviewLane = 'standard' | 'low_confidence';

export type ExtractableField =
  | 'victim_name'
  | 'victim_phone'
  | 'victim_email'
  | 'amount'
  | 'currency'
  | 'transfer_date'
  | 'account_number'
  | 'account_holder_name'
  | 'scam_type';

export type AuditAction =
  | 'auth.login'
  | 'auth.login_failed'
  | 'case.created'
  | 'case.viewed'
  | 'case.updated'
  | 'case.status_changed'
  | 'case.assigned'
  | 'case.deadline_changed'
  | 'note.added'
  | 'document.uploaded'
  | 'document.downloaded'
  | 'ai.extraction_completed'
  | 'ai.extraction_failed'
  | 'ai.review_accepted'
  | 'ai.review_rejected'
  | 'export.generated'
  | 'case.access_code_issued'
  | 'chat.escalated'
  | 'chat.staff_replied'
  | 'kb.document_uploaded'
  | 'kb.document_published'
  | 'kb.document_archived';

export type ChatRole = 'victim' | 'assistant' | 'staff';

export type AnswerType = 'grounded' | 'passages_only' | 'no_answer' | 'refused';

export type KbDocumentStatus = 'processing' | 'ready' | 'published' | 'archived' | 'failed';

export type VictimEditableField =
  | 'victim.name'
  | 'victim.phone'
  | 'victim.email'
  | 'victim.address'
  | 'victim.preferred_language'
  | 'amount'
  | 'currency'
  | 'transfer_date'
  | 'account_number'
  | 'account_holder_name'
  | 'scam_type'
  | 'description';

/* --- Standard Envelope --- */

export interface ApiResponse<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown> | { fields?: Array<{ field: string; message: string }> };
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;

/* --- Domain Entities --- */

export interface Bank {
  id: string;
  name: string;
}

export interface UserRef {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  bank_id: string | null;
}

export interface AuthSession {
  token: string;
  expires_at: string;
  user: User;
}

export interface Victim {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  preferred_language: Language;
}

export interface CaseFlags {
  missing_fields: MissingField[];
  ai_review_pending: boolean;
  shared_account_case_count: number;
  victim_question_pending: boolean;
}

export interface CaseSummary {
  id: string;
  reference: string;
  bank_id: string;
  bank_name: string;
  victim_name: string;
  amount: number | null;
  currency: string;
  scam_type: ScamType | null;
  status: CaseStatus;
  deadline: string | null;
  deadline_state: DeadlineState;
  assigned_operator: UserRef | null;
  reported_date: string;
  updated_at: string;
  flags: CaseFlags;
}

export interface Note {
  id: string;
  body: string;
  author: UserRef;
  created_at: string;
}

export interface DocumentMeta {
  id: string;
  case_id: string;
  filename: string;
  doc_type: DocumentType;
  mime_type: string;
  size_bytes: number;
  uploaded_by: UserRef;
  uploaded_at: string;
  latest_extraction: {
    id: string;
    status: ExtractionStatus;
    overall_confidence: number | null;
    review_lane: ReviewLane | null;
  } | null;
}

export interface Case extends CaseSummary {
  victim: Victim;
  transfer_date: string | null;
  account_number: string | null;
  account_holder_name: string | null;
  description: string | null;
  channel: IntakeChannel;
  closure_reason: ClosureReason | null;
  created_at: string;
  closed_at: string | null;
  allowed_transitions: CaseStatus[];
  allowed_closure_reasons: ClosureReason[];
  documents: DocumentMeta[];
  notes: Note[];
}

export interface ExtractedField {
  name: ExtractableField;
  value: string | number | null;
  confidence: number;
  evidence: string | null;
  current_case_value: string | number | null;
  final_value: string | number | null;
}

export interface Extraction {
  id: string;
  document_id: string;
  case_id: string;
  case_reference: string;
  bank_id: string;
  status: ExtractionStatus;
  source: ExtractionSource;
  model: string | null;
  prompt_version: string | null;
  overall_confidence: number | null;
  review_lane: ReviewLane | null;
  fields: ExtractedField[];
  missing_fields: ExtractableField[];
  error: {
    reason: 'timeout' | 'ai_unavailable' | 'unreadable_document' | 'invalid_ai_output';
    message: string;
  } | null;
  created_at: string;
  reviewed_by: UserRef | null;
  reviewed_at: string | null;
  review_note: string | null;
}

export interface ReviewQueueItem {
  extraction_id: string;
  case_id: string;
  case_reference: string;
  bank_id: string;
  bank_name: string;
  document_id: string;
  document_filename: string;
  source: ExtractionSource;
  overall_confidence: number | null;
  review_lane: ReviewLane;
  assigned_operator: UserRef | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: {
    type: 'user' | 'public' | 'victim' | 'system' | 'ai';
    id: string | null;
    name: string;
    role: Role | null;
  };
  action: AuditAction;
  case_id: string | null;
  case_reference: string | null;
  bank_id: string | null;
  summary: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  metadata: Record<string, unknown> | null;
}

export interface DashboardStats {
  scope: { bank_id: string | null; label: string };
  open_cases: number;
  overdue_cases: number;
  due_soon_cases: number;
  unassigned_cases: number;
  avg_handling_days: number | null;
  ai_review_pending: number;
  ai_low_confidence_pending: number;
  cases_by_status: Record<CaseStatus, number>;
  workload: { operator: UserRef; open_cases: number; overdue_cases: number }[];
  generated_at: string;
}

export interface SharedAccountAlert {
  bank_id: string;
  bank_name: string;
  account_number: string;
  case_count: number;
  total_amount: number;
  currency: string;
  cases: { id: string; reference: string; status: CaseStatus }[];
}

export interface VictimCase {
  reference: string;
  bank_name: string;
  status: CaseStatus;
  closure_reason: ClosureReason | null;
  victim: Victim;
  amount: number | null;
  currency: string;
  transfer_date: string | null;
  account_number: string | null;
  account_holder_name: string | null;
  scam_type: ScamType | null;
  description: string | null;
  missing_fields: MissingField[];
  editable_fields: VictimEditableField[];
  submitted_at: string;
  updated_at: string;
}

export interface Citation {
  document_id: string;
  document_title: string;
  version: string;
  section: string | null;
  page: number | null;
  quote: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  body: string;
  language: Language;
  created_at: string;
  author: UserRef | null;
  answer_type: AnswerType | null;
  citations: Citation[];
  confidence: number | null;
  needs_staff: boolean;
  feedback: 'helpful' | 'not_helpful' | null;
}

export interface ChatThread {
  case_reference: string;
  messages: ChatMessage[];
  victim_question_pending: boolean;
  assistant_available: boolean;
}

export interface KbDocument {
  id: string;
  bank_id: string;
  bank_name: string;
  title: string;
  version: string;
  language: Language;
  status: KbDocumentStatus;
  passage_count: number | null;
  error: string | null;
  uploaded_by: UserRef;
  uploaded_at: string;
  published_at: string | null;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}
