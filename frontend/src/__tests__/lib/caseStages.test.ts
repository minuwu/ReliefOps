import { describe, it, expect } from 'vitest';
import {
  STAGE_ORDER,
  STAGE_LABEL,
  STAGE_HINT,
  CLOSURE_LABEL,
  SCAM_LABEL,
  LANGUAGE_LABEL,
  stageIndex,
} from '@/lib/caseStages';

describe('caseStages helpers and constants', () => {
  it('defines the statutory six stages in exact sequential order', () => {
    expect(STAGE_ORDER).toEqual([
      'received',
      'verified',
      'account_check',
      'notice_published',
      'payout_review',
      'closed',
    ]);
  });

  it('provides human-readable labels for all six stages', () => {
    for (const stage of STAGE_ORDER) {
      expect(STAGE_LABEL[stage]).toBeDefined();
      expect(typeof STAGE_LABEL[stage]).toBe('string');
      expect(STAGE_LABEL[stage].length).toBeGreaterThan(0);
    }
  });

  it('provides victim-facing hints explaining every statutory stage', () => {
    for (const stage of STAGE_ORDER) {
      expect(STAGE_HINT[stage]).toBeDefined();
      expect(typeof STAGE_HINT[stage]).toBe('string');
      expect(STAGE_HINT[stage].length).toBeGreaterThan(10);
    }
  });

  it('provides closure labels for each closure reason', () => {
    expect(CLOSURE_LABEL.paid_out).toBe('Money returned');
    expect(CLOSURE_LABEL.rejected).toBe('Not eligible');
    expect(CLOSURE_LABEL.withdrawn).toBe('Withdrawn');
  });

  it('provides labels for all supported scam categories', () => {
    expect(SCAM_LABEL.investment).toBe('Investment / high-yield scam');
    expect(SCAM_LABEL.impersonation).toBe('Police or authority impersonation');
    expect(SCAM_LABEL.phishing).toBe('Phishing (SMS / email)');
    expect(SCAM_LABEL.romance).toBe('Romance scam');
    expect(SCAM_LABEL.lottery_prize).toBe('Lottery / prize scam');
    expect(SCAM_LABEL.job_offer).toBe('Fake job offer');
    expect(SCAM_LABEL.other).toBe('Other');
  });

  it('provides labels for supported multilingual options', () => {
    expect(LANGUAGE_LABEL.ja).toBe('日本語 (Japanese)');
    expect(LANGUAGE_LABEL.en).toBe('English');
    expect(LANGUAGE_LABEL.bn).toBe('বাংলা (Bengali)');
  });

  it('calculates the zero-based stage index correctly', () => {
    expect(stageIndex('received')).toBe(0);
    expect(stageIndex('verified')).toBe(1);
    expect(stageIndex('account_check')).toBe(2);
    expect(stageIndex('notice_published')).toBe(3);
    expect(stageIndex('payout_review')).toBe(4);
    expect(stageIndex('closed')).toBe(5);
  });
});
