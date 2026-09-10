# Developer notes

Agent and Cursor standards for Water Workforce 360. Canonical machine-readable rules: **`.cursor/rules/`**.

## Accessible type scale

See `.cursor/rules/ww360-accessible-type.mdc`.

| Role | Size |
|------|------|
| Body | 1.125rem (18px), line-height 1.5–1.6 |
| UI | 1rem–1.125rem |
| Captions floor | 0.875rem (14px) — never smaller for readable text |

## Dual sync

When updating rules, sync Cursor repo + Mission Control workspace + `/opt/projects/agents` + memory store. Rule: `.cursor/rules/agent-rules-dual-sync.mdc`.
