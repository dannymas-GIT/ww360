"""Stripe entitlements, webhook events, magic tokens, org link requests.

Revision ID: 0003_stripe_entitlements_and_magic_links
Revises: 0002_sync_pwsid_and_user_links
Create Date: 2026-11-28

Depends on PR 1A Alembic revisions (0001_baseline, 0002_sync_pwsid_and_user_links).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_stripe_entitlements_and_magic_links"
down_revision: Union[str, None] = "0002_sync_pwsid_and_user_links"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "oww_stripe_entitlements",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("stripe_customer_id", sa.String(length=120), nullable=False),
        sa.Column("stripe_subscription_id", sa.String(length=120), nullable=True),
        sa.Column("billing_email", sa.String(length=255), nullable=True),
        sa.Column("customer_name", sa.String(length=255), nullable=True),
        sa.Column("product_id", sa.String(length=120), nullable=True),
        sa.Column("price_id", sa.String(length=120), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="none"),
        sa.Column("current_period_end", sa.DateTime(), nullable=True),
        sa.Column("grace_until", sa.DateTime(), nullable=True),
        sa.Column(
            "cancel_at_period_end",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("seat_limit", sa.Integer(), nullable=True),
        sa.Column("org_code", sa.String(length=50), nullable=True),
        sa.Column("last_event_created_at", sa.Integer(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(
            ["org_code"],
            ["workforce_organizations.org_code"],
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("stripe_customer_id"),
        sa.UniqueConstraint("stripe_subscription_id"),
    )
    op.create_index(
        "ix_oww_stripe_entitlements_billing_email",
        "oww_stripe_entitlements",
        ["billing_email"],
    )
    op.create_index(
        "ix_oww_stripe_entitlements_status",
        "oww_stripe_entitlements",
        ["status"],
    )
    op.create_index(
        "ix_oww_stripe_entitlements_org_code",
        "oww_stripe_entitlements",
        ["org_code"],
    )
    op.create_index(
        "ix_oww_stripe_entitlements_product_id",
        "oww_stripe_entitlements",
        ["product_id"],
    )
    op.create_index(
        "ix_oww_stripe_entitlements_price_id",
        "oww_stripe_entitlements",
        ["price_id"],
    )

    op.create_table(
        "stripe_webhook_events",
        sa.Column("event_id", sa.String(length=120), primary_key=True),
        sa.Column("event_type", sa.String(length=120), nullable=False),
        sa.Column("stripe_created_at", sa.Integer(), nullable=True),
        sa.Column(
            "processed_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_stripe_webhook_events_event_type",
        "stripe_webhook_events",
        ["event_type"],
    )

    op.create_table(
        "auth_magic_tokens",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column(
            "purpose",
            sa.String(length=64),
            nullable=False,
            server_default="activate",
        ),
        sa.Column("otp_code_hash", sa.String(length=128), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("consumed_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_auth_magic_tokens_email", "auth_magic_tokens", ["email"])
    op.create_index("ix_auth_magic_tokens_expires_at", "auth_magic_tokens", ["expires_at"])

    op.create_table(
        "org_link_requests",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("requester_email", sa.String(length=255), nullable=False),
        sa.Column("requester_user_id", sa.Integer(), nullable=True),
        sa.Column("billing_email", sa.String(length=255), nullable=True),
        sa.Column("stripe_customer_id", sa.String(length=120), nullable=True),
        sa.Column("org_code", sa.String(length=50), nullable=True),
        sa.Column("pwsid", sa.String(length=20), nullable=True),
        sa.Column("state_code", sa.String(length=2), nullable=True),
        sa.Column(
            "request_type",
            sa.String(length=40),
            nullable=False,
            server_default="billing_mismatch",
        ),
        sa.Column(
            "status",
            sa.String(length=40),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("approval_token_hash", sa.String(length=128), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("decided_by_user_id", sa.Integer(), nullable=True),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(["requester_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["org_code"],
            ["workforce_organizations.org_code"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(["decided_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("approval_token_hash"),
    )
    op.create_index(
        "ix_org_link_requests_requester_email",
        "org_link_requests",
        ["requester_email"],
    )
    op.create_index("ix_org_link_requests_status", "org_link_requests", ["status"])
    op.create_index("ix_org_link_requests_pwsid", "org_link_requests", ["pwsid"])

    op.add_column(
        "workforce_organizations",
        sa.Column("entitlement_status", sa.String(length=40), nullable=True),
    )
    op.add_column(
        "workforce_organizations",
        sa.Column("entitlement_source", sa.String(length=40), nullable=True),
    )
    op.add_column(
        "workforce_organizations",
        sa.Column("stripe_subscription_id", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "workforce_organizations",
        sa.Column("current_period_end", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "workforce_organizations",
        sa.Column("grace_until", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "workforce_organizations",
        sa.Column("seat_limit", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("workforce_organizations", "seat_limit")
    op.drop_column("workforce_organizations", "grace_until")
    op.drop_column("workforce_organizations", "current_period_end")
    op.drop_column("workforce_organizations", "stripe_subscription_id")
    op.drop_column("workforce_organizations", "entitlement_source")
    op.drop_column("workforce_organizations", "entitlement_status")
    op.drop_table("org_link_requests")
    op.drop_table("auth_magic_tokens")
    op.drop_table("stripe_webhook_events")
    op.drop_table("oww_stripe_entitlements")
