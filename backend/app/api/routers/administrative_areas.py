"""GET /administrative-areas and /administrative-areas/lookup."""

import json
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import models as m
from app.api.deps import get_db_dependency
from app.api.routers._common import AREA_LEVELS, not_found, unprocessable

router = APIRouter(tags=["administrative-areas"])

_AREAS_SQL = (
    "SELECT a.id AS id, a.name AS name, a.level AS level, a.kode_bps AS kode_bps, "
    "a.parent_id AS parent_id, {geom_expr} AS geometry "
    "FROM administrative_areas a WHERE a.level = :level ORDER BY a.name"
)

_LOOKUP_SQL = (
    "SELECT a.id AS id, a.name AS name, a.level AS level FROM administrative_areas a "
    "WHERE ST_Covers(a.geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)) "
    "ORDER BY CASE a.level WHEN 'kecamatan' THEN 0 "
    "WHEN 'kabupaten_kota' THEN 1 ELSE 2 END LIMIT 1"
)


@router.get("/administrative-areas", response_model=m.AdminAreasResponse)
def get_administrative_areas(
    level: str = Query(default="kabupaten_kota"),
    simplify: float | None = Query(
        default=None, ge=0, description="ST_SimplifyPreserveTopology tolerance in degrees"
    ),
    db: Session = Depends(get_db_dependency),
) -> m.AdminAreasResponse:
    """Boundary GeoJSON (MultiPolygon) for one administrative level."""
    if level not in AREA_LEVELS:
        raise unprocessable(f"level must be one of {', '.join(AREA_LEVELS)}")
    if simplify is not None:
        geom_expr = "ST_AsGeoJSON(ST_SimplifyPreserveTopology(a.geom, :tol))"
    else:
        geom_expr = "ST_AsGeoJSON(a.geom)"
    params: dict[str, Any] = {"level": level}
    if simplify is not None:
        params["tol"] = simplify
    rows = db.execute(text(_AREAS_SQL.format(geom_expr=geom_expr)), params).mappings().all()
    features = [
        m.AdminAreaFeature(
            geometry=json.loads(str(row["geometry"])),
            properties=m.AdminAreaProperties(
                id=int(row["id"]),
                name=str(row["name"]),
                level=str(row["level"]),
                kode_bps=row["kode_bps"],  # type: ignore[arg-type]
                parent_id=row["parent_id"],  # type: ignore[arg-type]
            ),
        )
        for row in rows
    ]
    return m.AdminAreasResponse(features=features)


@router.get("/administrative-areas/lookup", response_model=m.AdminAreaLookupResponse)
def lookup_administrative_area(
    lat: float = Query(description="latitude in [-90, 90]"),
    lon: float = Query(description="longitude in [-180, 180]"),
    db: Session = Depends(get_db_dependency),
) -> m.AdminAreaLookupResponse:
    """Point-in-polygon resolution (most specific level wins); 404 when outside coverage."""
    if not -90 <= lat <= 90:
        raise unprocessable("lat must be within [-90, 90]")
    if not -180 <= lon <= 180:
        raise unprocessable("lon must be within [-180, 180]")
    row = db.execute(text(_LOOKUP_SQL), {"lat": lat, "lon": lon}).mappings().first()
    if row is None:
        raise not_found("no administrative area covers the given point")
    area = dict(row)
    return m.AdminAreaLookupResponse(
        id=int(area["id"]), name=str(area["name"]), level=str(area["level"])
    )
