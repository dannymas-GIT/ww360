"""Workforce module package gate — always enabled on WW360 member districts."""

from sqlalchemy.orm import Session


def require_workforce_package_enabled(db: Session, district_code: str) -> None:
    """No-op on WW360: all member districts have workforce enabled."""
    return None
