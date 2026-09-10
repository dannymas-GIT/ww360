import { test, expect } from '@playwright/test';

/**
 * National platform admin can switch primacy state; exec dashboard reflects pack eyebrow.
 */
test.describe('National jurisdiction switching', () => {
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
    expect(token).toBeTruthy();

    await page.addInitScript(
      ({ tok, uid }) => {
        localStorage.setItem('ww360-auth-token', tok);
        localStorage.setItem(`ww360-oww-tour-dismissed:u${uid}`, '1');
      },
      { tok: token, uid: body.user.id as number }
    );
  });

  test('exec dashboard shows NY pack eyebrow by default', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/New York Section AWWA/i)).toBeVisible({ timeout: 20_000 });
  });

  test('platform admin can switch to NJ and see NJ pack copy', async ({ page, request }) => {
    const login = await request.post(`${api}/api/v1/auth/login`, {
      data: { username, password },
    });
    const body = await login.json();
    test.skip(!body.user?.is_national_admin, 'Seed user is not national admin');

    const switched = await request.post(`${api}/api/v1/auth/active-state`, {
      headers: { Authorization: `Bearer ${body.access_token}` },
      data: { state_code: 'NJ' },
    });
    expect(switched.ok()).toBeTruthy();
    const switchedBody = await switched.json();

    await page.addInitScript(
      ({ tok, uid }) => {
        localStorage.setItem('ww360-auth-token', tok);
        localStorage.setItem(`ww360-oww-tour-dismissed:u${uid}`, '1');
      },
      { tok: switchedBody.access_token as string, uid: body.user.id as number }
    );

    await page.goto('/dashboard');
    await expect(page.getByText(/New Jersey Section AWWA/i)).toBeVisible({ timeout: 20_000 });
  });
});
