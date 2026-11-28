"""Baseline schema for WW360 (fresh installs).

Revision ID: 0001_baseline
Revises:
Create Date: 2026-11-28

Staging / existing DBs that were bootstrapped via ``create_all`` should stamp
this revision then upgrade:

    cd backend && alembic stamp 0001_baseline && alembic upgrade head
"""

from __future__ import annotations

from alembic import op
from app.db import base
from app.db.base_class import Base

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    base.import_models()
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    base.import_models()
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
