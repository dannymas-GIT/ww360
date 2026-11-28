"""Add AquaSafe/OWW user links + canonical PWSID/NPDES district identifiers.

Revision ID: 0002_sync_pwsid_and_user_links
Revises: 0001_baseline
Create Date: 2026-11-28

Idempotent ALTERs so stamped staging DBs (already close to baseline) can upgrade
safely even when some columns already exist from legacy ``ensure_*_schema``.
"""

from __future__ import annotations

from alembic import op

revision = "0002_sync_pwsid_and_user_links"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users ADD COLUMN IF NOT EXISTS aquasafe_user_id INTEGER;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS oww_user_id VARCHAR(64);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_provider VARCHAR(50);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_subject VARCHAR(255);
        CREATE UNIQUE INDEX IF NOT EXISTS ix_users_aquasafe_user_id
            ON users (aquasafe_user_id) WHERE aquasafe_user_id IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS ix_users_oww_user_id
            ON users (oww_user_id) WHERE oww_user_id IS NOT NULL;
        """
    )
    op.execute(
        """
        ALTER TABLE water_districts ADD COLUMN IF NOT EXISTS aquasafe_district_id INTEGER;
        ALTER TABLE water_districts ADD COLUMN IF NOT EXISTS pwsid VARCHAR(32);
        ALTER TABLE water_districts ADD COLUMN IF NOT EXISTS npdes_id VARCHAR(64);
        ALTER TABLE water_districts ADD COLUMN IF NOT EXISTS spdes_id VARCHAR(64);
        CREATE UNIQUE INDEX IF NOT EXISTS ix_water_districts_aquasafe_district_id
            ON water_districts (aquasafe_district_id) WHERE aquasafe_district_id IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS uq_water_districts_pwsid_state
            ON water_districts (pwsid, state_code)
            WHERE pwsid IS NOT NULL AND state_code IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS uq_water_districts_npdes_state
            ON water_districts (npdes_id, state_code)
            WHERE npdes_id IS NOT NULL AND state_code IS NOT NULL;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_water_districts_npdes_state")
    op.execute("DROP INDEX IF EXISTS uq_water_districts_pwsid_state")
    op.execute("DROP INDEX IF EXISTS ix_water_districts_aquasafe_district_id")
    op.execute("DROP INDEX IF EXISTS ix_users_oww_user_id")
    op.execute("DROP INDEX IF EXISTS ix_users_aquasafe_user_id")
    # Columns intentionally retained on downgrade to avoid data loss on shared DBs.
