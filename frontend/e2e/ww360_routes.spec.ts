import { test, expect } from '@playwright/test';

/**
 * Water Systems + Admin routes (WW360 standalone).
 * Credentials: WW360_E2E_USERNAME / WW360_E2E_PASSWORD
 */
test.describe('WW360 routes', () => {
  const api = process.env.WW360_API_URL || 'http://127.0.0.1:8002';
  const username = process.env.WW360_E2E_USERNAME || 'jingrao-aman-OWW';
  const password = process.env.WW360_E2E_PASSWORD;

  test.beforeEach(async ({ page, request }) => {
    test.skip(!password, 'WW360_E2E_PASSWORD not configured');

    const login = await request.post(`${api}/api/v1/auth/login`, {
      data: { username, password },
    });
    expect(login.ok()).toBeTruthy();
    const body = await login.json();
    const token: string = body.access_token;
    expect(token).toBeTruthy();

    await page.addInitScript(
      ({ tok }) => {
        localStorage.setItem('ww360-auth-token', tok);
        localStorage.setItem('ww360-oww-tour-dismissed', '1');
      },
      { tok: token }
    );
  });

  test('landscape page loads', async ({ page }) => {
    await page.goto('/water-systems');
    await expect(page.getByRole('heading', { name: /water system landscape/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('watchlist page loads', async ({ page }) => {
    await page.goto('/water-systems/watchlist');
    await expect(page.getByRole('heading', { name: /member utility watchlist/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('lookup page loads', async ({ page }) => {
    await page.goto('/water-systems/lookup');
    await expect(page.getByRole('heading', { name: /system lookup/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('admin settings page loads', async ({ page }) => {
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/sdwis state landscape/i)).toBeVisible();
  });

  test('admin users page loads', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /users & access/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('continuity workspace loads', async ({ page }) => {
    await page.goto('/continuity');
    await expect(page.getByRole('heading', { name: /workforce continuity/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('ceu training deep link', async ({ page }) => {
    await page.goto('/continuity/ceu-training?tab=ceu');
    await expect(page.getByRole('heading', { name: /ceu & training/i })).toBeVisible({
      timeout: 20_000,
    });
  });
});
