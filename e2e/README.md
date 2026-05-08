# E2E tests (Playwright)

End-to-end smoke + authenticated tests running against the production build.

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

Authenticated specs need `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` set in
your local `.env` (gitignored). Without them, the auth setup step fails
and authenticated specs are skipped — public smoke specs still run.

The first run takes ~30s extra because `bun run preview` builds the app
and starts a server. Subsequent runs reuse the running server.

## Test layout

```
e2e/
├── auth.setup.ts                    # logs in once, saves storage state
├── smoke.spec.ts                    # public routes (no auth needed)
└── authenticated/
    ├── home.spec.ts                 # home renders post-login
    └── balancete.spec.ts            # balancete mounts without errors
```

`playwright.config.ts` defines three projects:

1. `setup` — runs `auth.setup.ts` once
2. `chromium-public` — smoke tests, no auth
3. `chromium-auth` — depends on setup, loads with auth state

## What's tested today

**Public smoke (4):**
- Root redirects to `/auth`
- Auth page has email/password fields + submit button
- Protected routes redirect to `/auth`
- Unknown routes show 404

**Authenticated (3):**
- Home renders "Meus Imóveis" section
- Header is present
- Balancete page mounts without console errors

## Test user setup

The test user (`e2e@dvhome.com`) was created via the Supabase signup API
and admin-confirmed via Lovable's chat. Credentials are stored in:

- **Locally:** `.env` (gitignored)
- **CI:** GitHub Actions secrets (`E2E_USER_EMAIL`, `E2E_USER_PASSWORD`)

To rotate the password, update both places.

## Adding new authenticated tests

Drop them in `e2e/authenticated/`. They auto-pick up the logged-in
storage state — just write tests as if you're already logged in.

```ts
import { test, expect } from '@playwright/test';

test('my new test', async ({ page }) => {
  await page.goto('/some-route');  // already authenticated
  // ...
});
```

## Suggested next tests

In priority order:

1. **Create + edit + delete property** — full CRUD smoke (use `E2E_TEST_${Date.now()}` markers in fields and clean up at the end)
2. **PropertyDetails renders** — visit a known property and check tabs/data load
3. **Filters work** — apply a filter, verify list updates
4. **PDF generation** — click Generate Report, verify download

Each new test compounds protection for refactoring. Once Balancete has
deeper coverage, refactoring its 2750 lines becomes safe.

## CI integration

Tests run on every push/PR to `main` after the regular build step. See
`.github/workflows/ci.yml`. On failure, Playwright's HTML report is
uploaded as an artifact and is downloadable from the failed run.

For PRs from forks, secrets are unavailable — only public smoke tests
run; authenticated specs throw at setup. Currently the project has only
the owner contributing, so this is fine.
