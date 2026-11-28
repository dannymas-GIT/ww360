"""OWW Stripe entitlement cache, webhook idempotency, magic links, org link requests."""

from __future__ import annotations

import uuid

from app.db.base_class import Base
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func


def _uuid() -> str:
    return str(uuid.uuid4())


class OwwStripeEntitlement(Base):
    """Local cache of OWW Stripe subscription entitlement (webhook + reconcile fed)."""

    __tablename__ = "oww_stripe_entitlements"

    id = Column(String(36), primary_key=True, default=_uuid)
    stripe_customer_id = Column(String(120), nullable=False, unique=True, index=True)
    stripe_subscription_id = Column(String(120), nullable=True, unique=True, index=True)
    billing_email = Column(String(255), nullable=True, index=True)
    customer_name = Column(String(255), nullable=True)
    product_id = Column(String(120), nullable=True, index=True)
    price_id = Column(String(120), nullable=True, index=True)
    status = Column(String(40), nullable=False, default="none", index=True)
    current_period_end = Column(DateTime, nullable=True)
    grace_until = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, nullable=False, default=False)
    seat_limit = Column(Integer, nullable=True)
    org_code = Column(
        String(50),
        ForeignKey("workforce_organizations.org_code", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    last_event_created_at = Column(Integer, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class StripeWebhookEvent(Base):
    """Idempotency log for Stripe webhook deliveries."""

    __tablename__ = "stripe_webhook_events"

    event_id = Column(String(120), primary_key=True)
    event_type = Column(String(120), nullable=False, index=True)
    stripe_created_at = Column(Integer, nullable=True)
    processed_at = Column(DateTime, server_default=func.now(), nullable=False)


class AuthMagicToken(Base):
    """Single-use magic-link / OTP tokens for /activate and email verification."""

    __tablename__ = "auth_magic_tokens"

    id = Column(String(36), primary_key=True, default=_uuid)
    email = Column(String(255), nullable=False, index=True)
    token_hash = Column(String(128), nullable=False, unique=True, index=True)
    purpose = Column(String(64), nullable=False, default="activate")
    otp_code_hash = Column(String(128), nullable=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    consumed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class OrgLinkRequest(Base):
    """Billing-email mismatch / PWSID claim approval queue."""

    __tablename__ = "org_link_requests"
    __table_args__ = (
        UniqueConstraint(
            "requester_email",
            "stripe_customer_id",
            "status",
            name="uq_org_link_req_email_customer_status",
        ),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    requester_email = Column(String(255), nullable=False, index=True)
    requester_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    billing_email = Column(String(255), nullable=True, index=True)
    stripe_customer_id = Column(String(120), nullable=True, index=True)
    org_code = Column(
        String(50),
        ForeignKey("workforce_organizations.org_code", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    pwsid = Column(String(20), nullable=True, index=True)
    state_code = Column(String(2), nullable=True)
    request_type = Column(String(40), nullable=False, default="billing_mismatch")
    status = Column(String(40), nullable=False, default="pending", index=True)
    approval_token_hash = Column(String(128), nullable=True, unique=True)
    notes = Column(Text, nullable=True)
    decided_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    decided_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


def ensure_stripe_entitlement_schema(engine) -> None:  # noqa: C901
    """Idempotent DDL for Stripe entitlement tables + workforce_organizations columns."""
    from sqlalchemy import text

    statements = [
        """
        CREATE TABLE IF NOT EXISTS oww_stripe_entitlements (
            id VARCHAR(36) PRIMARY KEY,
            stripe_customer_id VARCHAR(120) NOT NULL UNIQUE,
            stripe_subscription_id VARCHAR(120) UNIQUE,
            billing_email VARCHAR(255),
            customer_name VARCHAR(255),
            product_id VARCHAR(120),
            price_id VARCHAR(120),
            status VARCHAR(40) NOT NULL DEFAULT 'none',
            current_period_end TIMESTAMP,
            grace_until TIMESTAMP,
            cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
            seat_limit INTEGER,
            org_code VARCHAR(50) REFERENCES workforce_organizations(org_code) ON DELETE SET NULL,
            last_event_created_at INTEGER,
            last_synced_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_oww_stripe_ent_billing_email ON oww_stripe_entitlements (billing_email)",
        "CREATE INDEX IF NOT EXISTS ix_oww_stripe_ent_status ON oww_stripe_entitlements (status)",
        "CREATE INDEX IF NOT EXISTS ix_oww_stripe_ent_org_code ON oww_stripe_entitlements (org_code)",
        """
        CREATE TABLE IF NOT EXISTS stripe_webhook_events (
            event_id VARCHAR(120) PRIMARY KEY,
            event_type VARCHAR(120) NOT NULL,
            stripe_created_at INTEGER,
            processed_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_stripe_webhook_events_type ON stripe_webhook_events (event_type)",
        """
        CREATE TABLE IF NOT EXISTS auth_magic_tokens (
            id VARCHAR(36) PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            token_hash VARCHAR(128) NOT NULL UNIQUE,
            purpose VARCHAR(64) NOT NULL DEFAULT 'activate',
            otp_code_hash VARCHAR(128),
            expires_at TIMESTAMP NOT NULL,
            consumed_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_auth_magic_tokens_email ON auth_magic_tokens (email)",
        "CREATE INDEX IF NOT EXISTS ix_auth_magic_tokens_expires ON auth_magic_tokens (expires_at)",
        """
        CREATE TABLE IF NOT EXISTS org_link_requests (
            id VARCHAR(36) PRIMARY KEY,
            requester_email VARCHAR(255) NOT NULL,
            requester_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            billing_email VARCHAR(255),
            stripe_customer_id VARCHAR(120),
            org_code VARCHAR(50) REFERENCES workforce_organizations(org_code) ON DELETE SET NULL,
            pwsid VARCHAR(20),
            state_code VARCHAR(2),
            request_type VARCHAR(40) NOT NULL DEFAULT 'billing_mismatch',
            status VARCHAR(40) NOT NULL DEFAULT 'pending',
            approval_token_hash VARCHAR(128) UNIQUE,
            notes TEXT,
            decided_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            decided_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_org_link_requests_requester ON org_link_requests (requester_email)",
        "CREATE INDEX IF NOT EXISTS ix_org_link_requests_status ON org_link_requests (status)",
        "ALTER TABLE workforce_organizations ADD COLUMN IF NOT EXISTS entitlement_status VARCHAR(40)",
        "ALTER TABLE workforce_organizations ADD COLUMN IF NOT EXISTS entitlement_source VARCHAR(40)",
        "ALTER TABLE workforce_organizations ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(120)",
        "ALTER TABLE workforce_organizations ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP",
        "ALTER TABLE workforce_organizations ADD COLUMN IF NOT EXISTS grace_until TIMESTAMP",
        "ALTER TABLE workforce_organizations ADD COLUMN IF NOT EXISTS seat_limit INTEGER",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
