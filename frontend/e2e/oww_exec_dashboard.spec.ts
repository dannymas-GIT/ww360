import { test, expect } from '@playwright/test';

/**
 * OWW executive dashboard at /dashboard (WW360 standalone).
 * Credentials: WW360_E2E_USERNAME / WW360_E2E_PASSWORD (default seed user).
 */
test.describe('OWW executive dashboard', () => {
  const api = process.env.WW360_API_URL || 'http://127.0.0.1:8002';
  const username = process.env.WW360_E2E_USERNAME || 'jenny-oww';
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
      ({ tok, uid }) => {
        localStorage.setItem('ww360-auth-token', tok);
        localStorage.setItem(`ww360-oww-tour-dismissed:u${uid}`, '1');
      },
      { tok: token, uid: body.user.id as number }
    );
  });

  test('partner lands on executive dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    await expect(page.locator('[data-tour="kpis"]')).toBeVisible();
  });

  test('renders SDWIS landscape section', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-tour="sdwis-landscape"]')).toBeVisible();
    await expect(page.locator('[data-tour="sdwis-landscape"]')).toContainText(
      /water system landscape/i
    );
  });

  test('shows digital reach teaser with link', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-tour="digital-teaser"]')).toBeVisible();
    await expect(page.getByRole('link', { name: /Open Digital reach/i })).toBeVisible();
  });
});
