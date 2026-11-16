import type { Page } from '@playwright/test';

export type DemoRole = 'operator' | 'supervisor' | 'victim';

const DEMO_CREDENTIALS: Record<DemoRole, { email: string; password: string; expectedPath: string }> = {
  operator: {
    email: 'operator1@opscenter.test',
    password: 'Demo@1234',
    expectedPath: '/cases',
  },
  supervisor: {
    email: 'supervisor@opscenter.test',
    password: 'Demo@1234',
    expectedPath: '/dashboard',
  },
  victim: {
    email: 'victim1@mail.test',
    password: 'Demo@1234',
    expectedPath: '/portal',
  },
};

/** Log in through the UI using demo credentials. */
export async function loginAs(page: Page, role: DemoRole): Promise<void> {
  const creds = DEMO_CREDENTIALS[role];
  await page.goto('/login');
  await page.locator('#login-email').fill(creds.email);
  await page.locator('#login-password').fill(creds.password);
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL(new RegExp(creds.expectedPath));
}
