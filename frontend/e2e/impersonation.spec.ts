import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const USER = process.env.TEST_EMAIL || 'jingrao-aman-OWW';
const PASS = process.env.TEST_PASSWORD || 'ChangeMe-WW360!';

test.describe('Impersonation persona switcher', () => {
  test.skip(!USER || !PASS, 'Credentials required');

  test('platform admin can preview national persona and land on simplified workspace', async ({
    page,
  }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#username', USER);
    await page.fill('#password', PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    await page.getByRole('button', { name: 'View as role' }).click();
    await expect(page.getByRole('dialog')).toContainText('Preview a role');

    const nationalPersona = page
      .getByRole('button', { name: /ASDWA|us-asdwa-program-director/i })
      .first();
    if (await nationalPersona.isVisible()) {
      await nationalPersona.click();
      await expect(page.getByRole('status')).toContainText('Viewing as');
      await page.waitForURL(/\/national/);
      await expect(page.getByText(/Primacy|National|workforce/i).first()).toBeVisible();
      await page.getByRole('button', { name: 'Exit preview' }).click();
    }
  });

  test('kitchen sink toggle reveals full nav', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#username', USER);
    await page.fill('#password', PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    const sink = page.getByLabel(/Kitchen Sink/i);
    await expect(sink).toBeVisible();
    await sink.check();
    await expect(page.getByRole('link', { name: /Digital reach|EPA measures|Jurisdictions/i }).first()).toBeVisible({ timeout: 8000 });
  });
});
