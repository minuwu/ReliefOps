import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Victim Portal Journeys', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'victim');
  });

  test('views victim claims and opens case progress tracker', async ({ page }) => {
    await page.goto('/portal');

    // Header checks
    await expect(page.getByText(/victim portal/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /hello, rina example/i })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: /report a scam/i })).toBeVisible();

    // Verify claim card with 6-stage statutory tracker
    const caseCard = page.locator('li').filter({ hasText: 'RFR-2026-00042' });
    await expect(caseCard).toBeVisible();
    await expect(caseCard.getByText(/step 2 of 6/i)).toBeVisible();

    // Click Open Case
    await caseCard.getByRole('link', { name: /open case/i }).click();

    // Navigates to citizen case detail view
    await expect(page).toHaveURL(/\/portal\/cases\/c0000000-0000-4000-8000-000000000042/);
    await expect(page.getByText('RFR-2026-00042').first()).toBeVisible();
    await expect(page.getByText(/birch regional bank/i).first()).toBeVisible();

    // Verify 6-stage statutory tracker is rendered
    await expect(page.getByRole('list', { name: /claim progress/i })).toBeVisible();
    await expect(page.getByText(/verified/i).first()).toBeVisible();
    await expect(page.getByText(/staff checked your report/i)).toBeVisible();
  });
});
