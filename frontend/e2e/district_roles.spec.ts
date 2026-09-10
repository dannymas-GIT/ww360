import { test, expect, devices } from '@playwright/test';

const api = process.env.WW360_API_URL || 'http://127.0.0.1:8002';
const password = process.env.WW360_HFWD_PASSWORD || process.env.WW360_SEED_DISTRICT_PASSWORD || 'ChangeMe-HFWD!';

async function loginAs(
  request: import('@playwright/test').APIRequestContext,
  page: import('@playwright/test').Page,
  username: string
) {
  const login = await request.post(`${api}/api/v1/auth/login`, {
    data: { username, password },
  });
  expect(login.ok()).toBeTruthy();
  const body = await login.json();
  await page.addInitScript(
    ({ tok, uid }) => {
      localStorage.setItem('ww360-auth-token', tok);
      localStorage.setItem(`ww360-oww-tour-dismissed:u${uid}`, '1');
    },
    { tok: body.access_token as string, uid: body.user.id as number }
  );
}

test.describe('Hudson Falls district roles', () => {
  test('manager lands on district dashboard', async ({ page, request }) => {
    await loginAs(request, page, 'hf-manager');
    await page.goto('/dashboard');
    await expect(page.getByText(/district dashboard/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/documentation review queue/i)).toBeVisible();
  });

  test('operator lands on operator home without admin nav', async ({ page, request }) => {
    await loginAs(request, page, 'hf-operator-1');
    await page.goto('/dashboard');
    await expect(page.getByText(/operator home/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/my documentation tasks/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /executive overview/i })).toHaveCount(0);
  });

  test('operator can open continuity without admin sections', async ({ page, request }) => {
    await loginAs(request, page, 'hf-operator-1');
    await page.goto('/continuity');
    await expect(page.getByText(/workforce continuity/i)).toBeVisible({ timeout: 20_000 });
  });

  test('manager API can list documentation tasks', async ({ request }) => {
    const login = await request.post(`${api}/api/v1/auth/login`, {
      data: { username: 'hf-manager', password },
    });
    expect(login.ok()).toBeTruthy();
    const { access_token } = await login.json();
    const tasks = await request.get(`${api}/api/v1/documentation-tasks?district_code=HFWD`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect(tasks.ok()).toBeTruthy();
  });
});

test.describe('Hudson Falls mobile smoke', () => {
  test.use({ ...devices['iPhone 14'] });

  test('operator home is usable on mobile', async ({ page, request }) => {
    await loginAs(request, page, 'hf-operator-1');
    await page.goto('/dashboard');
    await expect(page.getByText(/operator home/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/document a responsibility/i)).toBeVisible();
  });
});
