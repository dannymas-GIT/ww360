"""Doc Studio stubs (disabled until doc-editor is packaged)."""

from fastapi import HTTPException

from app.core.config import settings


class DocStudioService:
    def __init__(self, db=None):
        self.db = db

    def _doc_with_lock_name(self, doc, user_id):
        return doc

    def get_document(self, *args, **kwargs):
        if not settings.WW360_DOC_STUDIO_ENABLED:
            raise HTTPException(status_code=501, detail="Doc Studio is not enabled on WW360")
        raise NotImplementedError
