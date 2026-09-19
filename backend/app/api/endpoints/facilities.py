"""District facility registry (ExtFacility) endpoints."""

from fastapi import APIRouter

from app.api.endpoints.npdes import list_ext_facilities

router = APIRouter()
router.add_api_route(
    "",
    list_ext_facilities,
    methods=["GET"],
    name="list_facilities",
)
