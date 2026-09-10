"""Refresh cached EPA state landscape into sdwis_state_systems."""

from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.sdwis_state_system import SDWISStateSystem
from app.services.sdwis_client import SDWISClient, SDWISClientError

logger = logging.getLogger(__name__)


def refresh_state_landscape(db: Session, state_code: str) -> int:
    state_code = state_code.upper()[:2]
    client = SDWISClient()
    try:
        rows = client.fetch_all_active_systems(state_code, max_pages=settings.SDWIS_MAX_LOOKUP_PAGES)
    except SDWISClientError as e:
        logger.error("State landscape refresh failed for %s: %s", state_code, e)
        raise
    finally:
        client.close()

    now = datetime.utcnow()
    db.query(SDWISStateSystem).filter(SDWISStateSystem.state_code == state_code).delete(
        synchronize_session=False
    )

    count = 0
    for row in rows:
        pid = str(row.get("PWSId") or row.get("PWSID") or "").strip().upper()
        if not pid:
            continue
        pop = row.get("PopulationServedCount")
        try:
            pop_int = int(pop) if pop is not None else None
        except (TypeError, ValueError):
            pop_int = None

        db.add(
            SDWISStateSystem(
                state_code=state_code,
                pwsid=pid,
                pws_name=row.get("PWSName"),
                county=(row.get("CountiesServed") or "").split(",")[0].strip() or None,
                pws_type=row.get("PWSTypeCode") or row.get("PWSTypeDesc"),
                owner_type=row.get("OwnerDesc") or row.get("OwnerTypeCode"),
                population_served=pop_int,
                serious_violator=row.get("SeriousViolator"),
                health_flag=row.get("HealthFlag"),
                snc=row.get("SNC"),
                qtrs_with_vio=int(row.get("QtrsWithVio") or 0) if row.get("QtrsWithVio") is not None else None,
                qtrs_with_snc=int(row.get("QtrsWithSNC") or 0) if row.get("QtrsWithSNC") is not None else None,
                last_refreshed=now,
            )
        )
        count += 1

    db.commit()
    return count


def refresh_configured_states(db: Session) -> dict[str, int]:
    results = {}
    for st in settings.sdwis_states:
        try:
            results[st] = refresh_state_landscape(db, st)
        except Exception as e:
            logger.warning("SDWIS refresh skipped for %s: %s", st, e)
    return results
