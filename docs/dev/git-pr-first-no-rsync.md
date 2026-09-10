# WW360 delivery workflow: Git + PR first (no ad-hoc rsync)

**Rule:** Ship product changes through **git branches and pull requests into `develop`**. Do **not** treat staging rsync as the source of truth.

## Why

Ad-hoc `rsync` + `docker compose build` on the staging VM puts code on https://ww360.aquasafe-solutions.us that is:

- Not necessarily committed
- Not necessarily on `develop`
- Easy to lose or duplicate across kitchen-sink feature branches

That caused “it’s on staging but not in the repo / not in develop” confusion (e.g. landing logo-on-right).

## Required workflow

1. **Start from a clean `develop`**
   ```bash
   git fetch origin
   git switch develop
   git pull origin develop
   git switch -c feature/<short-topic>
   ```
2. **One intent per branch** — if you change direction, park WIP and open a new branch (see below).
3. **Commit locally** with a clear message.
4. **Push and open a PR into `develop`**
   ```bash
   git push -u origin HEAD
   gh pr create --base develop
   ```
5. **Deploy staging only from a merged or PR-approved commit** (CI, or pull the PR branch on the VM and build — not rsync of an unclean laptop tree).

## Parking WIP when you pivot

```bash
# Option A — labeled stash
git stash push -u -m "wip: <topic> $(date +%F)"

# Option B — safety branch (preferred for large sessions)
git switch -c wip/<topic>-backup
git add <explicit paths>
git commit -m "WIP: park <topic> — do not merge as-is"
git push -u origin HEAD
git switch develop
```

Never leave days of unrelated edits only on `feature/landing-slider-logo-right` (or any long-lived kitchen-sink branch).

## What agents / Cursor should do

When the user changes topic, agents must:

1. Confirm whether to **park** current WIP (stash or `wip/` branch)
2. **Create/switch** to `feature/<new-topic>` from `origin/develop`
3. Prefer **PR to develop** over rsync when asked to “ship” or “put on staging”

**Do not** rsync the working tree to staging unless the user explicitly overrides this rule for an emergency hotfix — and then immediately commit + PR the same bytes.

## Related

- Open PRs: use `gh pr list --base develop`
- Full session backup (2026-09-10): branch `wip/session-2026-09-10-full-backup`
- PWS ownership PR: #20 (`feature/pws-ownership-utility-review`)
- Landing / personas base: `feature/landing-slider-logo-right` (PRs #18 / #19)
