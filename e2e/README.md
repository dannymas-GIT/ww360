# E2E tests (**APP_NAME**)

- `smoke/` — fast checks; run on pre-push and PR CI (`--project=chromium`).
- `features/` — longer flows; run in CI with all projects as needed.
- `a11y/` — axe-core scans; requires `@axe-core/playwright`.
- `visual/` — optional screenshot baselines (`toHaveScreenshot`).

## Environment

| Variable                    | Purpose                                                                        |
| --------------------------- | ------------------------------------------------------------------------------ |
| `PLAYWRIGHT_BASE_URL`       | Target origin (default `http://127.0.0.1:5173`)                                |
| `PW_DEV_COMMAND`            | Dev server command if not `npm run dev` (e.g. `npm run dev --prefix frontend`) |
| `PLAYWRIGHT_SKIP_WEBSERVER` | Set to `1` if you start the server yourself                                    |
| `PLAYWRIGHT_STORAGE`        | Path to saved `storageState` JSON after login                                  |

## Commands

```bash
npx playwright test e2e/smoke/ --project=chromium
npm run preflight
```
