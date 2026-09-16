"""GET /hotspots and GET /hotspots/summary — GeoJSON heat indications."""

import json
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import models as m
from app.api.deps import get_db_dependency
from app.api.routers._common import (
    allowed_confidences,
    as_float,
    parse_bbox,
    resolve_date_range,
    unprocessable,
)

router = APIRouter(tags=["hotspots"])

DISCLAIMER = (
    "Hotspots are satellite heat indications and are NOT confirmed fires. "
    "Ground verification is required; absence of hotspots does not guarantee absence of fire."
)

_HOTSPOTS_SQL = (
    "SELECT h.id AS id, ST_AsGeoJSON(h.geom) AS geometry, h.satellite AS satellite, "
    "h.instrument AS instrument, h.confidence AS confidence, "
    "h.confidence_value AS confidence_value, h.daynight AS daynight, h.frp AS frp, "
    "h.acquired_at AS acquired_at, "
    "COALESCE(a.name, (SELECT a2.name FROM administrative_areas a2 WHERE a2.level = 'kabupaten_kota' ORDER BY a2.geom <-> h.geom LIMIT 1)) AS area_name "
    "FROM hotspots h LEFT JOIN administrative_areas a ON a.id = h.area_id "
    "WHERE {where} ORDER BY h.acquired_at DESC LIMIT :limit OFFSET :offset"
)

_SUMMARY_SQL = (
    "SELECT COALESCE(h.area_id, (SELECT a2.id FROM administrative_areas a2 WHERE a2.level = 'kabupaten_kota' ORDER BY a2.geom <-> h.geom LIMIT 1)) AS area_id, "
    "COALESCE(a.name, (SELECT a2.name FROM administrative_areas a2 WHERE a2.level = 'kabupaten_kota' ORDER BY a2.geom <-> h.geom LIMIT 1)) AS area_name, COUNT(*) AS count "
    "FROM hotspots h LEFT JOIN administrative_areas a ON a.id = h.area_id "
    "WHERE {where} GROUP BY 1, 2 ORDER BY COUNT(*) DESC"
)

_COUNT_SQL = "SELECT COUNT(*) AS total FROM hotspots h WHERE {where}"


def _hotspot_filters(
    bbox: str | None,
    date_from: str | None,
    date_to: str | None,
    kabupaten_id: int | None,
    min_confidence: str | None,
) -> tuple[str, dict[str, object]]:
    """Build the shared WHERE clause + params; raises HTTP 422 on bad input."""
    try:
        start, end = resolve_date_range(
            date_from, date_to, default_lookback_hours=7 * 24, max_range_days=30
        )
    except ValueError as exc:
        raise unprocessable(str(exc)) from None
    where = ["h.acquired_at >= :dfrom", "h.acquired_at <= :dto"]
    params: dict[str, object] = {"dfrom": start, "dto": end}
    if bbox is not None:
        try:
            west, south, east, north = parse_bbox(bbox)
        except ValueError as exc:
            raise unprocessable(str(exc)) from None
        where.append("h.geom && ST_MakeEnvelope(:w, :s, :e, :n, 4326)")
        params.update({"w": west, "s": south, "e": east, "n": north})
    if kabupaten_id is not None:
        where.append("h.area_id = :kab")
        params["kab"] = kabupaten_id
    try:
        levels = allowed_confidences(min_confidence)
    except ValueError as exc:
        raise unprocessable(str(exc)) from None
    if levels is not None:
        # Safe to inline: values come from our fixed vocabulary, not raw user input.
        quoted = ", ".join(f"'{level}'" for level in levels)
        where.append(f"h.confidence IN ({quoted})")
    return " AND ".join(where), params


def _to_feature(row: dict[str, Any]) -> m.HotspotFeature:
    geometry = json.loads(str(row["geometry"]))
    acquired = row["acquired_at"]
    assert hasattr(acquired, "isoformat"), "acquired_at must be a datetime"
    inst = str(row.get("instrument") or row.get("satellite") or "").upper()
    sensor = "VIIRS" if "VIIRS" in inst else ("MODIS" if "MODIS" in inst or "TERRA" in inst or "AQUA" in inst else "VIIRS")
    return m.HotspotFeature(
        geometry=geometry,
        properties=m.HotspotProperties(
            id=int(row["id"]) if row.get("id") is not None else None,
            satellite=str(row["satellite"]),
            instrument=row["instrument"],
            confidence=row["confidence"],
            confidence_value=as_float(row["confidence_value"]),
            daynight=row["daynight"],
            frp=as_float(row.get("frp")),
            acquired_at=acquired,
            area_name=row["area_name"],
            hotspot_indication=True,
            sensor=sensor,
            raw_detections_count=1,
        ),
    )


@router.get("/hotspots", response_model=m.HotspotsResponse)
def get_hotspots(
    bbox: str | None = Query(default=None, description="west,south,east,north; span <= 1.0 deg/axis"),
    date_from: str | None = Query(default=None, description="ISO 8601 start (default: 48h ago)"),
    date_to: str | None = Query(default=None, description="ISO 8601 end (default: now)"),
    kabupaten_id: int | None = Query(default=None),
    min_confidence: str | None = Query(default=None, description="minimum confidence: l < n < h"),
    limit: int = Query(default=500, ge=1, le=2000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db_dependency),
) -> m.HotspotsResponse:
    """Hotspot features as GeoJSON (heat indications, NOT confirmed fires)."""
    where, params = _hotspot_filters(bbox, date_from, date_to, kabupaten_id, min_confidence)
    params.update({"limit": limit, "offset": offset})
    rows = db.execute(text(_HOTSPOTS_SQL.format(where=where)), params).mappings().all()
    features = [_to_feature(dict(row)) for row in rows]
    return m.HotspotsResponse(features=features, disclaimer=DISCLAIMER, count=len(features))


@router.get("/hotspots/summary", response_model=m.HotspotsSummaryResponse)
def get_hotspots_summary(
    bbox: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    kabupaten_id: int | None = Query(default=None),
    min_confidence: str | None = Query(default=None),
    db: Session = Depends(get_db_dependency),
) -> m.HotspotsSummaryResponse:
    """Counts grouped by kabupaten plus overall total."""
    where, params = _hotspot_filters(bbox, date_from, date_to, kabupaten_id, min_confidence)
    rows = db.execute(text(_SUMMARY_SQL.format(where=where)), params).mappings().all()
    items = [
        m.HotspotSummaryItem(
            kabupaten_id=int(row["area_id"]),
            kabupaten_name=str(row["area_name"] or "Unknown"),
            count=int(row["count"]),
        )
        for row in rows
        if row["area_id"] is not None
    ]
    total = int(db.execute(text(_COUNT_SQL.format(where=where)), params).scalar() or 0)
    return m.HotspotsSummaryResponse(items=items, total=total)
