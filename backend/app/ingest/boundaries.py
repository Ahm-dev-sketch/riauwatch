"""geoBoundaries administrative boundaries loader."""

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from geoalchemy2 import WKTElement
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.ingest.runner import IngestionRunner
from app.models import AdministrativeArea


class BoundariesRunner(IngestionRunner):
    """geoBoundaries administrative boundaries loader."""

    def __init__(self, geojson_path: str):
        super().__init__("geoboundaries")
        self.geojson_path = geojson_path

    def fetch(self) -> list[dict[str, Any]]:
        """Load and parse GeoJSON file."""
        path = Path(self.geojson_path)
        if not path.exists():
            raise FileNotFoundError(f"GeoJSON file not found: {self.geojson_path}")

        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        if data.get("type") != "FeatureCollection":
            raise ValueError("Expected FeatureCollection GeoJSON")

        features = data.get("features", [])
        if not features:
            return []

        # Set window for logging
        self.window_to = datetime.now(UTC)
        self.window_from = self.window_to

        self.params = {
            "file": self.geojson_path,
            "feature_count": len(features),
        }

        return features  # type: ignore

    def validate(self, raw_record: dict) -> tuple[bool, str | None]:
        """Validate a GeoJSON feature."""
        if raw_record.get("type") != "Feature":
            return False, "Not a Feature"

        geometry = raw_record.get("geometry")
        if not geometry or geometry.get("type") not in ("Polygon", "MultiPolygon"):
            return False, f"Invalid geometry type: {geometry.get('type') if geometry else None}"

        properties = raw_record.get("properties", {})
        # geoBoundaries ADM2 typically has shapeName, shapeGroup, shapeType, etc.
        # We need at least a name
        name = properties.get("shapeName") or properties.get("name") or properties.get("ADM2_NAME")
        if not name:
            return False, "Missing name in properties"

        return True, None

    def normalize(self, raw_record: dict) -> dict:
        """Normalize a GeoJSON feature to AdministrativeArea schema."""
        properties = raw_record.get("properties", {})
        geometry = raw_record.get("geometry")

        # Extract name - try multiple possible property names
        name = (
            properties.get("shapeName")
            or properties.get("name")
            or properties.get("ADM2_NAME")
            or properties.get("ADM2_EN")
            or "Unknown"
        )

        # Extract kode_bps if present (never invented)
        kode_bps = properties.get("shapeID") or properties.get("ADM2_PCODE") or properties.get("kode_bps")

        # Convert geometry to WKT
        geom_wkt = self._geometry_to_wkt(geometry)  # type: ignore[arg-type]
        geom = WKTElement(geom_wkt, srid=4326)

        # Compute centroid
        centroid_wkt = self._compute_centroid_wkt(geometry)  # type: ignore[arg-type]
        centroid = WKTElement(centroid_wkt, srid=4326) if centroid_wkt else None

        # Store all properties in JSONB
        # Log unmapped fields
        known_props = {"shapeName", "shapeGroup", "shapeType", "shapeID", "ADM2_NAME", "ADM2_EN", "ADM2_PCODE", "kode_bps"}
        unmapped = set(properties.keys()) - known_props
        if unmapped:
            logger = __import__("logging").getLogger(__name__)
            logger.info("Unmapped boundary properties", extra={"unmapped": list(unmapped), "area_name": name})

        return {
            "kode_bps": kode_bps,
            "name": name,
            "level": "kabupaten_kota",
            "parent_id": None,  # Will be set to Riau provinsi ID in store
            "geom": geom,
            "centroid": centroid,
            "properties": properties,
            "source_id": self.source_id,
        }

    def _geometry_to_wkt(self, geometry: dict) -> str:
        """Convert GeoJSON geometry to MultiPolygon WKT to match PostGIS column type."""
        geom_type = geometry.get("type")
        coords = geometry.get("coordinates", [])

        if geom_type == "Polygon":
            rings = []
            for ring in coords:
                points = ", ".join(f"{lon} {lat}" for lon, lat in ring)
                rings.append(f"({points})")
            return f"MULTIPOLYGON(({','.join(rings)}))"
        elif geom_type == "MultiPolygon":
            polygons = []
            for polygon in coords:
                rings = []
                for ring in polygon:
                    points = ", ".join(f"{lon} {lat}" for lon, lat in ring)
                    rings.append(f"({points})")
                polygons.append(f"({','.join(rings)})")
            return f"MULTIPOLYGON({','.join(polygons)})"
        else:
            raise ValueError(f"Unsupported geometry type: {geom_type}")

    def _compute_centroid_wkt(self, geometry: dict) -> str | None:
        """Compute centroid WKT from geometry (approximate - uses first polygon's first ring center)."""
        try:
            geom_type = geometry.get("type")
            coords = geometry.get("coordinates", [])

            if geom_type == "Polygon" and coords:
                # Use first ring's centroid approximation
                ring = coords[0]
                if ring:
                    lon_sum = sum(p[0] for p in ring)
                    lat_sum = sum(p[1] for p in ring)
                    n = len(ring)
                    return f"POINT({lon_sum/n} {lat_sum/n})"
            elif geom_type == "MultiPolygon" and coords:
                # Use first polygon's first ring
                polygon = coords[0]
                if polygon:
                    ring = polygon[0]
                    if ring:
                        lon_sum = sum(p[0] for p in ring)
                        lat_sum = sum(p[1] for p in ring)
                        n = len(ring)
                        return f"POINT({lon_sum/n} {lat_sum/n})"
        except Exception:
            pass
        return None

    def store(self, session: Session, normalized_records: list[dict]) -> int:
        """Upsert administrative areas with proper parent (Riau provinsi)."""
        if not normalized_records:
            return 0

        # First, ensure Riau provinsi exists
        provinsi = session.execute(
            select(AdministrativeArea).where(
                AdministrativeArea.level == "provinsi",
                AdministrativeArea.name == "Riau",
            )
        ).scalar_one_or_none()

        if provinsi is None:
            # Create Riau provinsi
            provinsi_stmt = pg_insert(AdministrativeArea).values(
                kode_bps=None,
                name="Riau",
                level="provinsi",
                parent_id=None,
                geom=WKTElement("MULTIPOLYGON EMPTY", srid=4326),  # Placeholder
                centroid=None,
                properties={},
                source_id=self.source_id,
            )
            provinsi_stmt = provinsi_stmt.on_conflict_do_nothing(
                index_elements=["level", "name", "parent_id"],
            )
            session.execute(provinsi_stmt)
            session.flush()

            provinsi = session.execute(
                select(AdministrativeArea).where(
                    AdministrativeArea.level == "provinsi",
                    AdministrativeArea.name == "Riau",
                )
            ).scalar_one()

        provinsi_id = provinsi.id

        inserted_count = 0
        for record in normalized_records:
            record["parent_id"] = provinsi_id

            stmt = pg_insert(AdministrativeArea).values(**record)
            # ON CONFLICT DO UPDATE on uq_area (level, name, parent_id) - NULLS NOT DISTINCT
            stmt = stmt.on_conflict_do_update(
                index_elements=["level", "name", "parent_id"],
                set_={
                    "kode_bps": record["kode_bps"],
                    "geom": record["geom"],
                    "centroid": record["centroid"],
                    "properties": record["properties"],
                    "source_id": record["source_id"],
                },
            )
            result = session.execute(stmt)
            if result.rowcount is not None and result.rowcount > 0:  # type: ignore[attr-defined]
                inserted_count += 1

        session.commit()
        return inserted_count

    def transform(self, session: Session) -> None:
        """No additional transform needed."""
        pass


def run_boundaries_load(geojson_path: str) -> None:
    """Entry point for boundaries loading."""
    runner = BoundariesRunner(geojson_path)
    runner.run()
