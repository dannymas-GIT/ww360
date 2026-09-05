"""Workforce doc pack stub."""

from fastapi import HTTPException

from app.core.config import settings


class WorkforceDocPackService:
    def __init__(self, db=None):
        self.db = db

    def generate_pack(self, district_code: str, user_id: int):
        if not settings.WW360_DOC_STUDIO_ENABLED:
            raise HTTPException(status_code=501, detail="Doc packs are not enabled on WW360")
        raise NotImplementedError
