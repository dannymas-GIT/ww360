import { test, expect } from '@playwright/test';

/**
 * One Water Workforce executive workspace (/dashboard/oww).
 *
 * Requires a seeded partner account (see backend/scripts/db/seed_oww_partner_exec.py):
 *   AQUASAFE_OWW_E2E_USERNAME / AQUASAFE_OWW_E2E_PASSWORD
 * Skips when not configured so shared CI stays green.
 */
test.describe('OWW executive dashboard', () => {
  const api = process.env.AQUASAFE_API_URL || 'http://127.0.0.1:8002';
  const username = process.env.AQUASAFE_OWW_E2E_USERNAME;
  const password = process.env.AQUASAFE_OWW_E2E_PASSWORD;

  test.beforeEach(async ({ page, request }) => {
    test.skip(!username || !password, 'OWW partner E2E credentials not configured');

    const login = await request.post(`${api}/api/v1/tenant/auth/login`, {
      data: { username, password },
    });
    expect(login.ok()).toBeTruthy();
    const body = await login.json();
    const token: string = body.access_token || body.token;
    expect(token).toBeTruthy();

    await page.addInitScript(
      ({ tok }) => {
        localStorage.setItem('auth_token', tok);
        localStorage.setItem('auth_token_type', 'Bearer');
        localStorage.setItem('ww360-oww-tour-dismissed', '1');
      },
      { tok: token }
    );
  });

  test('partner lands on the OWW workspace from /dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard\/oww/, { timeout: 20_000 });
  });

  test('renders sources, KPIs, charts, regions, EPA measures and access panel', async ({
    page,
  }) => {
    await page.goto('/dashboard/oww');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /statewide water workforce/i
    );

    await expect(page.locator('[data-tour="sources"]')).toBeVisible();
    await expect(page.locator('[data-tour="sources"]')).toContainText('Learning Stream');
    await expect(page.locator('[data-tour="sources"]')).toContainText('onewaterworkforce.org');

    const kpis = page.locator('[data-tour="kpis"] > *');
    await expect(kpis).toHaveCount(6);

    await expect(page.locator('[data-tour="pipeline"]')).toContainText('Employed');
    await expect(
      page.locator('[data-tour="supply-demand"] .recharts-surface').first()
    ).toBeVisible();
    await expect(
      page.locator('[data-tour="learning-stream"] .recharts-surface').first()
    ).toBeVisible();
    await expect(page.locator('[data-tour="regions"] table tbody tr')).toHaveCount(10);
    await expect(page.locator('[data-tour="epa"]')).toContainText('Task 2');
    await expect(page.locator('[data-tour="access"]')).toContainText('platform_admin');
  });

  test('tour opens from header and highlights sections', async ({ page }) => {
    await page.goto('/dashboard/oww');
    await page.getByRole('button', { name: /tour/i }).first().click();
    const dialog = page.getByRole('dialog', { name: /workspace tour/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Welcome to your One Water Workforce workspace/);
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('[data-tour="sources"].oww-tour-highlight')).toHaveCount(1);
  });
});
