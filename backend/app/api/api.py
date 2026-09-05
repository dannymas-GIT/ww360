"""WW360 API router (workforce + public + sync)."""

from fastapi import APIRouter

from app.api.endpoints import workforce_crud_routes, workforce_succession
from app.api.v1.endpoints import districts, sync, ww360_public
from app.core.config import settings

api_router = APIRouter()

api_router.include_router(
    ww360_public.router,
    prefix="/public/ww360",
    tags=["ww360-public"],
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
    workforce_succession.router,
    prefix="/workforce-succession",
    tags=["workforce-succession"],
)
api_router.include_router(
    workforce_crud_routes.router,
    prefix="/workforce-succession",
    tags=["workforce-crud"],
)
