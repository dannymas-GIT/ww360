# Agent rules dual-sync (WW360)

Durable product policy rules are mirrored per `.cursor/rules/agent-rules-dual-sync.mdc`.

## WW360 admin & RBAC rules (2026-03)

| Rule | App repo | Mission Control workspace |
|------|----------|---------------------------|
| AquaSafe user-mgmt UX | `.cursor/rules/aquasafe-user-management-standard.mdc` | `workspace/.cursor/rules/aquasafe-user-management-standard.mdc` |
| Security by default | `.cursor/rules/security-by-default.mdc` | `workspace/.cursor/rules/security-by-default.mdc` |

Also stored in control-api memory (`source: cursor`, tags: `rules`, `ww360`, `aquasafe`, `user-management`, `rbac`, `security`, `security-by-default`).

Reference implementation: `/district/users`, `frontend/src/components/ww360/navConfig.ts` (`adminNavGroup`).
