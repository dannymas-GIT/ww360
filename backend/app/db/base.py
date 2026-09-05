"""WW360 model registry for Alembic and SQLAlchemy."""

from app.db.base_class import Base  # noqa: F401


def import_models() -> None:
    import app.models.sync  # noqa: F401
    import app.models.workforce_succession  # noqa: F401
    import app.models.workforce_organization  # noqa: F401
