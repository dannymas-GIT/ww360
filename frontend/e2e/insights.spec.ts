import { test, expect } from '@playwright/test';

/**
 * Insights — persona tabs + graceful empty/error.
 * Auth optional skip when WW360_E2E_PASSWORD is unset.
 */

test.describe('Insights', () => {
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

  test('insights page shows persona tabs', async ({ page }) => {
    await page.goto('/insights');
    await expect(
      page.getByRole('heading', { name: /correlation|insights|workforce/i }).or(
        page.getByText(/jenny|regulator|utility/i).first()
      )
    ).toBeVisible({ timeout: 20_000 });

    const jenny = page.getByRole('tab', { name: /jenny/i }).or(
      page.getByRole('button', { name: /jenny/i })
    );
    const regulator = page.getByRole('tab', { name: /regulator/i }).or(
      page.getByRole('button', { name: /regulator/i })
    );
    const utility = page.getByRole('tab', { name: /utility/i }).or(
      page.getByRole('button', { name: /utility/i })
    );

    await expect(jenny.first()).toBeVisible();
    await expect(regulator.first()).toBeVisible();
    await expect(utility.first()).toBeVisible();

    await regulator.first().click();
    await expect(
      page.getByText(/correlation|stub|unavailable|no correlation|regulator/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
