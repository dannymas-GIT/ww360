import { test, expect } from '@playwright/test';

/**
 * Digital reach page at /analytics (GA4 + SEO property tabs).
 */
test.describe('Digital reach analytics', () => {
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
      ({ tok }) => {
        localStorage.setItem('ww360-auth-token', tok);
      },
      { tok: token }
    );
  });

  test('loads digital reach page with property tabs', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page).toHaveURL(/\/analytics/, { timeout: 20_000 });
    await expect(page.locator('[data-tour="digital-tabs"]')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Water Workforce 360/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /onewaterworkforce\.org/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Learning Stream/i })).toBeVisible();
  });

  test('switches tabs and renders query tables', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page.locator('[data-tour="digital-queries"]')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('tab', { name: /onewaterworkforce\.org/i }).click();
    await expect(page.locator('[data-tour="digital-queries"]')).toContainText(/water operator/i);

    await page.getByRole('tab', { name: /Learning Stream/i }).click();
    await expect(page.locator('[data-tour="digital-queries"]')).toContainText(/Grade D|CEU/i);
  });
});
