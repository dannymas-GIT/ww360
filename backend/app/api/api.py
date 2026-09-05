"""WW360 API router (workforce + public + sync + auth + sdwis)."""

from fastapi import APIRouter

from app.api.endpoints import sdwis, workforce_crud_routes, workforce_succession
from app.api.v1.endpoints import admin_users, auth, districts, sync, tenant, ww360_public

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
    sdwis.router,
    prefix="/sdwis",
    tags=["sdwis"],
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
