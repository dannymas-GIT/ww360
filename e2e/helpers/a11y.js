/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@axe-core/playwright').AxeOptions} [options]
 */
async function runAxeScan(page, options = {}) {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  const tags = options.tags || ["wcag2a", "wcag2aa", "wcag21aa"];
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  return results;
}

module.exports = { runAxeScan };
