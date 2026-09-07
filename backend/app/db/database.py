"""SQLAlchemy database session for WW360."""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_engine(settings.SQLALCHEMY_DATABASE_URI, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app.db import base  # noqa: F401 — register models

    base.import_models()
    Base.metadata.create_all(bind=engine)

    # Patch tables that pre-date their current model (no Alembic history yet).
    from app.models.doc_document import ensure_doc_studio_schema
    from app.models.user import ensure_user_schema
    from app.models.documentation_task import ensure_documentation_task_schema
    from app.models.notification import ensure_notification_schema
    from app.models.water_district import ensure_water_district_schema

    ensure_doc_studio_schema(engine)
    ensure_user_schema(engine)
    ensure_documentation_task_schema(engine)
    ensure_notification_schema(engine)
    ensure_water_district_schema(engine)
