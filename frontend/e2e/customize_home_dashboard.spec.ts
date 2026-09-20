import { test, expect } from '@playwright/test';

/**
 * AquaSafe-style customize home on simplified dashboard (Kitchen Sink off).
 * Credentials: WW360_E2E_USERNAME / WW360_E2E_PASSWORD (default seed user).
 */
test.describe('Customize home dashboard', () => {
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
    const uid = body.user.id as number;
    expect(token).toBeTruthy();

    await page.addInitScript(
      ({ tok, userId }) => {
        localStorage.setItem('ww360-auth-token', tok);
        // Kitchen Sink off → simplified customizable home
        localStorage.removeItem(`ww360_kitchen_sink:${userId}`);
        localStorage.setItem(`ww360-customize-home-dismissed`, '1');
        localStorage.setItem(`ww360-workspace-tour-dismissed:u${userId}`, '1');
      },
      { tok: token, userId: uid }
    );
  });

  test('enters edit mode and adds a row', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-tour="simplified-dashboard"]')).toBeVisible({
      timeout: 20_000,
    });
    await page.locator('[data-tour="enter-edit-mode"]').click();
    await expect(page.locator('[data-tour="add-row"]')).toBeVisible();
    const before = await page.locator('[data-tour="dashboard-row"]').count();
    await page.locator('[data-tour="add-row"]').click();
    await expect(page.locator('[data-tour="dashboard-row"]')).toHaveCount(before + 1);
  });

  test('adds chart to row and saves layout', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-tour="simplified-dashboard"]')).toBeVisible({
      timeout: 20_000,
    });
    await page.locator('[data-tour="enter-edit-mode"]').click();
    await page.locator('[data-tour="add-row"]').click();
    const rows = page.locator('[data-tour="dashboard-row"]');
    const lastRow = rows.last();
    const addChart = lastRow.locator('[data-tour="add-chart-to-row"]');
    if (await addChart.isEnabled()) {
      await addChart.click();
    }
    await page.locator('[data-tour="save-dashboard-layout"]').click();
    await expect(page.getByText(/Saved\. Your home will use this layout/i)).toBeVisible({
      timeout: 15_000,
    });
    await page.reload();
    await expect(page.locator('[data-tour="simplified-dashboard"]')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('[data-tour="dashboard-row"]').first()).toBeVisible();
  });

  test('opens widget picker from Add Widget', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-tour="simplified-dashboard"]')).toBeVisible({
      timeout: 20_000,
    });
    await page.locator('[data-tour="enter-edit-mode"]').click();
    const addWidget = page.locator('[data-tour="add-widget-to-row"]').first();
    if ((await addWidget.count()) === 0) {
      await page.locator('[data-tour="add-row"]').click();
    }
    await page.locator('[data-tour="add-widget-to-row"]').first().click();
    await expect(page.locator('[data-tour="widget-picker-dialog"]')).toBeVisible();
    await expect(page.getByText(/Add panel to row/i)).toBeVisible();
  });
});
