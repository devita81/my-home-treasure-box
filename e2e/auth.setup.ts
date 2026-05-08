import { test as setup, expect } from '@playwright/test';

/**
 * Auth setup — runs once before authenticated specs and saves the logged-in
 * Supabase session to disk. Subsequent tests load this state via
 * `test.use({ storageState })` so they start already authenticated, no
 * per-test login overhead.
 *
 * The credentials come from env vars (E2E_USER_EMAIL / E2E_USER_PASSWORD)
 * which are gitignored locally and provided as GitHub Actions secrets in CI.
 */

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_USER_EMAIL and E2E_USER_PASSWORD must be set. Locally: copy .env.example to .env and fill values. In CI: add as repository secrets.',
    );
  }

  await page.goto('/auth');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: /entrar/i }).click();

  // After successful login the AuthContext redirects to /. Wait for that.
  await page.waitForURL((url) => url.pathname === '/', { timeout: 10_000 });

  // Sanity check: protected content is visible.
  await expect(page.getByRole('heading', { name: /meus imóveis/i })).toBeVisible();

  // Persist cookies + localStorage (where Supabase keeps the JWT).
  await page.context().storageState({ path: authFile });
});
