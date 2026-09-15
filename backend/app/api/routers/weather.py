"""GET /weather/current and /weather/forecast."""

from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import models as m
from app.api.deps import get_db_dependency
from app.api.routers._common import (
    age_seconds,
    as_float,
    not_found,
    parse_near,
    unprocessable,
    utcnow,
)

router = APIRouter(tags=["weather"])

_NEAREST_AREA_SQL = (
    "SELECT a.id AS id, a.name AS name FROM administrative_areas a "
    "WHERE a.level = 'kabupaten_kota' "
    "ORDER BY a.geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326) LIMIT 1"
)

_AREA_SQL = "SELECT a.id AS id, a.name AS name FROM administrative_areas a WHERE a.id = :aid"

_CURRENT_SQL = (
    "SELECT w.valid_time AS valid_time, w.is_forecast AS is_forecast, "
    "w.temperature_c AS temperature_c, w.humidity_pct AS humidity_pct, "
    "w.precipitation_mm AS precipitation_mm, w.wind_speed_kmh AS wind_speed_kmh, "
    "w.wind_direction_deg AS wind_direction_deg "
    "FROM weather_observations w WHERE w.area_id = :aid AND w.is_forecast = false "
    "ORDER BY w.valid_time DESC LIMIT 1"
)

_FORECAST_SQL = (
    "SELECT w.valid_time AS valid_time, w.is_forecast AS is_forecast, "
    "w.temperature_c AS temperature_c, w.humidity_pct AS humidity_pct, "
    "w.precipitation_mm AS precipitation_mm, w.wind_speed_kmh AS wind_speed_kmh, "
    "w.wind_direction_deg AS wind_direction_deg "
    "FROM weather_observations w WHERE w.area_id = :aid AND w.is_forecast = true "
    "AND w.valid_time > :now AND w.valid_time <= :horizon "
    "ORDER BY w.valid_time ASC"
)


def _resolve_area(db: Session, near: str | None, kabupaten_id: int | None) -> tuple[int, str]:
    """Resolve one kabupaten/kota id+name by id or nearest polygon; raises 422/404."""
    if near is not None:
        try:
            lat, lon = parse_near(near)
        except ValueError as exc:
            raise unprocessable(str(exc)) from None
        row = db.execute(text(_NEAREST_AREA_SQL), {"lat": lat, "lon": lon}).mappings().first()
        if row is None:
            raise not_found("no administrative area found near the given coordinates")
        area = dict(row)
        return int(area["id"]), str(area["name"])
    if kabupaten_id is not None:
        row = db.execute(text(_AREA_SQL), {"aid": kabupaten_id}).mappings().first()
        if row is None:
            raise not_found(f"administrative area {kabupaten_id} not found")
        area = dict(row)
        return int(area["id"]), str(area["name"])
    raise unprocessable("provide either 'near=lat,lon' or 'kabupaten_id'")


def _to_observation(row: dict[str, Any]) -> m.WeatherObservationResponse:
    valid = row["valid_time"]
    assert hasattr(valid, "isoformat"), "valid_time must be a datetime"
    age = age_seconds(valid) if not bool(row["is_forecast"]) else None
    return m.WeatherObservationResponse(
        valid_time=valid,  # type: ignore[arg-type]
        is_forecast=bool(row["is_forecast"]),
        temperature_c=as_float(row["temperature_c"]),
        humidity_pct=as_float(row["humidity_pct"]),
        precipitation_mm=as_float(row["precipitation_mm"]),
        wind_speed_kmh=as_float(row["wind_speed_kmh"]),
        wind_direction_deg=as_float(row["wind_direction_deg"]),
        age_seconds=age,
    )


@router.get("/weather/current", response_model=m.WeatherCurrentResponse)
def get_weather_current(
    near: str | None = Query(default=None, description="lat,lon for nearest kabupaten/kota"),
    kabupaten_id: int | None = Query(default=None),
    db: Session = Depends(get_db_dependency),
) -> m.WeatherCurrentResponse:
    """Latest non-forecast row for one area (all measure fields + valid_time + age)."""
    area_id, area_name = _resolve_area(db, near, kabupaten_id)
    row = db.execute(text(_CURRENT_SQL), {"aid": area_id}).mappings().first()
    if row is None:
        raise not_found(f"no current weather observation for area {area_id}")
    return m.WeatherCurrentResponse(
        area_id=area_id,
        area_name=area_name,
        observation=_to_observation(dict(row)),
    )


@router.get("/weather/forecast", response_model=m.WeatherForecastResponse)
def get_weather_forecast(
    near: str = Query(description="lat,lon for nearest kabupaten/kota"),
    hours: int = Query(default=24, ge=1, le=72, description="forecast window in hours (max 72)"),
    db: Session = Depends(get_db_dependency),
) -> m.WeatherForecastResponse:
    """Next N hours of forecast rows ordered by valid_time."""
    area_id, area_name = _resolve_area(db, near, None)
    now = utcnow()
    rows = db.execute(
        text(_FORECAST_SQL),
        {"aid": area_id, "now": now, "horizon": now + timedelta(hours=hours)},
    ).mappings().all()
    return m.WeatherForecastResponse(
        area_id=area_id,
        area_name=area_name,
        forecast=[_to_observation(dict(row)) for row in rows],
    )
