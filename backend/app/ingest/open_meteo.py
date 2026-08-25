"""Open-Meteo weather API adapter for weather observations ingestion."""

from datetime import UTC, datetime, timedelta

import httpx
from geoalchemy2 import WKTElement
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.ingest.runner import IngestionRunner
from app.models import AdministrativeArea, WeatherObservation
from app.settings import settings

# Open-Meteo API endpoint
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# Hourly variables we request
HOURLY_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "wind_speed_10m",
    "wind_direction_10m",
]


def classify_is_forecast(valid_time: datetime, reference_time: datetime | None = None) -> bool:
    """
    Classify whether a valid_time is a forecast or analysis (historical).

    Per docs/database.md §4: valid_time ≤ last complete hour ⇒ False (analysis);
    valid_time > last complete hour ⇒ True (forecast).

    The "last complete hour" is the most recent hour boundary that has fully elapsed
    relative to the reference time (defaults to now).
    """
    if reference_time is None:
        reference_time = datetime.now(UTC)

    # Ensure valid_time is timezone-aware (assume UTC if naive)
    if valid_time.tzinfo is None:
        valid_time = valid_time.replace(tzinfo=UTC)

    # Floor reference_time to the last complete hour
    last_complete_hour = reference_time.replace(minute=0, second=0, microsecond=0)
    if reference_time.minute == 0 and reference_time.second == 0 and reference_time.microsecond == 0:
        # If exactly on hour boundary, the last complete hour is the previous hour
        last_complete_hour -= timedelta(hours=1)

    return valid_time > last_complete_hour


class OpenMeteoRunner(IngestionRunner):
    """Open-Meteo weather ingestion runner."""

    def __init__(self, past_days: int | None = None, forecast_days: int | None = None):
        super().__init__("open_meteo")
        self.past_days = past_days or settings.open_meteo_past_days
        self.forecast_days = forecast_days or settings.open_meteo_forecast_days

    def fetch(self) -> list[dict]:
        """Fetch weather data for all kabupaten_kota centroids."""
        # Get all kabupaten_kota areas with centroids
        with self._get_session() as session:
            areas = session.execute(
                select(AdministrativeArea).where(
                    AdministrativeArea.level == "kabupaten_kota",
                    AdministrativeArea.centroid.is_not(None),
                )
            ).scalars().all()

        if not areas:
            return []

        # Set window for logging
        self.window_to = datetime.now(UTC)
        self.window_from = self.window_to - timedelta(days=self.past_days)

        self.params = {
            "past_days": self.past_days,
            "forecast_days": self.forecast_days,
            "variables": HOURLY_VARIABLES,
            "area_count": len(areas),
        }

        all_records = []
        for area in areas:
            # Extract centroid coordinates
            # centroid is a WKTElement, we need to parse it
            # For now, we'll use a simple approach - the centroid should be a POINT
            centroid_wkt = str(area.centroid)
            # Parse POINT(lon lat) format
            try:
                coords = centroid_wkt.replace("POINT(", "").replace(")", "").split()
                lon = float(coords[0])
                lat = float(coords[1])
            except (ValueError, IndexError):
                # Skip areas with invalid centroids
                continue

            url = OPEN_METEO_URL
            params: dict[str, str | int | float] = {
                "latitude": lat,
                "longitude": lon,
                "hourly": ",".join(HOURLY_VARIABLES),
                "past_days": self.past_days,
                "forecast_days": self.forecast_days,
                "timezone": "Asia/Jakarta",
            }

            try:
                response = httpx.get(url, params=params, timeout=30.0)  # type: ignore[arg-type]
                response.raise_for_status()
                data = response.json()
                records = self._parse_response(data, area.id, lat, lon)
                all_records.extend(records)
            except httpx.HTTPError as e:
                logger = __import__("logging").getLogger(__name__)
                logger.warning(
                    "Open-Meteo fetch failed for area",
                    extra={"area_id": area.id, "area_name": area.name, "error": str(e)},
                )

        return all_records

    def _get_session(self) -> Session:
        """Get a database session."""
        from app.db import get_session_factory
        SessionLocal = get_session_factory()
        return SessionLocal()  # type: ignore

    def _parse_response(self, data: dict, area_id: int, lat: float, lon: float) -> list[dict]:
        """Parse Open-Meteo API response into list of raw records."""
        hourly = data.get("hourly", {})
        times = hourly.get("time", [])
        if not times:
            return []

        records = []
        for i, time_str in enumerate(times):
            record = {
                "area_id": area_id,
                "valid_time": time_str,  # ISO8601 string, will parse in normalize
                "latitude": lat,
                "longitude": lon,
            }
            for var in HOURLY_VARIABLES:
                values = hourly.get(var, [])
                if i < len(values):
                    record[var] = values[i]
            records.append(record)

        return records

    def validate(self, raw_record: dict) -> tuple[bool, str | None]:
        """Validate an Open-Meteo record."""
        required_fields = ["area_id", "valid_time", "latitude", "longitude"]
        for field in required_fields:
            if field not in raw_record or raw_record[field] is None:
                return False, f"Missing required field: {field}"

        # Validate valid_time format (ISO8601)
        try:
            datetime.fromisoformat(raw_record["valid_time"].replace("Z", "+00:00"))
        except ValueError:
            return False, f"Invalid valid_time format: {raw_record['valid_time']}"

        # Validate latitude/longitude
        try:
            lat = float(raw_record["latitude"])
            lon = float(raw_record["longitude"])
            if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
                return False, f"Invalid coordinates: lat={lat}, lon={lon}"
        except (ValueError, TypeError):
            return False, f"Invalid lat/lon format: {raw_record.get('latitude')}, {raw_record.get('longitude')}"

        return True, None

    def normalize(self, raw_record: dict) -> dict:
        """Normalize an Open-Meteo record to WeatherObservation schema."""
        area_id = raw_record["area_id"]
        valid_time = datetime.fromisoformat(raw_record["valid_time"].replace("Z", "+00:00"))
        lat = float(raw_record["latitude"])
        lon = float(raw_record["longitude"])

        # Classify as forecast or analysis
        is_forecast = classify_is_forecast(valid_time)

        # Extract weather variables (may be None)
        temperature_c = raw_record.get("temperature_2m")
        humidity_pct = raw_record.get("relative_humidity_2m")
        precipitation_mm = raw_record.get("precipitation")
        wind_speed_kmh = raw_record.get("wind_speed_10m")
        wind_direction_deg = raw_record.get("wind_direction_10m")

        # Build geom as WKTElement
        geom = WKTElement(f"POINT({lon} {lat})", srid=4326)

        return {
            "source_id": self.source_id,
            "area_id": area_id,
            "geom": geom,
            "valid_time": valid_time,
            "is_forecast": is_forecast,
            "temperature_c": temperature_c,
            "humidity_pct": humidity_pct,
            "precipitation_mm": precipitation_mm,
            "wind_speed_kmh": wind_speed_kmh,
            "wind_direction_deg": wind_direction_deg,
            "raw": raw_record,
        }

    def store(self, session: Session, normalized_records: list[dict]) -> int:
        """Upsert weather observations using ON CONFLICT DO UPDATE (latest-cycle-wins)."""
        if not normalized_records:
            return 0

        inserted_count = 0
        for record in normalized_records:
            stmt = pg_insert(WeatherObservation).values(**record)
            # ON CONFLICT DO UPDATE on the unique constraint columns
            # Latest-cycle-wins: update all measure columns + ingested_at
            stmt = stmt.on_conflict_do_update(
                index_elements=["source_id", "area_id", "valid_time", "is_forecast"],
                set_={
                    "temperature_c": record["temperature_c"],
                    "humidity_pct": record["humidity_pct"],
                    "precipitation_mm": record["precipitation_mm"],
                    "wind_speed_kmh": record["wind_speed_kmh"],
                    "wind_direction_deg": record["wind_direction_deg"],
                    "ingested_at": datetime.now(UTC),
                    "raw": record["raw"],
                },
            )
            result = session.execute(stmt)
            if result.rowcount is not None and result.rowcount > 0:  # type: ignore[attr-defined]
                inserted_count += 1

        session.commit()
        return inserted_count

    def transform(self, session: Session) -> None:
        """No post-insert transform needed for weather observations."""
        pass


def run_open_meteo(past_days: int | None = None, forecast_days: int | None = None) -> None:
    """Entry point for Open-Meteo weather ingestion."""
    runner = OpenMeteoRunner(past_days=past_days, forecast_days=forecast_days)
    runner.run()
