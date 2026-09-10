"""Document storage stub."""

from app.core.config import settings


class DocumentStorageService:
    def __init__(self, db=None):
        self.db = db

    def store(self, *args, **kwargs):
        if not settings.WW360_DOC_STUDIO_ENABLED:
            raise RuntimeError("Document storage disabled on WW360")
        raise NotImplementedError
