from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+psycopg://portfolio:portfolio@localhost:5432/portfolio"
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

    @model_validator(mode="after")
    def production(self):
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
