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

  test('main navigation is rendered', async ({ page }) => {
    await page.goto('/');

    // O <Sidebar /> renderiza um <aside> que é a nav principal nas
    // rotas autenticadas. No desktop fica fixo à esquerda; no mobile
    // vira drawer (translate-x-full por padrão), mas o elemento ainda
    // existe no DOM. Antes era <header> mas isso virou só topbar
    // mobile (lg:hidden) — não estava visível em desktop CI.
    //
    // Verificamos o aside existir na DOM (é a landmark principal de
    // navegação) sem exigir visibilidade — pois no mobile ele entra
    // off-canvas.
    await expect(page.locator('aside').first()).toBeAttached();

    // Sanity check: links principais da nav existem.
    await expect(page.getByRole('link', { name: /carteira/i })).toBeAttached();
    await expect(page.getByRole('link', { name: /balancete/i })).toBeAttached();
    await expect(page.getByRole('link', { name: /analytics/i })).toBeAttached();
  });
});
