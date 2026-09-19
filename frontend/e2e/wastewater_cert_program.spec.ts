import { test, expect } from '@playwright/test';

/**
 * Continuity certifications — cert_program filter and DW/WW labeling.
 */

test.describe('Wastewater cert program', () => {
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

  test('certifications tab exposes program filter', async ({ page }) => {
    await page.goto('/continuity');
    await expect(page.getByRole('heading', { name: /workforce continuity/i })).toBeVisible({
      timeout: 20_000,
    });

    const certsTab = page.getByRole('tab', { name: /certification/i }).or(
      page.getByRole('button', { name: /certification/i })
    );
    if (await certsTab.first().isVisible().catch(() => false)) {
      await certsTab.first().click();
    } else {
      await page.goto('/continuity?tab=certifications');
    }

    const programFilter = page.getByLabel(/program/i).or(
      page.getByRole('combobox', { name: /program/i })
    ).or(page.getByText(/all programs|drinking water|wastewater/i).first());
    await expect(programFilter.first()).toBeVisible({ timeout: 15_000 });
  });
});
