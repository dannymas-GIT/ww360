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
