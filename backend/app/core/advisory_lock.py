"""PostgreSQL session-level advisory locks for multi-worker APScheduler safety."""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


@contextmanager
def pg_try_advisory_lock(db: Session, lock_key: int) -> Iterator[bool]:
    """Yield True if this process acquired the advisory lock; always unlock on exit."""
    acquired = False
    try:
        row = db.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": int(lock_key)}).scalar()
        acquired = bool(row)
        yield acquired
    finally:
        if acquired:
            try:
                db.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": int(lock_key)})
                db.commit()
            except Exception as exc:
                logger.debug("advisory unlock failed for %s: %s", lock_key, exc)
                try:
                    db.rollback()
                except Exception:
                    pass
