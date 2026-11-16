import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/useAuthStore';
import { clearSession, triggerUnauthorized } from '@/services/http';
import { DEMO_PASSWORD } from '@/services/mockData';

describe('useAuthStore with mock data layer', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSession();
    useAuthStore.setState({
      user: null,
      token: null,
      isLoading: false,
      error: null,
      errorCode: null,
    });
  });

  it('authenticates valid operator credentials and populates session state', async () => {
    const user = await useAuthStore.getState().login('operator1@opscenter.test', DEMO_PASSWORD);

    const state = useAuthStore.getState();
    expect(user.email).toBe('operator1@opscenter.test');
    expect(state.user).toEqual(user);
    expect(state.token).toBeTruthy();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('sets error and errorCode on invalid credentials', async () => {
    await expect(
      useAuthStore.getState().login('operator1@opscenter.test', 'WrongPassword123')
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.errorCode).toBe('INVALID_CREDENTIALS');
    expect(state.error).toBeTruthy();
  });

  it('clears session upon logout', async () => {
    await useAuthStore.getState().login('operator1@opscenter.test', DEMO_PASSWORD);
    expect(useAuthStore.getState().user).not.toBeNull();

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  it('clears session when expire is invoked directly', async () => {
    await useAuthStore.getState().login('operator1@opscenter.test', DEMO_PASSWORD);

    useAuthStore.getState().expire();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  it('clears store session when triggerUnauthorized fires', async () => {
    await useAuthStore.getState().login('operator1@opscenter.test', DEMO_PASSWORD);

    triggerUnauthorized();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });
});
