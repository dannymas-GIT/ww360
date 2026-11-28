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
    await expect(page.getByRole('link', { name: /activate your utility/i })).toBeVisible();
  });

  test('activate page renders magic-link entry', async ({ page }) => {
    await page.goto('/activate');
    await expect(page.getByRole('heading', { name: /activate your utility/i })).toBeVisible();
    await expect(page.getByLabel(/work or billing email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /email me a code/i })).toBeVisible();
  });

  test('sso provider discovery endpoint', async ({ request }) => {
    const api = process.env.WW360_API_URL || 'http://127.0.0.1:8002';
    const res = await request.get(`${api}/api/v1/auth/sso/providers`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.providers)).toBeTruthy();
  });

  test('Return to AquaSafe when session.origin is aquasafe', async ({ page }) => {
    await page.route('**/api/v1/auth/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 42,
          username: 'aquasafe-visitor',
          email: 'visitor@example.com',
          roles: ['district_admin'],
          districts: ['HF001'],
          active_state_code: 'NY',
          origin: 'aquasafe',
          aquasafe_user_id: 7,
        }),
      });
    });
    await page.addInitScript(() => {
      localStorage.setItem('ww360-auth-token', 'test-aquasafe-origin-token');
    });
    await page.goto('/dashboard');
    const link = page.getByTestId('return-to-aquasafe').or(page.getByTestId('return-to-aquasafe-mobile'));
    await expect(link.first()).toBeVisible({ timeout: 20_000 });
    await expect(link.first()).toHaveAttribute('href', /aquasafe/i);
  });

  test('stripe webhook rejects missing signature', async ({ request }) => {
    const api = process.env.WW360_API_URL || 'http://127.0.0.1:8002';
    const res = await request.post(`${api}/api/v1/webhooks/stripe/oww`, {
      data: { id: 'evt_test', type: 'customer.updated', data: { object: {} } },
    });
    // 401 missing sig, or 503 if webhook secret not configured in the env
    expect([400, 401, 503]).toContain(res.status());
  });
});
