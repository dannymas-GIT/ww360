"""WW360 application settings."""

from __future__ import annotations

import os
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Water Workforce 360"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("1", "true", "yes")

    # Database
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "ww360")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "ww360")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "ww360")

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # JWT (WW360-issued after AquaSafe handoff redeem)
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
    JWT_ALGORITHM: str = "HS256"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

    # AquaSafe integration
    AQUASAFE_INTEGRATION_BASE_URL: str = os.getenv(
        "AQUASAFE_INTEGRATION_BASE_URL", "http://127.0.0.1:8001"
    )
    WW360_SERVICE_TOKEN: str = os.getenv("WW360_SERVICE_TOKEN", "")
    WW360_SYNC_HMAC_SECRET: str = os.getenv("WW360_SYNC_HMAC_SECRET", "")

    # CORS / hosts
    APP_DOMAIN: str = os.getenv("APP_DOMAIN", "waterworkforce360.org")
    EXTRA_CORS_ORIGINS: str = os.getenv("EXTRA_CORS_ORIGINS", "")
    EXTRA_TRUSTED_HOSTS: str = os.getenv("EXTRA_TRUSTED_HOSTS", "")

    WW360_ACCESS_REQUEST_TO: str = os.getenv("WW360_ACCESS_REQUEST_TO", "dmas@omnitech-solutions.us")
    EMAIL_ENABLED: bool = os.getenv("EMAIL_ENABLED", "false").lower() in ("1", "true", "yes")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "noreply@waterworkforce360.org")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Water Workforce 360")

    # SDWIS / EPA ECHO
    SDWIS_API_BASE_URL: str = os.getenv("SDWIS_API_BASE_URL", "https://echodata.epa.gov/echo")
    SDWIS_SYNC_ENABLED: bool = os.getenv("SDWIS_SYNC_ENABLED", "true").lower() in ("1", "true", "yes")
    SDWIS_REQUEST_TIMEOUT_SECONDS: float = float(os.getenv("SDWIS_REQUEST_TIMEOUT_SECONDS", "45"))
    SDWIS_MAX_LOOKUP_PAGES: int = int(os.getenv("SDWIS_MAX_LOOKUP_PAGES", "50"))
    SDWIS_LOOKUP_FILTERED_MAX_PAGES: int = int(os.getenv("SDWIS_LOOKUP_FILTERED_MAX_PAGES", "3"))
    SDWIS_LOOKUP_UNFILTERED_MAX_PAGES: int = int(os.getenv("SDWIS_LOOKUP_UNFILTERED_MAX_PAGES", "5"))
    SDWIS_LOOKUP_MIN_QUERY_LEN: int = int(os.getenv("SDWIS_LOOKUP_MIN_QUERY_LEN", "2"))
    WW360_SDWIS_STATES: str = os.getenv("WW360_SDWIS_STATES", "NY")
    WW360_DOC_STUDIO_ENABLED: bool = os.getenv("WW360_DOC_STUDIO_ENABLED", "false").lower() in (
        "1",
        "true",
        "yes",
    )

    @property
    def sdwis_states(self) -> List[str]:
        return [s.strip().upper() for s in self.WW360_SDWIS_STATES.split(",") if s.strip()]

    @property
    def cors_origins(self) -> List[str]:
        base = [
            f"https://{self.APP_DOMAIN}",
            f"http://{self.APP_DOMAIN}",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
        ]
        if self.EXTRA_CORS_ORIGINS:
            base.extend(x.strip() for x in self.EXTRA_CORS_ORIGINS.split(",") if x.strip())
        return list(dict.fromkeys(base))

    @property
    def trusted_hosts(self) -> List[str]:
        base = [self.APP_DOMAIN, "localhost", "127.0.0.1"]
        if self.EXTRA_TRUSTED_HOSTS:
            base.extend(x.strip() for x in self.EXTRA_TRUSTED_HOSTS.split(",") if x.strip())
        return list(dict.fromkeys(base))

    class Config:
        case_sensitive = True


settings = Settings()


def jwt_signing_key() -> str:
    """JWT verify/sign key (JWT_SECRET_KEY, else SECRET_KEY)."""
    return settings.JWT_SECRET_KEY or settings.SECRET_KEY or "change-me-in-production"
