import { test, expect } from '@playwright/test';

test.describe('workforce continuity route', () => {
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
    await page.addInitScript(
      ({ tok }) => {
        localStorage.setItem('ww360-auth-token', tok);
      },
      { tok: body.access_token as string }
    );
  });

  test('continuity route renders', async ({ page }) => {
    await page.goto('/continuity');
    await expect(page.getByRole('heading', { name: /workforce continuity/i })).toBeVisible({
      timeout: 20_000,
    });
  });
});
