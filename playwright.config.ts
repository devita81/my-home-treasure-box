import { defineConfig, devices } from '@playwright/test';

/**
 * E2E test configuration for Playwright.
 *
 * Tests run against the production build (`bun run preview`) instead of the
 * dev server so what we test matches what users get. Playwright auto-starts
 * the preview server via the `webServer` block below.
 *
 * Run locally:  bun run test:e2e          (headless)
 *               bun run test:e2e:ui        (interactive UI mode)
 *               bun run test:e2e:headed    (watch tests in browser)
 *
 * First-time setup:  bunx playwright install chromium
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,

  // Fail CI builds if test.only was committed by accident.
  forbidOnly: !!process.env.CI,

  // Flaky tests get one retry on CI; locally we want failures to surface fast.
  retries: process.env.CI ? 2 : 0,

  // Sequential on CI to keep logs readable; parallel locally for speed.
  workers: process.env.CI ? 1 : undefined,

  // 'list' is concise for CI logs; 'html' opens a viewer locally on failure.
  reporter: process.env.CI ? 'list' : [['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:4173',
    // Capture a trace only when retrying — saves disk + time on green runs.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // 1. Setup project: runs auth.setup.ts once and saves a logged-in
    //    storage state to e2e/.auth/user.json (gitignored).
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // 2. Public smoke tests: don't need auth.
    {
      name: 'chromium-public',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // 3. Authenticated tests: depend on setup, start logged in.
    {
      name: 'chromium-auth',
      testMatch: /authenticated\/.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
    },
  ],

  webServer: {
    command: 'bun run preview',
    url: 'http://localhost:4173',
    // Locally, reuse a manually-started preview if present (fast iteration).
    // On CI, always start fresh to avoid stale state.
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120_000,
  },
});
