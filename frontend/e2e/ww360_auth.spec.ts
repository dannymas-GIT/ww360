import { test, expect } from '@playwright/test';

test.describe('WW360 auth', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in to workforce 360/i })).toBeVisible();
    await expect(page.getByLabel(/^username$/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    // SSO buttons appear only when DOC_STUDIO_MS_* / GOOGLE_* are configured.
    // Always assert password path remains available.
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
  });

  test('sso provider discovery endpoint', async ({ request }) => {
    const api = process.env.WW360_API_URL || 'http://127.0.0.1:8002';
    const res = await request.get(`${api}/api/v1/auth/sso/providers`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.providers)).toBeTruthy();
  });
});
