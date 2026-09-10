import { test, expect, type Page } from '@playwright/test';
import { buildApplicationStepsTourSlides } from '../src/components/doc-studio/applicationStepsTourContent';

/**
 * Document Studio overview tour — Playwright aligned to benefit cards
 * (workspace docs/tour-video-scripts/ww360-application-steps.md).
 */
test.describe('Application Steps guided tour', () => {
  const api = process.env.WW360_API_URL || 'http://127.0.0.1:8002';
  const username = process.env.WW360_E2E_USERNAME || 'jenny-oww';
  const password = process.env.WW360_E2E_PASSWORD;
  const slides = buildApplicationStepsTourSlides();

  test.beforeEach(async ({ page, request }) => {
    test.skip(!password, 'WW360_E2E_PASSWORD not configured');

    const login = await request.post(`${api}/api/v1/auth/login`, {
      data: { username, password },
    });
    expect(login.ok()).toBeTruthy();
    const body = await login.json();
    const token = body.access_token as string;
    const uid = body.user.id as number;

    await page.addInitScript(
      ({ tok, uid }) => {
        localStorage.setItem('ww360-auth-token', tok);
        localStorage.setItem(`ww360-oww-tour-dismissed:u${uid}`, '1');
        localStorage.setItem(`ww360-studio-tour-dismissed:u${uid}`, '1');
        localStorage.removeItem(`ww360-application-steps-tour-dismissed:u${uid}`);
        localStorage.removeItem(`ww360-application-steps-tour-step:u${uid}`);
      },
      { tok: token, uid }
    );
  });

  async function openTour(page: Page) {
    await page.goto('/studio');
    await expect(page.locator('[data-tour="studio-workspace"]')).toBeVisible({ timeout: 20_000 });
    await page.locator('[data-tour="studio-application-steps-overview"]').click();
    await expect(page.locator('[data-tour="application-steps-tour-card"]')).toBeVisible();
    await expect(page.locator('[data-tour="application-steps-avatar"]')).toBeVisible();
  }

  test('avatar docks bottom-right; step card docks bottom-left', async ({ page }) => {
    await openTour(page);

    const avatar = page.locator('[data-tour="application-steps-avatar"]');
    const card = page.locator('[data-tour="application-steps-tour-card"]');
    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();

    const avatarBox = await avatar.boundingBox();
    const cardBox = await card.boundingBox();
    expect(avatarBox).toBeTruthy();
    expect(cardBox).toBeTruthy();
    if (!avatarBox || !cardBox || !viewport) return;

    // Avatar near bottom-right
    expect(avatarBox.x + avatarBox.width).toBeGreaterThan(viewport.width * 0.7);
    expect(avatarBox.y + avatarBox.height).toBeGreaterThan(viewport.height * 0.65);

    // Step card near bottom-left
    expect(cardBox.x).toBeLessThan(viewport.width * 0.35);
    expect(cardBox.y + cardBox.height).toBeGreaterThan(viewport.height * 0.55);

    // Cards do not overlap horizontally
    expect(cardBox.x + cardBox.width).toBeLessThan(avatarBox.x + 8);

    // Readable type: body text at least ~18px (1.125rem); kickers may be 14px
    const bodyFont = await card
      .locator('.space-y-2 > p')
      .first()
      .evaluate(el => getComputedStyle(el).fontSize);
    expect(parseFloat(bodyFont)).toBeGreaterThanOrEqual(17.5);
  });

  test('each slide matches the benefit copy and highlights the right control', async ({ page }) => {
    await openTour(page);
    const card = page.locator('[data-tour="application-steps-tour-card"]');
    const next = page.locator('[data-tour="application-steps-tour-next"]');

    for (let i = 0; i < slides.length; i += 1) {
      const slide = slides[i];
      await expect(card).toHaveAttribute('data-step-id', slide.id);
      await expect(card).toContainText(slide.scriptQuote, { ignoreCase: true });
      await expect(card.getByRole('heading', { name: slide.title })).toBeVisible();

      if (slide.highlight) {
        const target = page.locator(slide.highlight).first();
        await expect(target).toBeVisible({ timeout: 10_000 });
        await expect(target).toHaveClass(/ww360-tour-highlight/);
      }

      await expect(page.locator('[data-tour="application-steps-avatar"] source')).toHaveAttribute(
        'src',
        /application-steps-sample(-dmas)?\.mp4/
      );

      if (i < slides.length - 1) {
        await next.click();
        await page.waitForTimeout(350);
      }
    }

    await next.click();
    await expect(card).toBeHidden({ timeout: 5_000 });
  });

  test('overview does not open the tutorial recorder', async ({ page }) => {
    await openTour(page);
    const next = page.locator('[data-tour="application-steps-tour-next"]');

    for (let i = 0; i < slides.length - 1; i += 1) {
      await expect(page.locator('[data-tutorial-recorder]')).toHaveCount(0);
      await next.click();
      await page.waitForTimeout(200);
    }
    await expect(page.locator('[data-tutorial-recorder]')).toHaveCount(0);
  });

  test('video close hides the player and can be shown again', async ({ page }) => {
    await openTour(page);
    const video = page.locator('[data-tour="application-steps-avatar"]');
    const card = page.locator('[data-tour="application-steps-tour-card"]');
    await expect(video).toBeVisible();

    await page.locator('[data-tour="application-steps-close-video"]').click();
    await expect(video).toHaveCount(0);
    await expect(card).toBeVisible();

    await page.locator('[data-tour="application-steps-show-video"]').click();
    await expect(page.locator('[data-tour="application-steps-avatar"]')).toBeVisible();
  });
});
