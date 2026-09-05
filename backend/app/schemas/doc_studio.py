"""Doc Studio schema stubs."""

from pydantic import BaseModel


class DocDocumentRead(BaseModel):
    id: int
    title: str = ""
