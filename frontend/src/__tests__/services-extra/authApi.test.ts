import { describe, it, expect, beforeEach } from 'vitest';
import { authApi } from '@/services/authApi';
import { adminApi } from '@/services/adminApi';
import { db, outbox, setMockPassword } from '@/services/mockStore';
import { DEMO_PASSWORD, DEMO_USERS, DEMO_VICTIMS } from '@/services/mockData';
import { clearSession, getAuthToken, getStoredUser } from '@/services/http';

describe('authApi module', () => {
  beforeEach(() => {
    clearSession();
    db.staff = JSON.parse(JSON.stringify(DEMO_USERS));
    db.victims = JSON.parse(JSON.stringify(DEMO_VICTIMS));
    outbox.mails = [];
  });

  it('authenticates active user with valid credentials and stores session', async () => {
    const operator = DEMO_USERS[0];

    const res = await authApi.login(operator.email, DEMO_PASSWORD);

    expect(res.success).toBe(true);
    expect(res.data.user.email).toBe(operator.email);
    expect(getAuthToken()).toBe(res.data.token);
    expect(getStoredUser()?.id).toBe(operator.id);
  });

  it('rejects login with wrong password', async () => {
    await expect(authApi.login(DEMO_USERS[0].email, 'WrongPassword123!')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects login for non-existent user email', async () => {
    await expect(authApi.login('unknown@test.jp', DEMO_PASSWORD)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects login when user account is inactive', async () => {
    const inactiveUser = { ...DEMO_USERS[0], id: 'inact-1', email: 'inactive@test.jp', is_active: false };
    db.staff.push(inactiveUser);
    setMockPassword(inactiveUser.email, DEMO_PASSWORD);

    await expect(authApi.login(inactiveUser.email, DEMO_PASSWORD)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects login when user email is not yet verified', async () => {
    const unverifiedUser = {
      ...DEMO_USERS[0],
      id: 'unver-1',
      email: 'unverified@test.jp',
      email_verified: false,
    };
    db.staff.push(unverifiedUser);
    setMockPassword(unverifiedUser.email, DEMO_PASSWORD);

    await expect(authApi.login(unverifiedUser.email, DEMO_PASSWORD)).rejects.toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('returns current authenticated user profile via getMe', async () => {
    await authApi.login(DEMO_USERS[0].email, DEMO_PASSWORD);

    const me = await authApi.getMe();

    expect(me.data.id).toBe(DEMO_USERS[0].id);
  });

  it('clears session on logout', async () => {
    await authApi.login(DEMO_USERS[0].email, DEMO_PASSWORD);
    expect(getAuthToken()).toBeTruthy();

    await authApi.logout();

    expect(getAuthToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it('rejects victim signup when password is too short', async () => {
    await expect(
      authApi.signup({
        email: 'shortpass@test.jp',
        password: 'short',
        name: 'Short Pass',
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('creates new victim account and dispatches verification mail on signup', async () => {
    const signupData = {
      email: 'newvictim@test.jp',
      password: 'SecurePassword123!',
      name: 'New Victim',
    };

    const res = await authApi.signup(signupData);

    expect(res.success).toBe(true);
    const createdVictim = db.victims.find((v) => v.email === signupData.email);
    expect(createdVictim).toBeDefined();
    expect(createdVictim?.email_verified).toBe(false);
    const mail = outbox.mails.find((m) => m.to === signupData.email && m.kind === 'verify-email');
    expect(mail).toBeDefined();
  });

  it('does not duplicate existing user when signing up with same email', async () => {
    const existing = DEMO_USERS[0];
    const initialStaffCount = db.staff.length;
    const initialVictimCount = db.victims.length;

    await authApi.signup({
      email: existing.email,
      password: 'SecurePassword123!',
      name: 'Duplicate',
    });

    expect(db.staff.length).toBe(initialStaffCount);
    expect(db.victims.length).toBe(initialVictimCount);
  });

  it('verifies victim email with valid token', async () => {
    await authApi.signup({
      email: 'verifytest@test.jp',
      password: 'SecurePassword123!',
      name: 'Verify Test',
    });
    const mail = outbox.mails.find((m) => m.to === 'verifytest@test.jp' && m.kind === 'verify-email');
    expect(mail).toBeDefined();
    if (!mail) throw new Error('Expected verification email to be sent');

    const verifyRes = await authApi.verifyEmail(mail.token);

    expect(verifyRes.success).toBe(true);
    const updated = db.victims.find((v) => v.email === 'verifytest@test.jp');
    expect(updated?.email_verified).toBe(true);
  });

  it('resends verification email for unverified user', async () => {
    await authApi.signup({
      email: 'resend@test.jp',
      password: 'SecurePassword123!',
      name: 'Resend Test',
    });
    outbox.mails = [];

    await authApi.resendVerification('resend@test.jp');

    const sent = outbox.mails.find((m) => m.to === 'resend@test.jp' && m.kind === 'verify-email');
    expect(sent).toBeDefined();
  });

  it('handles resending verification for non-existent or already verified email without error', async () => {
    await expect(authApi.resendVerification('nobody@test.jp')).resolves.toMatchObject({
      success: true,
    });
  });

  it('sends reset password mail for active user in forgotPassword', async () => {
    const operator = DEMO_USERS[0];

    await authApi.forgotPassword(operator.email);

    const mail = outbox.mails.find((m) => m.to === operator.email && m.kind === 'reset-password');
    expect(mail).toBeDefined();
  });

  it('resets password successfully when given a valid token', async () => {
    const operator = DEMO_USERS[0];
    await authApi.forgotPassword(operator.email);
    const mail = outbox.mails.find((m) => m.to === operator.email && m.kind === 'reset-password');
    expect(mail).toBeDefined();
    if (!mail) throw new Error('Expected reset-password email');

    const res = await authApi.resetPassword(mail.token, 'BrandNewPassword123!');

    expect(res.success).toBe(true);
    await expect(authApi.login(operator.email, 'BrandNewPassword123!')).resolves.toMatchObject({
      success: true,
    });
  });

  it('rejects password reset with invalid or already used token', async () => {
    await expect(authApi.resetPassword('invalid-token', 'BrandNewPassword123!')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });

  it('accepts staff invitation and initializes account credentials', async () => {
    await adminApi.createInvitation({
      email: 'newoperator2@test.jp',
      name: 'Operator Two',
      role: 'operator',
    });
    const mail = outbox.mails.find(
      (m) => m.to === 'newoperator2@test.jp' && m.kind === 'accept-invitation'
    );
    expect(mail).toBeDefined();
    if (!mail) throw new Error('Expected accept-invitation email');

    const acceptRes = await authApi.acceptInvitation(mail.token, 'OperatorPassword123!');

    expect(acceptRes.success).toBe(true);
    const createdUser = db.staff.find((u) => u.email === 'newoperator2@test.jp');
    expect(createdUser).toBeDefined();
    expect(createdUser?.role).toBe('operator');

    const loginRes = await authApi.login('newoperator2@test.jp', 'OperatorPassword123!');
    expect(loginRes.success).toBe(true);
  });

  it('rejects accepting an already accepted or revoked invitation', async () => {
    await adminApi.createInvitation({
      email: 'alreadyused@test.jp',
      name: 'Used Test',
      role: 'operator',
    });
    const mail = outbox.mails.find(
      (m) => m.to === 'alreadyused@test.jp' && m.kind === 'accept-invitation'
    );
    expect(mail).toBeDefined();
    if (!mail) throw new Error('Expected accept-invitation email');
    await authApi.acceptInvitation(mail.token, 'ValidPassword123!');

    await expect(authApi.acceptInvitation(mail.token, 'AnotherPassword123!')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });
});
