"""Water Workforce 360 FastAPI application."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.api import api_router
from app.core.config import settings
from app.db import base
from app.db.database import init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

base.import_models()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("WW360 backend starting")
    try:
        init_db()
    except Exception as exc:
        logger.warning("DB init skipped or failed: %s", exc)
    yield
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
