import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Document Evidence & AI Review Queue Journeys', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'operator');
  });

  test('uploads an evidence document on a case', async ({ page }) => {
    await page.goto('/cases');

    const caseRow = page.getByRole('button', { name: /RFR-2026-00042/i });
    await expect(caseRow).toBeVisible();
    await caseRow.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Navigate to Documents tab
    await dialog.getByRole('tab', { name: /documents/i }).click();

    // Locate file input and attach mock file
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();

    await fileInput.setInputFiles({
      name: 'atm_voucher_slip.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake image content for test'),
    });

    // Submit upload form (button text is "Upload document")
    const uploadBtn = page.getByRole('button', { name: /upload document/i });
    await expect(uploadBtn).toBeEnabled();
    await uploadBtn.click();

    // Verify document was uploaded
    await expect(page.getByText(/uploaded atm_voucher_slip\.png/i)).toBeVisible();
    await expect(page.getByText(/atm_voucher_slip\.png/i)).toBeVisible();
  });

  test('navigates to review queue and accepts an AI extraction', async ({ page }) => {
    await page.goto('/review');

    await expect(page.getByRole('heading', { level: 1, name: /review queue/i })).toBeVisible();

    // Find and click the first review action button
    const reviewBtn = page.getByRole('button', { name: /^review$/i }).first();
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    // Verify extraction review modal opens
    const reviewModal = page.getByRole('dialog');
    await expect(reviewModal).toBeVisible();
    await expect(reviewModal.getByRole('heading', { name: /review extraction/i })).toBeVisible();

    // Rule D3 Human-In-The-Loop certification: Accept extraction
    const acceptBtn = reviewModal.getByRole('button', { name: /accept & update record/i });
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // Modal closes after review acceptance
    await expect(reviewModal).not.toBeVisible();
  });
});
