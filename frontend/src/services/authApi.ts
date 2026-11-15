/**
 * Accounts and sessions (API_SPEC §6.1, contract v0.4.2).
 * Staff and victims log in through the same endpoint; user.role tells them apart.
 */
import type { ApiResponse, AuthSession, Language, User } from '@/types/api';
import {
  USE_MOCK,
  apiError,
  clearSession,
  mockEnvelope,
  mockFailure,
  request,
  storeSession,
} from './http';
import { allAccounts, consumeMockToken, currentUser, db, sendMockMail } from './mockStore';

const SESSION_HOURS = 8;
const MIN_PASSWORD = 10;
const MAX_PASSWORD = 128;

const SAME_ANSWER = 'If the address can receive mail, a message is on its way.';

export interface SignupBody {
  email: string;
  password: string;
  name: string;
  preferred_language?: Language;
}

function post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function checkPassword(password: string, field: string): void {
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    throw apiError('VALIDATION_ERROR', 'Please fix the highlighted fields.', {
      fields: [{ field, message: `Use ${MIN_PASSWORD} to ${MAX_PASSWORD} characters.` }],
    });
  }
}

function findAccount(email: string): User | undefined {
  return allAccounts().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
}

function replaceAccount(next: User): void {
  db.staff = db.staff.map((u) => (u.id === next.id ? next : u));
  db.victims = db.victims.map((u) => (u.id === next.id ? next : u));
}

/* --- Mock implementations ------------------------------------------------- */

const mock = {
  login(email: string): Promise<ApiResponse<AuthSession>> {
    const user = findAccount(email);
    if (!user || !user.is_active) {
      return mockFailure(apiError('INVALID_CREDENTIALS', 'Email or password is wrong.'));
    }
    if (!user.email_verified) {
      return mockFailure(apiError('EMAIL_NOT_VERIFIED', 'Verify your email before logging in.'));
    }
    const session: AuthSession = {
      token: `demo_session_${user.id}`,
      expires_at: new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString(),
      user,
    };
    return mockEnvelope(session, 'Logged in');
  },

  signup(body: SignupBody): Promise<ApiResponse<null>> {
    checkPassword(body.password, 'password');
    if (!findAccount(body.email)) {
      const victim: User = {
        id: crypto.randomUUID(),
        name: body.name,
        email: body.email.trim(),
        role: 'victim',
        bank_id: null,
        email_verified: false,
        is_active: true,
      };
      db.victims = [...db.victims, victim];
      db.victimCases = { ...db.victimCases, [victim.email]: [] };
      sendMockMail(victim.email, 'verify-email', victim.email);
    }
    return mockEnvelope(null, SAME_ANSWER);
  },

  verifyEmail(token: string): Promise<ApiResponse<null>> {
    const mail = consumeMockToken('verify-email', token);
    const user = findAccount(mail.subject);
    if (user) replaceAccount({ ...user, email_verified: true });
    return mockEnvelope(null, 'Email verified. You can log in now.');
  },

  resendVerification(email: string): Promise<ApiResponse<null>> {
    const user = findAccount(email);
    if (user && !user.email_verified) sendMockMail(user.email, 'verify-email', user.email);
    return mockEnvelope(null, SAME_ANSWER);
  },

  forgotPassword(email: string): Promise<ApiResponse<null>> {
    const user = findAccount(email);
    if (user?.is_active) sendMockMail(user.email, 'reset-password', user.email);
    return mockEnvelope(null, SAME_ANSWER);
  },

  resetPassword(token: string, newPassword: string): Promise<ApiResponse<null>> {
    checkPassword(newPassword, 'new_password');
    consumeMockToken('reset-password', token);
    return mockEnvelope(null, 'Password changed. Log in with your new password.');
  },

  acceptInvitation(token: string, password: string): Promise<ApiResponse<null>> {
    checkPassword(password, 'password');
    const mail = consumeMockToken('accept-invitation', token);
    const invite = db.invitations.find((i) => i.id === mail.subject);
    if (!invite || invite.status !== 'pending') {
      throw apiError('INVALID_TOKEN', 'This invitation is no longer valid.');
    }
    db.invitations = db.invitations.map((i) =>
      i.id === invite.id ? { ...i, status: 'accepted' } : i
    );
    db.staff = [
      ...db.staff,
      {
        id: crypto.randomUUID(),
        name: invite.name,
        email: invite.email,
        role: invite.role,
        bank_id: invite.bank_id,
        email_verified: true,
        is_active: true,
      },
    ];
    return mockEnvelope(null, 'Account created. You can log in now.');
  },
};

/** Runs a synchronous mock that may throw, as a rejected promise (like the network would). */
function attempt<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return fn();
  } catch (error) {
    return Promise.reject(error);
  }
}

/* --- Public API ----------------------------------------------------------- */

export const authApi = {
  async login(email: string, password: string): Promise<ApiResponse<AuthSession>> {
    const res = USE_MOCK
      ? await mock.login(email)
      : await post<AuthSession>('/api/auth/login', { email, password });
    storeSession(res.data.token, res.data.user);
    return res;
  },

  getMe(): Promise<ApiResponse<User>> {
    return USE_MOCK ? mockEnvelope(currentUser()) : request<User>('/api/auth/me');
  },

  /** Ends the server session, then always clears the local one. */
  async logout(): Promise<void> {
    try {
      if (!USE_MOCK) await post<null>('/api/auth/logout');
    } finally {
      clearSession();
    }
  },

  signup(body: SignupBody): Promise<ApiResponse<null>> {
    return USE_MOCK ? attempt(() => mock.signup(body)) : post<null>('/api/auth/signup', body);
  },

  verifyEmail(token: string): Promise<ApiResponse<null>> {
    return USE_MOCK
      ? attempt(() => mock.verifyEmail(token))
      : post<null>('/api/auth/verify-email', { token });
  },

  resendVerification(email: string): Promise<ApiResponse<null>> {
    return USE_MOCK
      ? mock.resendVerification(email)
      : post<null>('/api/auth/resend-verification', { email });
  },

  forgotPassword(email: string): Promise<ApiResponse<null>> {
    return USE_MOCK
      ? mock.forgotPassword(email)
      : post<null>('/api/auth/forgot-password', { email });
  },

  resetPassword(token: string, newPassword: string): Promise<ApiResponse<null>> {
    return USE_MOCK
      ? attempt(() => mock.resetPassword(token, newPassword))
      : post<null>('/api/auth/reset-password', { token, new_password: newPassword });
  },

  acceptInvitation(token: string, password: string): Promise<ApiResponse<null>> {
    return USE_MOCK
      ? attempt(() => mock.acceptInvitation(token, password))
      : post<null>('/api/auth/accept-invitation', { token, password });
  },
};
