# E2E tests (Playwright)

End-to-end smoke tests that run against the production build of the app.

## Running locally

First time only — install the chromium browser:

```sh
bunx playwright install chromium
```

Then any of:

```sh
bun run test:e2e          # headless, terminal output
bun run test:e2e:ui       # interactive UI mode (recommended for debugging)
bun run test:e2e:headed   # watch tests run in a real browser window
```

The first run takes ~30s extra because `bun run preview` builds the app and
starts a server. Subsequent runs reuse the running server.

## What's tested today

`smoke.spec.ts` — public-route checks that don't need a logged-in user:

- Root path redirects to `/auth`
- Auth page renders with email/password fields
- Auth submit button shows loading state when clicked
- Protected routes (e.g., `/balancete`) redirect to `/auth`
- Unknown routes show the 404 page

These are enough to catch most "the app didn't even build" regressions.

## What's NOT tested yet

Authenticated flows — creating/editing/deleting properties, importing
balancete CSV, generating reports. These need a Supabase test user with a
known password, and a way to seed/cleanup data between runs.

To add them, the rough plan is:

1. Create a dedicated Supabase user (e.g., `e2e@dvhome.com`) with a known
   password, ideally with RLS scoped to its own data.
2. Add `playwright/auth-setup.ts` that logs in and saves the auth state to
   `e2e/.auth/user.json` (gitignored).
3. Use that storage state in tests via `test.use({ storageState: ... })`.
4. Add a teardown hook to clean up created records after each spec.

Suggested first authenticated tests, in priority order:

- Create a property (smoke of the most common write path)
- Edit a property
- Delete a property (irreversible — needs the loading-state guard we just added)
- Open `/balancete` and verify it renders without errors

## CI integration

Tests run on every push/PR to `main` after the regular build step. See
`.github/workflows/ci.yml`. On failure, Playwright's HTML report is
uploaded as an artifact and is downloadable from the failed run.
