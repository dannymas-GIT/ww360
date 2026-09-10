# Dual-sync agent rules (Cursor ↔ Mission Control)

Product policy for agents lives in **both** the app repo and Mission Control so IDE and OpenClaw agents stay aligned.

## Canonical copies for user / profile policy

| Rule | WW360 repo | Mission Control workspace |
|------|------------|---------------------------|
| User & role management + **Profile area** | `.cursor/rules/aquasafe-user-management-standard.mdc` | `workspace/.cursor/rules/aquasafe-user-management-standard.mdc` |
| Security / AuthZ / password lifecycle | `.cursor/rules/security-by-default.mdc` | `workspace/.cursor/rules/security-by-default.mdc` |

**Durable memory:** `POST http://127.0.0.1:8089/api/memory/store` with `source: "cursor"`, tags `rules`, `saas`, `user-management`, `profile`.

**Index:** `workspace-expert-knowledge-ingest/docs/where-knowledge-lives.md` (WW360 admin / RBAC + Profile bullet).

When changing these rules, update **all** copies in the same change set (see `.cursor/rules/agent-rules-dual-sync.mdc`).
