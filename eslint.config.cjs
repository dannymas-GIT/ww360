// Flat ESLint config for SvelteKit / Vite apps (JS/TS). Add eslint-plugin-svelte when using .svelte files.
// @ts-check
const js = require("@eslint/js");
const globals = require("globals");

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  { ignores: ["**/node_modules/**", "**/build/**", "**/dist/**", "**/.svelte-kit/**"] },
  {
    ...js.configs.recommended,
    files: [
      "src/**/*.{js,ts,mjs,cjs}",
      "frontend/src/**/*.{js,ts,mjs,cjs}",
      "e2e/**/*.{js,ts,mjs,cjs}",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];
