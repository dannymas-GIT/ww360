"""OWW handoff codes, referrals, and staff invite tokens."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.db.base_class import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class OwwHandoffCode(Base):
    """One-time browser redeem code after OWW → WW360 server handoff."""

    __tablename__ = "oww_handoff_codes"

    id = Column(String(36), primary_key=True, default=_uuid)
    code = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    org_code = Column(String(50), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    consumed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class OwwReferral(Base):
    """Acknowledgement that OWW referred a candidate to a utility."""

    __tablename__ = "oww_referrals"

    id = Column(String(36), primary_key=True, default=_uuid)
    oww_referral_id = Column(String(64), unique=True, nullable=False, index=True)
    oww_org_id = Column(String(64), nullable=False, index=True)
    org_code = Column(String(50), nullable=True, index=True)
    district_code = Column(String(50), nullable=True, index=True)
    candidate_label = Column(String(255), nullable=True)
    job_title = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default="received")
    payload = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class UserInvite(Base):
    """Email invite token so a utility administrator can add staff without sharing a password."""

    __tablename__ = "user_invites"

    id = Column(String(36), primary_key=True, default=_uuid)
    token = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    full_name = Column(String(255), nullable=True)
    roles = Column(JSONB, nullable=False, default=list)
    district_memberships = Column(JSONB, nullable=False, default=list)
    org_code = Column(String(50), nullable=True, index=True)
    invited_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    accepted_at = Column(DateTime, nullable=True)
    created_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


def ensure_oww_integration_schema(engine) -> None:
    from sqlalchemy import text

    statements = [
        """
        CREATE TABLE IF NOT EXISTS oww_handoff_codes (
            id VARCHAR(36) PRIMARY KEY,
            code VARCHAR(64) NOT NULL UNIQUE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            org_code VARCHAR(50) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            consumed_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_oww_handoff_codes_code ON oww_handoff_codes(code)",
        "CREATE INDEX IF NOT EXISTS ix_oww_handoff_codes_expires_at ON oww_handoff_codes(expires_at)",
        """
        CREATE TABLE IF NOT EXISTS oww_referrals (
            id VARCHAR(36) PRIMARY KEY,
            oww_referral_id VARCHAR(64) NOT NULL UNIQUE,
            oww_org_id VARCHAR(64) NOT NULL,
            org_code VARCHAR(50),
            district_code VARCHAR(50),
            candidate_label VARCHAR(255),
            job_title VARCHAR(255),
            status VARCHAR(50) NOT NULL DEFAULT 'received',
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_oww_referrals_oww_org_id ON oww_referrals(oww_org_id)",
        """
        CREATE TABLE IF NOT EXISTS user_invites (
            id VARCHAR(36) PRIMARY KEY,
            token VARCHAR(64) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL,
            full_name VARCHAR(255),
            roles JSONB NOT NULL DEFAULT '[]'::jsonb,
            district_memberships JSONB NOT NULL DEFAULT '[]'::jsonb,
            org_code VARCHAR(50),
            invited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            expires_at TIMESTAMP NOT NULL,
            accepted_at TIMESTAMP,
            created_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_user_invites_token ON user_invites(token)",
        "CREATE INDEX IF NOT EXISTS ix_user_invites_email ON user_invites(email)",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
