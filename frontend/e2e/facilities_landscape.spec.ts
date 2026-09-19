import { test, expect } from '@playwright/test';

/**
 * Facilities landscape — Drinking water | Wastewater program toggle.
 * Auth optional: page should still render chrome when unauthenticated redirects to login.
 */

test.describe('Facilities landscape', () => {
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

  test('facilities route shows DW | WW program toggle', async ({ page }) => {
    await page.goto('/facilities');
    await expect(
      page.getByRole('heading', { name: /facilit/i }).or(page.getByText(/drinking water|wastewater/i).first())
    ).toBeVisible({ timeout: 20_000 });

    const dw = page.getByRole('button', { name: /drinking water/i }).or(
      page.getByRole('tab', { name: /drinking water/i })
    );
    const ww = page.getByRole('button', { name: /wastewater/i }).or(
      page.getByRole('tab', { name: /wastewater/i })
    );
    await expect(dw.first()).toBeVisible();
    await expect(ww.first()).toBeVisible();

    await ww.first().click();
    await expect(page).toHaveURL(/program=ww|wastewater/i);
    await expect(
      page.getByText(/npdes|potw|facility name|major/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
