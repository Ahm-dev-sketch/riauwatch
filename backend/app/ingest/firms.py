"""NASA FIRMS area API adapter for hotspot ingestion."""

import csv
import io
from datetime import UTC, datetime, timedelta

import httpx
from geoalchemy2 import WKTElement
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.ingest.runner import IngestionRunner, SourceNotConfiguredError
from app.models import Hotspot
from app.settings import settings

# FIRMS source identifiers
FIRMS_SOURCES = [
    "VIIRS_SNPP_NRT",
    "VIIRS_NOAA20_NRT",
    "MODIS_NRT",
]

# MODIS confidence mapping: 0-100 -> l/n/h
# Using a function for clarity (see modis_confidence_to_category)
CONFIDENCE_MAP_MODIS: dict[int, str] = {}


def modis_confidence_to_category(value: int | float) -> str:
    """Map MODIS confidence 0-100 to VIIRS-style l/n/h."""
    if value < 30:
        return "l"
    elif value < 80:
        return "n"
    else:
        return "h"


def parse_acq_time(acq_time_str: str) -> tuple[int, int]:
    """Parse FIRMS acq_time (HHMM format, zero-padding not guaranteed) to (hour, minute).

    Examples:
      - '30' -> 00:30 -> (0, 30)
      - '630' -> 06:30 -> (6, 30)
      - '1425' -> 14:25 -> (14, 25)
      - '0' -> 00:00 -> (0, 0)
    """
    clean_str = acq_time_str.strip()
    if not clean_str.isdigit():
        raise ValueError(f"Invalid acq_time: {acq_time_str}")
    padded = clean_str.zfill(4)
    hours = int(padded[:2])
    minutes = int(padded[2:])
    if not (0 <= hours <= 23 and 0 <= minutes <= 59):
        raise ValueError(f"Invalid time components in acq_time '{acq_time_str}': hour={hours}, minute={minutes}")
    return hours, minutes


def parse_acq_datetime(acq_date: str, acq_time: str) -> datetime:
    """Parse FIRMS acq_date (YYYY-MM-DD) and acq_time (HHMM) to UTC datetime."""
    hours, minutes = parse_acq_time(acq_time)
    base_date = datetime.strptime(acq_date.strip(), "%Y-%m-%d").replace(tzinfo=UTC)
    return base_date.replace(hour=hours, minute=minutes)


class FIRMSRunner(IngestionRunner):
    """FIRMS hotspot ingestion runner."""

    def __init__(self):
        super().__init__("firms_viirs_nrt")  # primary source key; we'll fetch all sources
        self.map_key = settings.firms_map_key
        self.bbox = settings.riau_bbox
        self.lookback_hours = settings.ingest_lookback_hours

    def fetch(self) -> list[dict]:
        """Fetch FIRMS CSV data for all configured sources."""
        if not self.map_key:
            raise SourceNotConfiguredError("FIRMS_MAP_KEY not configured")

        # Calculate day_range from lookback_hours (minimum 2 days for 48h)
        day_range = max(2, (self.lookback_hours + 23) // 24)

        # Set window for logging
        self.window_to = datetime.now(UTC)
        self.window_from = self.window_to - timedelta(hours=self.lookback_hours)

        self.params = {
            "bbox": self.bbox,
            "day_range": day_range,
            "sources": FIRMS_SOURCES,
        }

        all_records = []
        for source in FIRMS_SOURCES:
            url = (
                f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
                f"{self.map_key}/{source}/{self.bbox}/{day_range}"
            )
            try:
                response = httpx.get(url, timeout=30.0)
                response.raise_for_status()
                records = self._parse_csv(response.text, source)
                all_records.extend(records)
            except httpx.HTTPError as e:
                # Log but continue with other sources
                logger = __import__("logging").getLogger(__name__)
                logger.warning(
                    "FIRMS fetch failed for source",
                    extra={"source": source, "error": str(e)},
                )

        return all_records

    def _parse_csv(self, csv_text: str, source: str) -> list[dict]:
        """Parse FIRMS CSV text into list of dicts (header-driven)."""
        records = []
        reader = csv.DictReader(io.StringIO(csv_text))
        for row in reader:
            row["_firms_source"] = source
            records.append(row)
        return records

    def validate(self, raw_record: dict) -> tuple[bool, str | None]:
        """Validate a FIRMS record."""
        required_fields = ["latitude", "longitude", "acq_date", "acq_time", "satellite"]
        for field in required_fields:
            if field not in raw_record or not raw_record[field]:
                return False, f"Missing required field: {field}"

        # Validate latitude/longitude
        try:
            lat = float(raw_record["latitude"])
            lon = float(raw_record["longitude"])
            if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
                return False, f"Invalid coordinates: lat={lat}, lon={lon}"
        except ValueError:
            return False, f"Invalid lat/lon format: {raw_record.get('latitude')}, {raw_record.get('longitude')}"

        # Validate acq_time
        try:
            parse_acq_time(raw_record["acq_time"])
        except ValueError as e:
            return False, str(e)

        # Validate acq_date
        try:
            datetime.strptime(raw_record["acq_date"], "%Y-%m-%d")
        except ValueError:
            return False, f"Invalid acq_date format: {raw_record['acq_date']}"

        return True, None

    def normalize(self, raw_record: dict) -> dict:
        """Normalize a FIRMS record to Hotspot schema."""
        source = raw_record.pop("_firms_source")
        lat = float(raw_record["latitude"])
        lon = float(raw_record["longitude"])
        acquired_at = parse_acq_datetime(raw_record["acq_date"], raw_record["acq_time"])

        # Confidence normalization
        confidence = raw_record.get("confidence", "").lower()
        confidence_value = None
        instrument = raw_record.get("instrument", "")

        if source.startswith("VIIRS"):
            # VIIRS: confidence is l/n/h
            if confidence in ("l", "n", "h"):
                pass  # keep as-is
            else:
                confidence = "n"  # default
        elif source == "MODIS_NRT":
            # MODIS: confidence is numeric 0-100
            try:
                confidence_value = float(confidence)
                confidence = modis_confidence_to_category(confidence_value)
            except ValueError:
                confidence = "n"
                confidence_value = None

        # Daynight
        daynight = raw_record.get("daynight", "").upper()
        if daynight not in ("D", "N"):
            daynight = None

        # FRP
        frp = None
        if raw_record.get("frp"):
            try:
                frp = float(raw_record["frp"])
            except ValueError:
                pass

        # Version
        version = raw_record.get("version", "").upper() or "NRT"

        # Build geom as WKTElement
        geom = WKTElement(f"POINT({lon} {lat})", srid=4326)

        return {
            "source_id": self.source_id,
            "satellite": raw_record["satellite"],
            "instrument": instrument or None,
            "acquired_at": acquired_at,
            "geom": geom,
            "latitude": lat,
            "longitude": lon,
            "confidence": confidence or None,
            "confidence_value": confidence_value,
            "daynight": daynight,
            "version": version or None,
            "frp": frp,
            "area_id": None,  # assigned in transform stage
            "raw": raw_record,
        }

    def store(self, session, normalized_records: list[dict]) -> int:
        """Upsert hotspots using ON CONFLICT DO NOTHING matching uq_hotspot expression index."""
        if not normalized_records:
            return 0

        inserted_count = 0
        for record in normalized_records:
            stmt = pg_insert(Hotspot).values(**record)
            # ON CONFLICT DO NOTHING on the expression index columns
            stmt = stmt.on_conflict_do_nothing(
                index_elements=[
                    "source_id",
                    "satellite",
                    "acquired_at",
                    text("round(latitude::numeric, 4)"),
                    text("round(longitude::numeric, 4)"),
                ]
            )
            result = session.execute(stmt)
            if result.rowcount > 0:
                inserted_count += 1

        session.commit()
        return inserted_count

    def transform(self, session) -> None:
        """Assign area_id via ST_Covers against kabupaten_kota polygons for unassigned rows in window."""
        if self.window_from is None or self.window_to is None:
            return

        # Update hotspots with area_id where area_id is NULL and within window
        # Only assign to kabupaten_kota level areas
        sql = text("""
            UPDATE hotspots h
            SET area_id = a.id
            FROM administrative_areas a
            WHERE h.area_id IS NULL
              AND h.acquired_at >= :window_from
              AND h.acquired_at <= :window_to
              AND a.level = 'kabupaten_kota'
              AND ST_Covers(a.geom, h.geom)
              AND h.source_id = :source_id
        """)
        session.execute(
            sql,
            {
                "window_from": self.window_from,
                "window_to": self.window_to,
                "source_id": self.source_id,
            },
        )
        session.commit()


def run_firms_hotspots() -> None:
    """Entry point for FIRMS hotspot ingestion."""
    runner = FIRMSRunner()
    runner.run()
