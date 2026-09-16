"""Application settings using pydantic-settings."""

import json

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

    # Open-Meteo settings
    open_meteo_past_days: int = 7
    open_meteo_forecast_days: int = 3

    # OpenAQ settings
    openaq_bbox: str = "99.5,-2.0,103.0,2.5"

    # API settings (accepts comma-separated string or list)
    frontend_origins: str | list[str] = "http://localhost:3000"
    rate_limit_per_minute: int = 60
    degraded_after_consecutive_failures: int = 3
    running_stale_timeout_minutes: int = 240  # 2x expected cadence (2h * 2 = 4h)

    def get_frontend_origins(self) -> list[str]:
        val = self.frontend_origins
        if isinstance(val, list):
            return val
        if isinstance(val, str):
            if val.startswith("[") and val.endswith("]"):
                try:
                    parsed = json.loads(val)
                    if isinstance(parsed, list):
                        return [str(x) for x in parsed]
                except Exception:
                    pass
            return [x.strip() for x in val.split(",") if x.strip()]
        return ["http://localhost:3000"]


settings = Settings()  # type: ignore[call-arg]
