import { test, expect } from '@playwright/test';

/**
 * Verifies the authenticated home renders the property list shell.
 * Doesn't assert specific properties (the test user starts empty),
 * just that the page structure loads correctly post-login.
 */
test.describe('Authenticated — home', () => {
  test('home renders Meus Imóveis section after login', async ({ page }) => {
    await page.goto('/');

    // Should NOT redirect to /auth — we're authenticated via storageState.
    await expect(page).toHaveURL(/\/$/);

    // Main heading from Index.tsx
    await expect(page.getByRole('heading', { name: /meus imóveis/i })).toBeVisible();

    // 'Adicionar Imóvel' CTA should be present (either in the toolbar or empty state).
    // Use .first() because there can be multiple Add buttons on the page.
    await expect(page.getByRole('link', { name: /adicionar/i }).first()).toBeVisible();
  });

  test('header navigation is rendered', async ({ page }) => {
    await page.goto('/');

    // The Header component on protected routes — just verify *something*
    // header-like is on the page. Specific links can break easily, so we
    // just check the topbar landmark exists.
    await expect(page.locator('header').first()).toBeVisible();
  });
});
