"""WW360 application settings."""

from __future__ import annotations

from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")

    PROJECT_NAME: str = "Water Workforce 360"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False

    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: str = "5432"
    POSTGRES_USER: str = "ww360"
    POSTGRES_PASSWORD: str = "ww360"
    POSTGRES_DB: str = "ww360"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    AQUASAFE_INTEGRATION_BASE_URL: str = "http://127.0.0.1:8001"
    WW360_SERVICE_TOKEN: str = ""
    WW360_SYNC_HMAC_SECRET: str = ""

    APP_DOMAIN: str = "waterworkforce360.org"
    EXTRA_CORS_ORIGINS: str = ""
    EXTRA_TRUSTED_HOSTS: str = ""

    WW360_ACCESS_REQUEST_TO: str = "dmas@omnitech-solutions.us"
    EMAIL_ENABLED: bool = False
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@waterworkforce360.org"
    SMTP_FROM_NAME: str = "Water Workforce 360"

    SDWIS_API_BASE_URL: str = "https://echodata.epa.gov/echo"
    SDWIS_SYNC_ENABLED: bool = True
    SDWIS_REQUEST_TIMEOUT_SECONDS: float = 45.0
    SDWIS_MAX_LOOKUP_PAGES: int = 50
    SDWIS_LOOKUP_FILTERED_MAX_PAGES: int = 3
    SDWIS_LOOKUP_UNFILTERED_MAX_PAGES: int = 5
    SDWIS_LOOKUP_MIN_QUERY_LEN: int = 2
    WW360_SDWIS_STATES: str = "NY"
    WW360_DOC_STUDIO_ENABLED: bool = False

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


settings = Settings()


def jwt_signing_key() -> str:
    return settings.JWT_SECRET_KEY or settings.SECRET_KEY or "change-me-in-production"
