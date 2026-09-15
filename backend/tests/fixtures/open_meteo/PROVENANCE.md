# Fixture Provenance — open_meteo/pekanbaru_forecast.json

- **Source:** Open-Meteo v1 forecast API (https://api.open-meteo.com/v1/forecast)
- **Query:** latitude=-0.5071, longitude=101.4478 (Pekanbaru area point), hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m, past_days=7, forecast_days=3, timezone=Asia/Jakarta
- **Retrieved:** 2026-08-24 (UTC), keyless public request
- **Status:** REAL response captured live — safe to build normalizers against.
- **Caveat:** Response shape reflects the API as of retrieval date; re-verify shape when wiring live ingestion (Phase 3 exit criterion).
- **Usage:** Unit tests for the Open-Meteo adapter (validation, normalization, forecast/analysis boundary classification). Never treat fixture values as current data anywhere in the product.
