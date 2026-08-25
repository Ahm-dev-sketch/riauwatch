"""Application settings using pydantic-settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str

    # External API keys (optional)
    firms_map_key: str | None = None
    openaq_api_key: str | None = None

    # Logging
    log_level: str = "INFO"

    # Ingestion
    ingest_lookback_hours: int = 48

    # FIRMS bbox for Riau (west,south,east,north) — approximate, configurable
    riau_bbox: str = "99.5,-2.0,103.0,2.5"


settings = Settings()  # type: ignore[call-arg]
