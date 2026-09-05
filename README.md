# SaaS preflight overlay

Copied into new apps by `skills/saas-scaffold/scripts/scaffold.py` or into existing repos via `scripts/saas/apply_preflight_overlay.py`.

- **Do not edit `package.frag.json` keys blindly** — `scaffold.py` merges `scripts`, `devDependencies`, and `lint-staged` into the target `package.json`.
- **`__APP_NAME__` / `__APP_DISPLAY_NAME__`** placeholders are replaced in text files under this tree (e.g. `e2e/README.md`).
- Ensure the app has an `npm run preview` script (SvelteKit/Vite) for PR CI, or adjust `.github/workflows/pr-checks.yml` to start your dev server.

See `docs/saas-pipeline-on-push.md` and `docs/github-branch-protection.md`.

**Dependabot:** `.github/dependabot.yml` is generated from central policy [`config/dependabot.json`](../../config/dependabot.json). See `docs/dependabot-handoff-runbook.md`. Regenerate per-repo with `python3 scripts/saas/generate_dependabot.py <app-root>` or bulk `python3 scripts/saas/bootstrap_dependabot.py`.
