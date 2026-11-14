from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+psycopg://portfolio:portfolio@localhost:5432/portfolio"
    process_role: Literal["api", "worker"] = "api"
    worker_database_url: str = ""
    rebuild_on_publish: bool = False
    vercel_deploy_hook: str = Field(default="", repr=False)
    worker_poll_seconds: float = Field(default=15, ge=2, le=300)
    queue_enabled: bool = False
    cron_secret: str = Field(default="", repr=False)
    environment: Literal["development", "production", "test"] = "development"
    session_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    owner_github_id: int = 0
    backend_origin: str = "http://localhost:8000"
    frontend_origin: str = "http://localhost:4321"
    github_webhook_secret: str = ""
    openai_api_key: str = ""
    openai_model: str = ""

    @field_validator("database_url", "worker_database_url", mode="before")
    @classmethod
    def postgres_driver(cls, value):
        if isinstance(value, str):
            for prefix in ("postgres://", "postgresql://"):
                if value.startswith(prefix):
                    return "postgresql+psycopg://" + value[len(prefix) :]
        return value

    @field_validator("vercel_deploy_hook")
    @classmethod
    def trusted_hook(cls, value):
        if value:
            url = urlsplit(value)
            if (
                url.scheme != "https"
                or url.netloc != "api.vercel.com"
                or not url.path.startswith("/v1/integrations/deploy/")
            ):
                raise ValueError("Use a Vercel HTTPS Deploy Hook URL")
        return value

    @model_validator(mode="after")
    def production(self):
        if self.environment == "production" and self.process_role == "worker":
            if not self.worker_database_url.startswith("postgresql+psycopg://"):
                raise ValueError("Production worker requires a separate WORKER_DATABASE_URL")
            return self
        if self.environment == "production":
            if len(self.session_secret) < 32 or self.owner_github_id <= 0:
                raise ValueError("Production requires a strong SESSION_SECRET and OWNER_GITHUB_ID")
            if not self.github_client_id or not self.github_client_secret:
                raise ValueError("Production requires GitHub OAuth credentials")
            if not all(x.startswith("https://") for x in (self.backend_origin, self.frontend_origin)):
                raise ValueError("Production origins must use HTTPS")
            if not self.database_url.startswith("postgresql"):
                raise ValueError("Production requires PostgreSQL")
        return self


@lru_cache
def settings():
    return Settings()
