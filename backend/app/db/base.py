"""WW360 model registry for Alembic and SQLAlchemy."""

from app.db.base_class import Base  # noqa: F401


def import_models() -> None:
    import app.models.sync  # noqa: F401
    import app.models.user  # noqa: F401 — before workforce (User FK)
    import app.models.water_district  # noqa: F401
    import app.models.workforce_succession  # noqa: F401
    import app.models.workforce_organization  # noqa: F401
    import app.models.sdwis_water_system  # noqa: F401
    import app.models.sdwis_violation  # noqa: F401
    import app.models.sdwis_enforcement_action  # noqa: F401
    import app.models.sdwis_district_remembered_pwsid  # noqa: F401
    import app.models.sdwis_analysis_set  # noqa: F401
    import app.models.sdwis_state_system  # noqa: F401
    import app.models.doc_document  # noqa: F401
    import app.models.documentation_task  # noqa: F401
    import app.models.notification  # noqa: F401
    import app.models.impersonation  # noqa: F401
    import app.models.national_metrics  # noqa: F401
    import app.models.workspace_customization  # noqa: F401
