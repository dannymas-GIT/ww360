const { test, expect } = require("@playwright/test");
const { runAxeScan } = require("../helpers/a11y.js");

test.describe("a11y", () => {
  test("landing page has no serious axe violations", async ({ page }) => {
    await page.goto("/");
    const results = await runAxeScan(page);
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious, null, 2)).toHaveLength(0);
  });
});
