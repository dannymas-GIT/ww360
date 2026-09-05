import { test, expect } from '@playwright/test';

test.skip('workforce continuity route', async ({ page }) => {
  await page.goto('/dashboard/workforce-continuity');
  await expect(page.getByRole('heading')).toBeVisible();
});
