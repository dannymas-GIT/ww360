# Developer tooling (agents & Cursor)

This tree is for **developers and agents**, not end users.

| Path | Purpose |
|------|---------|
| `.cursor/rules/*.mdc` | Cursor project rules (auto-loaded in IDE) |
| `docs/dev/` | Human-readable developer notes mirrored for Mission Control |

**Mission Control mirror:** Keep the same rule text in `/opt/projects/workspace/.cursor/rules/` and, when relevant, `/opt/projects/agents/*.json`. See dual-sync rule `agent-rules-dual-sync.mdc`.

**Git:** These files are committed so agents learn as we go. They are not shipped in the production frontend image (Docker build context is `frontend/`). Restrict *who can change* them with `.github/CODEOWNERS` + branch protection — Git cannot hide paths from anyone who can clone the repo.
