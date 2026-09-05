import { test, expect } from '@playwright/test';

test('WW360 landing loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Workforce|WW360/i);
});
