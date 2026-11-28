# WW360 Alembic

## Fresh database

```bash
cd backend
alembic upgrade head
```

`0001_baseline` creates the SQLAlchemy metadata schema; `0002_sync_pwsid_and_user_links`
adds AquaSafe/OWW user link columns and canonical `(pwsid|npdes_id, state_code)` indexes.

## Existing staging DB (previously bootstrapped via `create_all`)

```bash
cd backend
alembic stamp 0001_baseline
alembic upgrade head
```

Then set `WW360_USE_ALEMBIC=true` in the environment (Azure Compose defaults this on) so
startup no longer runs ad-hoc `ALTER TABLE` / `create_all` patches.
