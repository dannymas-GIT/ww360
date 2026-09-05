const { test, expect } = require("@playwright/test");

/**
 * Smoke: app root responds. Adjust path if your app uses a different landing route.
 */
test.describe("smoke", () => {
  test("home responds", async ({ page }) => {
    const res = await page.goto("/");
    expect(res).not.toBeNull();
    expect(res.ok() || res.status() === 304).toBeTruthy();
  });
});
