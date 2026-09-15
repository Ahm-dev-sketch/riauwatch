"""GET /air-quality/latest and /air-quality/history."""

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import models as m
from app.api.deps import get_db_dependency
from app.api.routers._common import (
    POLLUTANTS,
    age_seconds,
    as_float,
    parse_near,
    resolve_date_range,
    unprocessable,
)

router = APIRouter(tags=["air-quality"])

_NEAREST_STATIONS_SQL = (
    "SELECT s.id AS id, s.name AS name, s.external_id AS external_id, "
    "ST_Distance(s.geom::geography, "
    "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography) / 1000.0 AS distance_km "
    "FROM monitoring_stations s WHERE s.geom IS NOT NULL "
    "ORDER BY s.geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326) LIMIT 3"
)

_AREA_STATIONS_SQL = (
    "SELECT s.id AS id, s.name AS name, s.external_id AS external_id, "
    "NULL::float AS distance_km FROM monitoring_stations s "
    "WHERE s.area_id = :kab ORDER BY s.id LIMIT 50"
)

_LATEST_SQL = (
    "SELECT DISTINCT ON (o.station_id, o.pollutant) o.station_id AS station_id, "
    "o.pollutant AS pollutant, o.value AS value, o.unit AS unit, o.observed_at AS observed_at "
    "FROM air_quality_observations o WHERE o.station_id IN :sids "
    "ORDER BY o.station_id, o.pollutant, o.observed_at DESC"
)

_HISTORY_SQL = (
    "SELECT o.observed_at AS observed_at, o.value AS value, o.unit AS unit "
    "FROM air_quality_observations o "
    "WHERE o.station_id = :sid AND o.pollutant = :pol "
    "AND o.observed_at >= :dfrom AND o.observed_at <= :dto "
    "ORDER BY o.observed_at ASC LIMIT 5000"
)


_ALL_STATIONS_SQL = (
    "SELECT s.id AS id, s.name AS name, s.external_id AS external_id, "
    "NULL::float AS distance_km FROM monitoring_stations s "
    "ORDER BY s.id LIMIT 50"
)


def _station_ids_clause(ids: list[int]) -> str:
    """Inline integer station ids (safe: ints validated by the DB driver layer)."""
    return "(" + ", ".join(str(int(i)) for i in ids) + ")"


@router.get("/air-quality/latest", response_model=m.AirQualityLatestResponse)
def get_air_quality_latest(
    near: str | None = Query(default=None, description="lat,lon for nearest stations (KNN)"),
    kabupaten_id: int | None = Query(default=None),
    db: Session = Depends(get_db_dependency),
) -> m.AirQualityLatestResponse:
    """Latest observation per pollutant per station (category is null until Phase 6)."""
    if near is not None:
        try:
            lat, lon = parse_near(near)
        except ValueError as exc:
            raise unprocessable(str(exc)) from None
        stations = db.execute(text(_NEAREST_STATIONS_SQL), {"lat": lat, "lon": lon}).mappings().all()
    elif kabupaten_id is not None:
        stations = db.execute(text(_AREA_STATIONS_SQL), {"kab": kabupaten_id}).mappings().all()
    else:
        stations = db.execute(text(_ALL_STATIONS_SQL)).mappings().all()

    result: list[m.AQStationLatest] = []
    station_rows = [dict(r) for r in stations]
    obs_by_station: dict[int, list[dict[str, Any]]] = {}
    if station_rows:
        sids = _station_ids_clause([int(r["id"]) for r in station_rows])
        for row in db.execute(text(_LATEST_SQL.replace(":sids", sids))).mappings().all():
            obs_by_station.setdefault(int(row["station_id"]), []).append(dict(row))
    for station in station_rows:
        obs = [
            m.AQObservation(
                pollutant=str(o["pollutant"]),
                value=float(o["value"]),
                unit=str(o["unit"]),
                observed_at=o["observed_at"],
                age_seconds=age_seconds(o["observed_at"]),
            )
            for o in obs_by_station.get(int(station["id"]), [])
        ]
        result.append(
            m.AQStationLatest(
                station_id=int(station["id"]),
                station_name=station["name"],
                external_id=str(station["external_id"]),
                distance_km=as_float(station["distance_km"]),
                observations=obs,
                category=None,
            )
        )
    return m.AirQualityLatestResponse(stations=result)


@router.get("/air-quality/history", response_model=m.AirQualityHistoryResponse)
def get_air_quality_history(
    station_id: int = Query(description="monitoring station id"),
    pollutant: str = Query(description="one of pm25, pm10, o3, no2, so2, co"),
    date_from: str | None = Query(default=None, alias="from", description="ISO 8601 start"),
    date_to: str | None = Query(default=None, alias="to", description="ISO 8601 end"),
    db: Session = Depends(get_db_dependency),
) -> m.AirQualityHistoryResponse:
    """Time series for one station+pollutant, ascending, capped at 5000 points."""
    if pollutant not in POLLUTANTS:
        raise unprocessable(f"pollutant must be one of {', '.join(POLLUTANTS)}")
    try:
        start, end = resolve_date_range(
            date_from, date_to, default_lookback_hours=7 * 24, max_range_days=90
        )
    except ValueError as exc:
        raise unprocessable(str(exc)) from None
    rows = db.execute(
        text(_HISTORY_SQL),
        {"sid": station_id, "pol": pollutant, "dfrom": start, "dto": end},
    ).mappings().all()
    points = [
        m.AQHistoryPoint(
            observed_at=row["observed_at"],
            value=float(row["value"]),
            unit=str(row["unit"]),
        )
        for row in rows
    ]
    unit = str(rows[0]["unit"]) if rows else "ug/m3"
    return m.AirQualityHistoryResponse(
        station_id=station_id, pollutant=pollutant, unit=unit, points=points
    )
