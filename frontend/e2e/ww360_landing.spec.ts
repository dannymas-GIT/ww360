import { test, expect } from '@playwright/test';

test('WW360 landing loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Workforce|WW360/i);
});

test('slider logo sits to the right of hero copy on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const logo = page.locator('.ww360-hero .ww360-stage__logo');
  const copy = page.locator('.ww360-hero .ww360-stage__copy');
  await expect(logo).toBeVisible();
  await expect(copy).toBeVisible();

  const logoBox = await logo.boundingBox();
  const copyBox = await copy.boundingBox();
  expect(logoBox, 'slider logo should have a box').toBeTruthy();
  expect(copyBox, 'hero copy should have a box').toBeTruthy();
  expect(logoBox!.x).toBeGreaterThan(copyBox!.x + copyBox!.width - 12);

  const hero = page.locator('.ww360-hero');
  const controls = page.locator('.ww360-stage__controls');
  const heroBox = await hero.boundingBox();
  const controlsBox = await controls.boundingBox();
  expect(heroBox).toBeTruthy();
  expect(controlsBox).toBeTruthy();
  expect(logoBox!.y - heroBox!.y).toBeLessThan(48);
  expect(logoBox!.y + logoBox!.height).toBeLessThan(controlsBox!.y - 16);
});

test('stage height and bottom edge stay consistent across slides', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const hero = page.locator('.ww360-hero');
  const tabs = page.locator('.ww360-stage__dot');
  const count = await tabs.count();
  expect(count).toBeGreaterThan(3);

  const heights: number[] = [];
  for (let i = 0; i < count; i++) {
    await tabs.nth(i).click();
    const box = await hero.boundingBox();
    expect(box).toBeTruthy();
    heights.push(Math.round(box!.height));
  }

  expect(new Set(heights).size, `slide heights drifted: ${heights.join(', ')}`).toBe(1);

  const shear = page.locator('.ww360-hero__shear');
  await expect(shear).toBeVisible();
  const clip = await shear.evaluate(el => getComputedStyle(el).clipPath);
  expect(clip === 'none' || clip === '').toBeTruthy();
});

test('partners slide centers WW360 among NYSAWWA, AquaSafe, and OWW', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Partners' }).click();
  const diagram = page.locator('.ww360-stage__partners');
  await expect(diagram).toBeVisible();
  await expect(diagram).toHaveAttribute(
    'aria-label',
    /Water Workforce 360.*NYSAWWA.*AquaSafe.*One Water Workforce/i
  );
  await expect(page.locator('.ww360-stage__partners-links')).toHaveCount(0);
  await expect(page.locator('.ww360-stage__orb--nysawwa')).toContainText('NYSAWWA');
  await expect(page.locator('.ww360-stage__orb--aquasafe')).toContainText('AquaSafe');
  await expect(page.locator('.ww360-stage__orb--oww')).toContainText('ONE WATER');

  const hub = page.locator('.ww360-stage__partners-hub');
  const nysawwa = page.locator('.ww360-stage__orb--nysawwa');
  const aqua = page.locator('.ww360-stage__orb--aquasafe');
  const oww = page.locator('.ww360-stage__orb--oww');
  const hubBox = await hub.boundingBox();
  const nyBox = await nysawwa.boundingBox();
  const aquaBox = await aqua.boundingBox();
  const owwBox = await oww.boundingBox();
  expect(hubBox && nyBox && aquaBox && owwBox).toBeTruthy();
  expect(nyBox!.y).toBeLessThan(hubBox!.y);
  expect(aquaBox!.x).toBeLessThan(hubBox!.x);
  expect(owwBox!.x).toBeGreaterThan(hubBox!.x);
});

test('hamburger nav and readable stage fit phone and tablet', async ({ page }) => {
  for (const width of [390, 820] as const) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');

    const toggle = page.getByRole('button', { name: /open menu/i });
    await expect(toggle).toBeVisible();
    await expect(page.locator('.ww360-nav__links--desktop')).toBeHidden();
    await expect(page.locator('.ww360-stage__brand-lockup')).toBeHidden();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeFalsy();

    const h1Size = await page.locator('.ww360-hero h1').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(h1Size, `hero title too small at ${width}px`).toBeGreaterThanOrEqual(24);

    await toggle.click();
    await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: 'Capabilities' })
    ).toBeVisible();
    await page.getByRole('button', { name: /close menu/i }).click();

    await page.getByRole('tab', { name: 'Partners' }).click();
    const diagram = page.locator('.ww360-stage__partners');
    await expect(diagram).toBeVisible();
  }
});
