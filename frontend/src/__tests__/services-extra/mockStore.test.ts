import { describe, it, expect, beforeEach } from 'vitest';
import {
  actorOf,
  allAccounts,
  assertWritable,
  consumeMockToken,
  currentUser,
  db,
  editableFieldsFor,
  findOwnCase,
  findVisibleCase,
  getMockPassword,
  linkCaseToVictim,
  outbox,
  ownCases,
  saveCase,
  sendMockMail,
  setMockPassword,
  toSummary,
  toVictimCase,
} from '@/services/mockStore';
import { DEMO_CASES, DEMO_USERS, DEMO_VICTIMS, DEMO_VICTIM_CASES } from '@/services/mockData';
import { clearSession, storeSession } from '@/services/http';

describe('mockStore module', () => {
  beforeEach(() => {
    clearSession();
    db.cases = JSON.parse(JSON.stringify(DEMO_CASES));
    db.staff = JSON.parse(JSON.stringify(DEMO_USERS));
    db.victims = JSON.parse(JSON.stringify(DEMO_VICTIMS));
    db.victimCases = JSON.parse(JSON.stringify(DEMO_VICTIM_CASES));
    outbox.mails = [];
  });

  it('sets and gets mock password for user email', () => {
    setMockPassword('testuser@test.jp', 'Secret1234!');

    expect(getMockPassword('testuser@test.jp')).toBe('Secret1234!');
    expect(getMockPassword('TESTUSER@TEST.JP')).toBe('Secret1234!');
    expect(getMockPassword('nonexistent@test.jp')).toBeUndefined();
  });

  it('aggregates staff and victims via allAccounts', () => {
    const accounts = allAccounts();

    expect(accounts.length).toBe(db.staff.length + db.victims.length);
    expect(accounts.some((u) => u.role === 'operator')).toBe(true);
    expect(accounts.some((u) => u.role === 'victim')).toBe(true);
  });

  it('resolves current user falling back to default operator in demo mode', () => {
    clearSession();
    const fallbackUser = currentUser();
    expect(fallbackUser.id).toBe(db.staff[0].id);

    storeSession('token-custom', DEMO_USERS[1]);
    const storedUser = currentUser();
    expect(storedUser.id).toBe(DEMO_USERS[1].id);
  });

  it('converts case to summary shape', () => {
    const sample = db.cases[0];

    const summary = toSummary(sample);

    expect(summary.id).toBe(sample.id);
    expect(summary.reference).toBe(sample.reference);
    expect(summary.victim_name).toBe(sample.victim.name);
    expect(summary.bank_name).toBe(sample.bank_name);
  });

  it('finds visible case by id or reference', () => {
    const sample = db.cases[0];

    expect(findVisibleCase(sample.id).id).toBe(sample.id);
    expect(findVisibleCase(sample.reference).id).toBe(sample.id);
  });

  it('throws RESOURCE_NOT_FOUND when case does not exist', () => {
    expect(() => findVisibleCase('non-existent-case-id')).toThrowError();
  });

  it('prevents bank viewer from accessing other banks cases in findVisibleCase', () => {
    const bankACase = db.cases.find((c) => c.bank_id === 'bank_a')!;
    const bankBViewer = DEMO_USERS.find((u) => u.role === 'bank_viewer' && u.bank_id === 'bank_b')!;
    storeSession('token-viewer-b', bankBViewer);

    expect(() => findVisibleCase(bankACase.id)).toThrowError();
  });

  it('validates assertWritable with concurrency and status checks', () => {
    const sample = { ...db.cases[0], version: 3, status: 'verified' as const };

    expect(() => assertWritable(sample, 3)).not.toThrow();

    expect(() => assertWritable(sample, 2)).toThrowError();

    const closed = { ...sample, status: 'closed' as const };
    expect(() => assertWritable(closed, 3)).toThrowError();
  });

  it('creates appropriate actor object based on user role', () => {
    const staffActor = actorOf(DEMO_USERS[0]);
    expect(staffActor.type).toBe('user');
    expect(staffActor.name).toBe(DEMO_USERS[0].name);

    const victimActor = actorOf(DEMO_VICTIMS[0]);
    expect(victimActor.type).toBe('victim');
    expect(victimActor.role).toBe('victim');
  });

  it('computes editable fields based on case stage', () => {
    const receivedCase = { ...db.cases[0], status: 'received' as const };
    const verifiedCase = { ...db.cases[0], status: 'verified' as const };
    const closedCase = { ...db.cases[0], status: 'closed' as const };

    expect(editableFieldsFor(receivedCase).includes('amount')).toBe(true);
    expect(editableFieldsFor(receivedCase).includes('victim.phone')).toBe(true);

    expect(editableFieldsFor(verifiedCase).includes('amount')).toBe(false);
    expect(editableFieldsFor(verifiedCase).includes('victim.phone')).toBe(true);

    expect(editableFieldsFor(closedCase)).toEqual([]);
  });

  it('transforms case into victim case representation', () => {
    const sample = db.cases[0];

    const victimCase = toVictimCase(sample);

    expect(victimCase.id).toBe(sample.id);
    expect(victimCase.reference).toBe(sample.reference);
    expect(victimCase.submitted_at).toBe(sample.created_at);
  });

  it('finds owned case for victim and lists all owned cases', () => {
    const victim = DEMO_VICTIMS[0];
    storeSession('token-victim', victim);
    const ownedRef = db.victimCases[victim.email][0];
    const targetCase = db.cases.find((c) => c.reference === ownedRef)!;

    const found = findOwnCase(targetCase.id);
    expect(found.id).toBe(targetCase.id);

    const allOwned = ownCases();
    expect(allOwned.some((c) => c.id === targetCase.id)).toBe(true);
  });

  it('throws RESOURCE_NOT_FOUND when victim tries to access unowned case in findOwnCase', () => {
    const victim = DEMO_VICTIMS[0];
    storeSession('token-victim', victim);
    const unownedCase = db.cases.find((c) => !db.victimCases[victim.email]?.includes(c.reference))!;

    expect(() => findOwnCase(unownedCase.id)).toThrowError();
  });

  it('handles sending and consuming mock email tokens', () => {
    const mail = sendMockMail('victim@test.jp', 'verify-email', 'victim@test.jp');

    expect(mail.used).toBe(false);
    expect(outbox.mails.length).toBe(1);

    const consumed = consumeMockToken('verify-email', mail.token);
    expect(consumed.token).toBe(mail.token);
    expect(outbox.mails[0].used).toBe(true);

    expect(() => consumeMockToken('verify-email', mail.token)).toThrowError();
    expect(() => consumeMockToken('verify-email', 'invalid-token-uuid')).toThrowError();
  });

  it('links case to victim email in mockStore', () => {
    const testEmail = 'newlink@test.jp';
    const testRef = 'RFR-2026-99999';

    linkCaseToVictim(testEmail, testRef);

    expect(db.victimCases[testEmail]).toContain(testRef);
  });

  it('updates an existing case with saveCase', () => {
    const target = db.cases[0];
    const modified = { ...target, amount: 999999 };

    saveCase(modified);

    const saved = db.cases.find((c) => c.id === target.id);
    expect(saved?.amount).toBe(999999);
  });
});
