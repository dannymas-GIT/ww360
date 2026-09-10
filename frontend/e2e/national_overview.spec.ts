import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const USER = process.env.TEST_EMAIL || 'ww360-national';
const PASS = process.env.TEST_PASSWORD || 'ChangeMe-National!';

test.describe('National overview', () => {
  test.skip(!USER || !PASS, 'Credentials required');

  test('national admin sees US overview KPIs', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#username', USER);
    await page.fill('#password', PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    await page.goto(`${BASE}/national`);
    await expect(page.getByText('National workforce')).toBeVisible();
    await expect(page.getByText('Workforce replacement gap')).toBeVisible();
    await expect(page.getByText('State comparison')).toBeVisible();
  });
});
