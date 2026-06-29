from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="RQST_", extra="ignore")

    app_name: str = "RQST API"
    environment: Literal["local", "test", "staging", "production"] = "local"
    api_prefix: str = "/api/v1"
    secret_key: str = Field(default="dev-secret-change-me", min_length=16)
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    database_url: str = "sqlite:///./rqst.db"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:8081"]
    polar_webhook_secret: str = "polar-dev-secret"
    platform_fee_bps: int = 1200
    currency: str = "USD"


@lru_cache
def get_settings() -> Settings:
    return Settings()

