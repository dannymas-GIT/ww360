"""
Base class for SQLAlchemy models
This file re-exports the Base from database.py to ensure a consistent entry point
"""

# Re-export Base for convenience
# All models should import Base from here
# DO NOT create a new Base instance in this file

# These are just metadata configuration options that can be applied to the Base
# defined in database.py if needed

from sqlalchemy import MetaData

# Define naming convention for constraints to ensure Alembic compatibility
# https://alembic.sqlalchemy.org/en/latest/naming.html
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# This metadata object can be used by Alembic for migrations
metadata_obj = MetaData(naming_convention=convention)

# Note: We're using the Base from database.py
# This is just additional configuration for the metadata

# Re-export Base from database.py so models can import from here
from app.db.database import Base  # noqa: F401, E402
