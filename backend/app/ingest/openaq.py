"""OpenAQ v3 API adapter for air quality ingestion."""

from datetime import UTC, datetime
from typing import Any

import httpx
from geoalchemy2 import WKTElement
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.ingest.runner import IngestionRunner, SourceNotConfiguredError
from app.models import AirQualityObservation, MonitoringStation
from app.settings import settings

# OpenAQ v3 API endpoint
OPENAQ_BASE_URL = "https://api.openaq.org/v3"

# Pollutants we care about
TARGET_POLLUTANTS = ["pm25", "pm10"]


class OpenAQRunner(IngestionRunner):
    """OpenAQ v3 air quality ingestion runner."""

    def __init__(self):
        super().__init__("openaq_v3")
        self.api_key = settings.openaq_api_key
        self.bbox = settings.openaq_bbox

    def fetch(self) -> list[dict]:
        """Fetch locations and latest measurements for Riau bbox."""
        if not self.api_key:
            raise SourceNotConfiguredError("OPENAQ_API_KEY not configured")

        # Set window for logging
        self.window_to = datetime.now(UTC)
        self.window_from = self.window_to

        self.params = {
            "bbox": self.bbox,
            "pollutants": TARGET_POLLUTANTS,
        }

        all_records = []

        # Step 1: Fetch locations in bbox
        locations = self._fetch_locations()
        if not locations:
            return []

        # Step 2: For each location, fetch latest measurements
        for location in locations:
            location_id = location["id"]
            measurements = self._fetch_latest_measurements(location_id)
            for measurement in measurements:
                record = {
                    "location": location,
                    "measurement": measurement,
                }
                all_records.append(record)

        return all_records

    def _fetch_locations(self) -> list[dict[str, Any]]:
        """Fetch locations within the Riau bbox."""
        url = f"{OPENAQ_BASE_URL}/locations"
        params: dict[str, str | int] = {
            "bbox": self.bbox,
            "limit": 1000,
        }
        api_key = self.api_key
        if not api_key:
            raise SourceNotConfiguredError("OPENAQ_API_KEY not configured")
        headers: dict[str, str] = {"X-API-Key": api_key}

        try:
            response = httpx.get(url, params=params, headers=headers, timeout=30.0)
            response.raise_for_status()
            data: dict[str, Any] = response.json()
            results = data.get("results")
            return results if isinstance(results, list) else []
        except httpx.HTTPError as e:
            logger = __import__("logging").getLogger(__name__)
            logger.warning("OpenAQ locations fetch failed", extra={"error": str(e)})
            return []

    def _fetch_latest_measurements(self, location_id: int) -> list[dict[str, Any]]:
        """Fetch latest measurements for a location."""
        url = f"{OPENAQ_BASE_URL}/locations/{location_id}/latest"
        params: dict[str, str] = {
            "parameters": ",".join(TARGET_POLLUTANTS),
        }
        api_key = self.api_key
        if not api_key:
            raise SourceNotConfiguredError("OPENAQ_API_KEY not configured")
        headers: dict[str, str] = {"X-API-Key": api_key}

        try:
            response = httpx.get(url, params=params, headers=headers, timeout=30.0)
            response.raise_for_status()
            data: dict[str, Any] = response.json()
            results = data.get("results")
            return results if isinstance(results, list) else []
        except httpx.HTTPError as e:
            logger = __import__("logging").getLogger(__name__)
            logger.warning(
                "OpenAQ measurements fetch failed",
                extra={"location_id": location_id, "error": str(e)},
            )
            return []

    def validate(self, raw_record: dict) -> tuple[bool, str | None]:
        """Validate an OpenAQ record."""
        if "location" not in raw_record or "measurement" not in raw_record:
            return False, "Missing location or measurement"

        location = raw_record["location"]
        measurement = raw_record["measurement"]

        # Validate location has required fields
        required_location_fields = ["id", "name", "coordinates"]
        for field in required_location_fields:
            if field not in location or not location[field]:
                return False, f"Location missing required field: {field}"

        # Validate coordinates
        coords = location.get("coordinates", {})
        if "latitude" not in coords or "longitude" not in coords:
            return False, "Location missing coordinates"

        try:
            lat = float(coords["latitude"])
            lon = float(coords["longitude"])
            if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
                return False, f"Invalid coordinates: lat={lat}, lon={lon}"
        except (ValueError, TypeError):
            return False, f"Invalid coordinate format: {coords}"

        # Validate measurement
        if "parameter" not in measurement or "value" not in measurement or "lastUpdated" not in measurement:
            return False, "Measurement missing required fields"

        if measurement["parameter"] not in TARGET_POLLUTANTS:
            return False, f"Unwanted pollutant: {measurement['parameter']}"

        try:
            value = float(measurement["value"])
            if value < 0:
                return False, f"Negative value: {value}"
        except (ValueError, TypeError):
            return False, f"Invalid value format: {measurement['value']}"

        # Validate timestamp
        try:
            datetime.fromisoformat(measurement["lastUpdated"].replace("Z", "+00:00"))
        except ValueError:
            return False, f"Invalid timestamp format: {measurement['lastUpdated']}"

        return True, None

    def normalize(self, raw_record: dict) -> dict:
        """Normalize an OpenAQ record to station + observation schema."""
        location = raw_record["location"]
        measurement = raw_record["measurement"]

        coords = location["coordinates"]
        lat = float(coords["latitude"])
        lon = float(coords["longitude"])

        # Station data
        station_data = {
            "source_id": self.source_id,
            "external_id": str(location["id"]),
            "name": location.get("name"),
            "geom": WKTElement(f"POINT({lon} {lat})", srid=4326),
            "area_id": None,  # Will be assigned in transform if needed
            "meta": {
                "country": location.get("country"),
                "city": location.get("city"),
                "is_mobile": location.get("isMobile", False),
                "is_analysis": location.get("isAnalysis", False),
                "entity": location.get("entity"),
                "sensor_type": location.get("sensorType"),
            },
        }

        # Observation data
        observed_at = datetime.fromisoformat(measurement["lastUpdated"].replace("Z", "+00:00"))
        pollutant = measurement["parameter"]
        value = float(measurement["value"])
        unit = measurement.get("unit", "µg/m³")

        observation_data = {
            "station_external_id": str(location["id"]),
            "pollutant": pollutant,
            "value": value,
            "unit": unit,
            "observed_at": observed_at,
            "raw": measurement,
        }

        return {
            "station": station_data,
            "observation": observation_data,
        }

    def store(self, session: Session, normalized_records: list[dict]) -> int:
        """Store stations and observations with proper upsert semantics."""
        if not normalized_records:
            return 0

        inserted_count = 0

        for record in normalized_records:
            station_data = record["station"]
            observation_data = record["observation"]

            # Upsert station: ON CONFLICT (source_id, external_id) DO UPDATE
            station_stmt = pg_insert(MonitoringStation).values(**station_data)
            station_stmt = station_stmt.on_conflict_do_update(
                index_elements=["source_id", "external_id"],
                set_={
                    "name": station_data["name"],
                    "geom": station_data["geom"],
                    "meta": station_data["meta"],
                },
            )
            session.execute(station_stmt)

            # Get the station_id for the observation
            station = session.execute(
                select(MonitoringStation).where(
                    MonitoringStation.source_id == self.source_id,
                    MonitoringStation.external_id == station_data["external_id"],
                )
            ).scalar_one()

            # Upsert observation: ON CONFLICT (station_id, pollutant, observed_at) DO NOTHING (first-wins)
            obs_data = {
                "station_id": station.id,
                "pollutant": observation_data["pollutant"],
                "value": observation_data["value"],
                "unit": observation_data["unit"],
                "observed_at": observation_data["observed_at"],
                "raw": observation_data["raw"],
            }
            obs_stmt = pg_insert(AirQualityObservation).values(**obs_data)
            obs_stmt = obs_stmt.on_conflict_do_nothing(
                index_elements=["station_id", "pollutant", "observed_at"],
            )
            result = session.execute(obs_stmt)
            if result.rowcount is not None and result.rowcount > 0:  # type: ignore[attr-defined]
                inserted_count += 1

        session.commit()
        return inserted_count

    def transform(self, session: Session) -> None:
        """Assign area_id to stations via ST_Covers against kabupaten_kota polygons."""
        # Update stations with area_id where area_id is NULL
        sql = text("""
            UPDATE monitoring_stations s
            SET area_id = a.id
            FROM administrative_areas a
            WHERE s.area_id IS NULL
              AND s.geom IS NOT NULL
              AND a.level = 'kabupaten_kota'
              AND ST_Covers(a.geom, s.geom)
              AND s.source_id = :source_id
        """)
        session.execute(sql, {"source_id": self.source_id})
        session.commit()


def run_openaq() -> None:
    """Entry point for OpenAQ air quality ingestion."""
    runner = OpenAQRunner()
    runner.run()
