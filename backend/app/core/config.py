from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_prefix="RQST_",
        extra="ignore",
    )

    app_name: str = "RQST API"
    environment: Literal["local", "test", "staging", "production"] = "local"
    auto_complete_payments: bool = True
    api_prefix: str = "/api/v1"
    secret_key: str = Field(default="dev-secret-change-me", min_length=16)
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    database_url: str = "sqlite:///./rqst.db"
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ]
    uploads_dir: Path = BACKEND_DIR / "uploads"
    polar_webhook_secret: str = "polar-dev-secret"
    platform_fee_bps: int = 1200
    currency: str = "USD"
    apple_music_media_id: str = "media.com.rqst.applemusic"
    apple_music_key_id: str = "K3ATP7UXT7"
    apple_music_team_id: str = "GCTR3K3TR2"
    apple_music_developer_token: str | None = None
    apple_music_storefront: str = "us"


@lru_cache
def get_settings() -> Settings:
    return Settings()
