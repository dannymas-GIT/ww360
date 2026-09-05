"""Minimal doc studio tables for workforce FK compatibility (stub)."""

from sqlalchemy import Column, Integer, String

from app.db.base_class import Base


class DocDocument(Base):
    __tablename__ = "doc_documents"

    id = Column(String(36), primary_key=True)
    title = Column(String(500), nullable=True)
