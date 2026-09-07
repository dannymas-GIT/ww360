"""Water Workforce 360 FastAPI application."""

import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.api import api_router
from app.core.config import settings
from app.db import base
from app.db.database import SessionLocal, init_db
from app.services.sdwis_state_refresh_service import refresh_configured_states

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

base.import_models()

_scheduler: BackgroundScheduler | None = None


def _run_sdwis_refresh() -> None:
    if not settings.SDWIS_SYNC_ENABLED:
        return
    db = SessionLocal()
    try:
        results = refresh_configured_states(db)
        logger.info("SDWIS state refresh completed: %s", results)
    except Exception as exc:
        logger.warning("SDWIS state refresh failed: %s", exc)
    finally:
        db.close()


def _run_documentation_notifier() -> None:
    db = SessionLocal()
    try:
        from app.services.documentation_task_notifier import run_documentation_task_notifier
        from app.services.documentation_task_service import mark_overdue_tasks
        from app.services.workforce_succession.alert_scanner import scan_all_districts

        mark_overdue_tasks(db)
        run_documentation_task_notifier(db)
        scan_all_districts(db)
    except Exception as exc:
        logger.warning("Documentation / alert job failed: %s", exc)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler
    logger.info("WW360 backend starting")
    try:
        init_db()
    except Exception as exc:
        logger.warning("DB init skipped or failed: %s", exc)

    if settings.SDWIS_SYNC_ENABLED:
        _scheduler = BackgroundScheduler()
        _scheduler.add_job(_run_sdwis_refresh, "cron", hour=3, minute=0, id="sdwis_state_refresh")
        _scheduler.add_job(
            _run_documentation_notifier, "cron", hour=8, minute=0, id="documentation_task_notifier"
        )
        _scheduler.start()
        logger.info("SDWIS nightly refresh scheduled (03:00 UTC)")
        logger.info("Documentation task notifier scheduled (08:00 UTC)")

    yield

    if _scheduler:
        _scheduler.shutdown(wait=False)
    logger.info("WW360 backend stopped")


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.trusted_hosts,
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ww360"}
