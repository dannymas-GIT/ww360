import { test, expect } from '@playwright/test';

/**
 * Document Studio (/studio) — program library, editor, versions, export, tour.
 * Credentials: WW360_E2E_USERNAME / WW360_E2E_PASSWORD (default seed user; must be an author).
 *
 * Creates a throwaway document per run and deletes it at the end.
 */
test.describe('Document Studio', () => {
  const api = process.env.WW360_API_URL || 'http://127.0.0.1:8002';
  const username = process.env.WW360_E2E_USERNAME || 'jingrao-aman-OWW';
  const password = process.env.WW360_E2E_PASSWORD;

  let token = '';
  const createdIds: string[] = [];

  test.beforeEach(async ({ page, request }) => {
    test.skip(!password, 'WW360_E2E_PASSWORD not configured');

    const login = await request.post(`${api}/api/v1/auth/login`, {
      data: { username, password },
    });
    expect(login.ok()).toBeTruthy();
    const body = await login.json();
    token = body.access_token;
    expect(token).toBeTruthy();

    await page.addInitScript(
      ({ tok, uid }) => {
        localStorage.setItem('ww360-auth-token', tok);
        localStorage.setItem(`ww360-oww-tour-dismissed:u${uid}`, '1');
        localStorage.setItem(`ww360-studio-tour-dismissed:u${uid}`, '1');
      },
      { tok: token, uid: body.user.id as number }
    );
  });

  test.afterEach(async ({ request }) => {
    while (createdIds.length) {
      const id = createdIds.pop();
      await request.delete(`${api}/api/v1/doc-studio/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });

  test('access + default folders are provisioned', async ({ request }) => {
    const access = await request.get(`${api}/api/v1/doc-studio/access`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(access.ok()).toBeTruthy();
    const a = await access.json();
    expect(a.can_view).toBeTruthy();
    expect(a.can_author).toBeTruthy();
    expect(a.can_connect_library).toBeTruthy();

    const folders = await request.get(`${api}/api/v1/doc-studio/folders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(folders.ok()).toBeTruthy();
    const names = ((await folders.json()) as Array<{ name: string }>).map(f => f.name);
    expect(names).toEqual(expect.arrayContaining(['Program briefs', 'Training & cohorts']));
  });

  test('external library + custody endpoints and header actions', async ({ page, request }) => {
    const access = await request.get(`${api}/api/v1/doc-studio/access`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(access.ok()).toBeTruthy();
    const a = await access.json();
    expect(a.can_connect_library).toBeTruthy();

    const policy = await request.get(
      `${api}/api/v1/doc-studio/custody/policy?scope=${encodeURIComponent(a.scope)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(policy.ok()).toBeTruthy();
    const policyBody = await policy.json();
    expect(policyBody.markdown).toContain('Water Workforce 360');

    const connections = await request.get(
      `${api}/api/v1/doc-studio/library/connections?scope=${encodeURIComponent(a.scope)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(connections.ok()).toBeTruthy();

    await page.goto('/studio');
    await expect(page.locator('[data-tour="studio-workspace"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-tour="studio-external-library"]')).toBeVisible();
    await expect(page.locator('[data-tour="studio-external-library-sidebar"]')).toBeVisible();
    if (a.can_custody_transfer) {
      await expect(page.locator('[data-tour="studio-custody-transfer"]')).toBeVisible();
    }

    await page.locator('[data-tour="studio-external-library-sidebar"]').click();
    await expect(page.getByRole('dialog', { name: /external library/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /connect account/i })).toBeVisible();
  });

  test('studio page renders the three-pane workspace', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.locator('[data-tour="studio-workspace"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-tour="studio-folders"]')).toBeVisible();
    await expect(page.locator('[data-tour="studio-documents"]')).toBeVisible();
    await expect(page.locator('[data-tour="studio-new-button"]')).toBeVisible();
    await expect(page.locator('[data-tour="studio-import"]')).toBeVisible();
    await expect(page.locator('[data-tour="studio-record"]')).toBeVisible();
    await expect(page.locator('[data-tour="studio-application-steps-overview"]')).toBeVisible();
  });

  test('watch overview opens avatar sample player', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.locator('[data-tour="studio-workspace"]')).toBeVisible({ timeout: 20_000 });
    await page.locator('[data-tour="studio-application-steps-overview"]').click();
    const dialog = page.getByRole('dialog', { name: /record application steps/i });
    await expect(dialog).toBeVisible();
    await expect(page.locator('[data-tour="studio-application-steps-player"] video')).toBeVisible();
    await expect(page.locator('[data-tour="studio-application-steps-player"] source')).toHaveAttribute(
      'src',
      /application-steps-sample\.mp4/
    );
  });

  test('record tutorial opens mode picker with five modes', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.locator('[data-tour="studio-workspace"]')).toBeVisible({ timeout: 20_000 });
    await page.locator('[data-tour="studio-record"]').click();
    const modal = page.locator('[data-tutorial-recorder]');
    await expect(modal).toBeVisible();
    const picker = page.locator('[data-tour="studio-mode-picker"]');
    await expect(picker).toBeVisible();
    await expect(picker.locator('button')).toHaveCount(5);
    await expect(picker).toContainText('Screen + Camera');
    await expect(picker).toContainText('Camera only');
    await expect(picker).toContainText('Voice only');
    await expect(picker).toContainText('Screenshots');
    await expect(picker).toContainText('Screen + mic narration');
    await modal.getByRole('button', { name: /close/i }).click();
    await expect(modal).toBeHidden();
  });

  test('create from template, autosave, explicit save creates v2, export works', async ({ page, request }) => {
    const title = `E2E studio ${Date.now()}`;

    await page.goto('/studio');
    await page.locator('[data-tour="studio-new-button"]').click();
    const dialog = page.locator('[data-tour="studio-new-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(page.locator('[data-tour="studio-template-gallery"]')).toBeVisible();

    await dialog.getByRole('button', { name: /cohort \/ training plan/i }).click();
    await dialog.getByLabel(/^title$/i).fill(title);
    await dialog.getByRole('button', { name: /create document/i }).click();

    // Editor opens on the new document.
    const editor = page.locator('[data-tour="studio-editor"] .ProseMirror');
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-tour="studio-status"]')).toContainText(/v1/);
    const docId = new URL(page.url()).searchParams.get('doc');
    expect(docId).toBeTruthy();
    createdIds.push(docId as string);

    // Type → dirty → autosaved (no version bump).
    await editor.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Playwright typed paragraph.');
    const status = page.locator('[data-tour="studio-status"]');
    await expect(status.getByText('Unsaved changes')).toBeVisible();
    await expect(status.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(status).toContainText(/v1/);

    // Explicit Save cuts v2 and shows in version history.
    await page.locator('[data-tour="studio-save"]').click();
    await expect(page.locator('[data-tour="studio-status"]')).toContainText(/v2/, { timeout: 10_000 });
    await page.locator('[data-tour="studio-versions-toggle"]').click();
    const versions = page.locator('[data-tour="studio-versions"]');
    await expect(versions).toBeVisible();
    await expect(versions).toContainText(/v2/);
    await expect(versions).toContainText(/v1/);

    // Slash menu opens on "/" at an empty line.
    await editor.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/');
    await expect(page.locator('[data-tour="studio-slash-menu"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-tour="studio-slash-menu"]')).toHaveCount(0);

    // Export endpoints return the right content types.
    for (const [fmt, type] of [
      ['markdown', 'text/markdown'],
      ['pdf', 'application/pdf'],
      ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ] as const) {
      const res = await request.get(`${api}/api/v1/doc-studio/documents/${docId}/export/${fmt}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.ok(), `export ${fmt}`).toBeTruthy();
      expect(res.headers()['content-type']).toContain(type);
      expect((await res.body()).length).toBeGreaterThan(100);
    }
  });

  test('studio tour opens from the header and highlights folders', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.locator('[data-tour="studio-workspace"]')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /^tour$/i }).click();
    const tour = page.getByRole('dialog', { name: /document studio tour/i });
    await expect(tour).toBeVisible();
    await expect(tour).toContainText(/welcome to document studio/i);
    await tour.getByRole('button', { name: /next/i }).click();
    await expect(page.locator('[data-tour="studio-folders"]')).toHaveClass(/ww360-tour-highlight/);
    await tour.getByRole('button', { name: /close tour/i }).click();
    await expect(tour).toBeHidden();
  });

  test('saves and versions tour docks left and shows version history', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.locator('[data-tour="studio-workspace"]')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /^tour$/i }).click();
    const tour = page.getByRole('dialog', { name: /document studio tour/i });
    await expect(tour).toBeVisible();

    // welcome → folders → documents → new → editor → toolbar → save (6 Next clicks)
    for (let i = 0; i < 6; i++) {
      await tour.getByRole('button', { name: /next/i }).click();
      await page.waitForTimeout(400);
    }
    await expect(tour).toContainText(/Saves and versions/i);
    await expect(tour).toHaveAttribute('data-tour-side', 'left');
    const versions = page.locator('[data-tour="studio-versions"]');
    await expect(versions).toBeVisible({ timeout: 15_000 });
    await expect(versions).toHaveClass(/ww360-tour-highlight/);
    await expect.poll(async () => versions.locator('li').count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  });
});
