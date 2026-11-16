import { test, expect } from '@playwright/test';

test.describe('Authentication Journeys', () => {
  test('logs in as demo operator and logs out successfully', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /log in to reliefops/i })).toBeVisible();

    await page.locator('#login-email').fill('operator1@opscenter.test');
    await page.locator('#login-password').fill('Demo@1234');
    await page.getByRole('button', { name: /log in/i }).click();

    // Operators are redirected to /cases
    await expect(page).toHaveURL(/\/cases/);
    await expect(page.getByRole('heading', { level: 1, name: /^cases$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /account menu for operator one/i })).toBeVisible();

    // Open user dropdown menu and log out
    await page.getByRole('button', { name: /account menu for operator one/i }).click();
    await page.getByRole('menuitem', { name: /log out/i }).click();

    // Back to login page
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /log in to reliefops/i })).toBeVisible();
  });

  test('logs in as demo supervisor and verifies dashboard access', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#login-email').fill('supervisor@opscenter.test');
    await page.locator('#login-password').fill('Demo@1234');
    await page.getByRole('button', { name: /log in/i }).click();

    // Supervisors are redirected to /dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { level: 1, name: /^dashboard$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /account menu for supervisor sato/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /review queue/i })).toBeVisible();
  });
});
