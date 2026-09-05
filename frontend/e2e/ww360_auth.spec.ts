import { test, expect } from '@playwright/test';

test.describe('WW360 auth', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in to workforce 360/i })).toBeVisible();
  });
});
