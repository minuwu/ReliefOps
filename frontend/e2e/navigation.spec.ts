import { test, expect } from '@playwright/test';

test.describe('Navigation, Data Mode & 404 Journeys', () => {
  test('inspects and interacts with the data mode switcher', async ({ page }) => {
    await page.goto('/login');

    // Locate the data mode switch in the footer
    const demoBtn = page.getByRole('button', { name: /^demo$/i });
    const liveBtn = page.getByRole('button', { name: /^live$/i });

    await expect(demoBtn).toBeVisible();
    await expect(liveBtn).toBeVisible();

    // Default mock mode has Demo active
    await expect(demoBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(liveBtn).toHaveAttribute('aria-pressed', 'false');

    // Clicking Live opens the connection configuration modal
    await liveBtn.click();

    const liveModal = page.getByRole('dialog');
    await expect(liveModal).toBeVisible();
    await expect(liveModal.getByRole('heading', { name: /use live data/i })).toBeVisible();
    await expect(liveModal.locator('#live-api-url')).toBeVisible();

    // Close the live connection modal
    await liveModal.getByRole('button', { name: /close dialog/i }).click();
    await expect(liveModal).not.toBeVisible();
  });

  test('displays 404 page for unknown routes and navigates home', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');

    // 404 header and explanation
    await expect(page.getByRole('heading', { level: 1, name: /page not found/i })).toBeVisible();
    await expect(page.getByText(/this address does not exist/i)).toBeVisible();

    // Recovery action button
    const homeLink = page.getByRole('link', { name: /go to my home page/i });
    await expect(homeLink).toBeVisible();
    await homeLink.click();

    // Since unauthenticated, returns to /login
    await expect(page).toHaveURL(/\/login/);
  });
});
