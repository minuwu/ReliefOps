import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Case Workstation & Detail Journeys', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'operator');
  });

  test('loads case list and opens case detail modal', async ({ page }) => {
    await page.goto('/cases');

    await expect(page.getByRole('heading', { level: 1, name: /^cases$/i })).toBeVisible();

    // The case table should display the seeded case
    const caseRow = page.getByRole('button', { name: /RFR-2026-00042/i });
    await expect(caseRow).toBeVisible();

    // Click to open detail modal
    await caseRow.click();

    // Verify detail modal opened and URL updated
    await expect(page).toHaveURL(/\/cases\/c0000000-0000-4000-8000-000000000042/);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('RFR-2026-00042').first()).toBeVisible();
    await expect(dialog.getByText('Rina Example').first()).toBeVisible();

    // Verify statutory tabs
    await expect(dialog.getByRole('tab', { name: /^overview$/i })).toBeVisible();
    await expect(dialog.getByRole('tab', { name: /documents/i })).toBeVisible();
    await expect(dialog.getByRole('tab', { name: /messages/i })).toBeVisible();
    await expect(dialog.getByRole('tab', { name: /history/i })).toBeVisible();

    // Close the dialog using Close dialog button
    await dialog.getByRole('button', { name: /close dialog/i }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/cases$/);
  });

  test('advances a case through a status transition', async ({ page }) => {
    await page.goto('/cases');

    const caseRow = page.getByRole('button', { name: /RFR-2026-00042/i });
    await expect(caseRow).toBeVisible();
    await caseRow.click();

    const detailDialog = page.getByRole('dialog');
    await expect(detailDialog).toBeVisible();

    // Under Overview tab, click the transition action button
    const transitionBtn = detailDialog.getByRole('button', { name: /move to account check/i });
    await expect(transitionBtn).toBeVisible();
    await transitionBtn.click();

    // Confirmation modal should appear
    await expect(page.getByText(/confirm milestone: account check/i)).toBeVisible();

    // Enter audit note
    const noteInput = page.locator('#transition-note');
    if (await noteInput.isVisible()) {
      await noteInput.fill('Verified transfer receipt and requested receiving bank freeze.');
    }

    // Confirm transition
    await page.getByRole('button', { name: /confirm transition/i }).click();

    // Verify toast or updated status badge reflects "account check"
    await expect(page.getByText(/account check/i).first()).toBeVisible();
  });

  test('opens a case row using keyboard-only Enter key', async ({ page }) => {
    await page.goto('/cases');

    // Wait for the case table to load
    const firstRow = page.locator('tbody tr[role="button"]').first();
    await expect(firstRow).toBeVisible();
    const reference = await firstRow.locator('td').first().innerText();
    const cleanRef = reference.replace('▶', '').trim();

    // Focus first row and press Enter
    await firstRow.focus();
    await page.keyboard.press('Enter');

    // Verify detail modal opens
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(cleanRef).first()).toBeVisible();
  });
});
