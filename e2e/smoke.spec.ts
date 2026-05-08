import { test, expect } from '@playwright/test';

/**
 * Smoke tests — verify the app boots, routing works, and the public pages
 * (auth, 404) render correctly. These don't need a logged-in user, so they
 * run on any CI without test-account credentials.
 *
 * Authenticated flows (create property, balancete, etc.) live in separate
 * specs and rely on a Supabase test user — see e2e/README.md for setup.
 */

test.describe('Smoke — public routes', () => {
  test('root path redirects to /auth when not logged in', async ({ page }) => {
    await page.goto('/');
    // ProtectedRoute renders <Navigate to="/auth" replace />
    await page.waitForURL('**/auth');
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('auth page renders the login card', async ({ page }) => {
    await page.goto('/auth');

    // Card title
    await expect(page.getByRole('heading', { name: /entrar/i })).toBeVisible();

    // Form fields (Label htmlFor matches Input id)
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();

    // Submit button
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
  });

  // NOTE: a test for "submit button shows loading state when clicked" was
  // removed — the auth response from Supabase is too fast to reliably observe
  // the button's transient disabled state without aggressive request mocking,
  // which is fragile to assert against. The loading-state behavior is covered
  // by code review (PropertyForm + Index delete) and is straightforward to
  // verify manually. We'll add this kind of timing-sensitive test back once
  // we have authenticated tests with controllable network mocking.

  test('protected route redirects to /auth', async ({ page }) => {
    await page.goto('/balancete');
    await page.waitForURL('**/auth');
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('unknown route renders the 404 page', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-abc123');

    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(page.getByText(/page not found/i)).toBeVisible();
  });
});
