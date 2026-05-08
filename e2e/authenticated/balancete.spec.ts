import { test, expect } from '@playwright/test';

/**
 * Smoke test for the Balancete page — the most complex page in the app
 * (~2750 lines). The point isn't to test internal logic yet, just to
 * catch the case where the page fails to mount entirely (which would
 * be regression of e.g. a missing import or broken supabase query).
 *
 * When we eventually refactor Balancete, this test is the safety net.
 */
test.describe('Authenticated — balancete', () => {
  test('balancete page mounts without errors', async ({ page }) => {
    // Track any uncaught console errors during the page load.
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/balancete');

    // We're authenticated, so no redirect to /auth.
    await expect(page).toHaveURL(/\/balancete$/);

    // Wait briefly for the page to settle (data fetches, etc.)
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // The page renders ANY balancete-related content. We don't assert
    // specifics because the test user has no balancete data — the
    // empty/loaded state is what we're verifying.
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // No fatal console errors during mount. Filter known noise (React
    // warnings, third-party network errors that don't break the page).
    const fatalErrors = consoleErrors.filter((err) =>
      // Allow React Router future-flag warnings and network blips
      !/React Router|net::ERR|Failed to fetch|aborted/i.test(err),
    );
    expect(fatalErrors, `Console errors: ${fatalErrors.join('\n')}`).toHaveLength(0);
  });
});
