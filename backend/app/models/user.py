"""WW360 local user accounts (standalone login + optional AquaSafe link)."""

from datetime import datetime

from app.core.security import get_password_hash
from app.db.base_class import Base
from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    hashed_password = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    roles = Column(JSONB, nullable=False, default=list)
    district_memberships = Column(JSONB, nullable=False, default=list)
    is_active = Column(Boolean, default=True, nullable=False)
    # External IdP links — never use these as JWT `sub` (local `id` is the surrogate).
    aquasafe_user_id = Column(Integer, nullable=True, unique=True, index=True)
    oww_user_id = Column(String(64), nullable=True, unique=True, index=True)
    sso_provider = Column(String(50), nullable=True, index=True)
    sso_subject = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def set_password(self, password: str) -> None:
        self.hashed_password = get_password_hash(password)


def ensure_user_schema(engine) -> None:
    """Idempotently add columns introduced after the original users table.

    Prefer Alembic when ``WW360_USE_ALEMBIC=true``; this remains for local/dev
    bootstraps that still use create_all.
    """
    from sqlalchemy import text

    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS district_memberships JSONB NOT NULL DEFAULT '[]'::jsonb",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_provider VARCHAR(50)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_subject VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS oww_user_id VARCHAR(64)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS aquasafe_user_id INTEGER",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_oww_user_id ON users (oww_user_id) WHERE oww_user_id IS NOT NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_aquasafe_user_id ON users (aquasafe_user_id) WHERE aquasafe_user_id IS NOT NULL",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


WW360User = User  # compatibility alias
