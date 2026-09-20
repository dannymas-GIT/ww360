import { test, expect } from '@playwright/test';

/**
 * Grants Studio — catalog + EPA program detail.
 * Auth optional skip when WW360_E2E_PASSWORD is unset.
 */

test.describe('Grants Studio', () => {
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
    await page.addInitScript(
      ({ tok }) => {
        localStorage.setItem('ww360-auth-token', tok);
      },
      { tok: body.access_token as string }
    );
  });

  test('grants catalog lists programs and opens EPA detail', async ({ page }) => {
    await page.goto('/grants');
    await expect(
      page.getByRole('heading', { name: /grants studio/i }).or(page.getByText(/funding catalog|programs/i).first())
    ).toBeVisible({ timeout: 20_000 });

    await expect(page.getByText(/epa|iwiwd|innovative water/i).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.goto('/grants/epa-iwiwd-2026');
    await expect(
      page.getByRole('heading', { name: /innovative water|epa/i }).or(
        page.getByText(/eligibility|nofo|readiness/i).first()
      )
    ).toBeVisible({ timeout: 20_000 });
  });
});
