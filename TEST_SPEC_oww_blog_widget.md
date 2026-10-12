# TEST_SPEC — OWW Blog Widget

Feature branch: `feature/oww-blog-widget`

## Scope

Dashboard widget **One Water Workforce updates** that proxies published OWW blog posts.

## Backend

- [ ] `GET /api/v1/content/oww-blog?state=NY&limit=5` proxies `{OWW_PUBLIC_BASE_URL or OWW_ENTITLEMENT_BASE_URL}/api/v1/public/blog/{state}`.
- [ ] Unreachable OWW → empty items with `data_mode=error` (not 500).
- [ ] 15-minute in-memory TTL cache.

## Frontend

- [ ] Customize home → Content → **One Water Workforce updates**.
- [ ] Shows cover, title, date, excerpt, “Read on OWW”.
