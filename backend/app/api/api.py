"""WW360 API router (workforce + public + sync + auth + sdwis)."""

from fastapi import APIRouter

from app.api.endpoints import documentation_tasks, notifications, sdwis, workforce_crud_routes, workforce_succession
from app.api.v1.endpoints import (
    admin_users,
    auth,
    digital_analytics,
    districts,
    doc_studio,
    jurisdiction_admin,
    jurisdictions,
    sync,
    tenant,
    ww360_public,
)

api_router = APIRouter()

api_router.include_router(
    ww360_public.router,
    prefix="/public/ww360",
    tags=["ww360-public"],
)
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["auth"],
)
api_router.include_router(
    sync.router,
    tags=["sync"],
)
api_router.include_router(
    districts.router,
    tags=["districts"],
)
api_router.include_router(
    tenant.router,
    tags=["tenant"],
)
api_router.include_router(
    admin_users.router,
    tags=["admin"],
)
api_router.include_router(
    jurisdiction_admin.router,
    tags=["admin"],
)
api_router.include_router(
    jurisdictions.router,
    tags=["jurisdictions"],
)
api_router.include_router(
    sdwis.router,
    prefix="/sdwis",
    tags=["sdwis"],
)
api_router.include_router(
    digital_analytics.router,
    prefix="/analytics",
    tags=["analytics"],
)
api_router.include_router(
    doc_studio.router,
    prefix="/doc-studio",
    tags=["doc-studio"],
)
api_router.include_router(
    workforce_succession.router,
    prefix="/workforce-succession",
    tags=["workforce-succession"],
)
api_router.include_router(
    workforce_crud_routes.router,
    prefix="/workforce-succession",
    tags=["workforce-crud"],
)
api_router.include_router(
    documentation_tasks.router,
    prefix="/documentation-tasks",
    tags=["documentation-tasks"],
)
api_router.include_router(
    notifications.router,
    prefix="/notifications",
    tags=["notifications"],
)
