import type { CaseStatus, ClosureReason, Language, ScamType } from '@/types/api';

/** The six statutory stages, in order. */
export const STAGE_ORDER: CaseStatus[] = [
  'received',
  'verified',
  'account_check',
  'notice_published',
  'payout_review',
  'closed',
];

export const STAGE_LABEL: Record<CaseStatus, string> = {
  received: 'Received',
  verified: 'Verified',
  account_check: 'Account check',
  notice_published: 'Notice published',
  payout_review: 'Payout review',
  closed: 'Closed',
};

/** What each stage means, in words a victim understands. */
export const STAGE_HINT: Record<CaseStatus, string> = {
  received: 'We have your report. You can still correct any detail online.',
  verified: 'Staff checked your report. Only your contact details can change now.',
  account_check: 'The bank is checking the account you sent money to.',
  notice_published: 'A public notice about the account is open for claims.',
  payout_review: 'The bank is calculating what can be returned.',
  closed: 'This case is finished.',
};

export const CLOSURE_LABEL: Record<ClosureReason, string> = {
  paid_out: 'Money returned',
  rejected: 'Not eligible',
  withdrawn: 'Withdrawn',
};

export const SCAM_LABEL: Record<ScamType, string> = {
  investment: 'Investment / high-yield scam',
  impersonation: 'Police or authority impersonation',
  phishing: 'Phishing (SMS / email)',
  romance: 'Romance scam',
  lottery_prize: 'Lottery / prize scam',
  job_offer: 'Fake job offer',
  other: 'Other',
};

export const LANGUAGE_LABEL: Record<Language, string> = {
  ja: '日本語 (Japanese)',
  en: 'English',
  bn: 'বাংলা (Bengali)',
};

export function stageIndex(status: CaseStatus): number {
  return STAGE_ORDER.indexOf(status);
}

export function formatYen(amount: number | null, currency = 'JPY'): string {
  if (amount === null) return '—';
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency }).format(amount);
}
