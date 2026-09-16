"""DB-backed fire-risk recompute job (worker side, event-driven after ingestion runs).

For each kabupaten/kota area: hotspot density over the last 48h (count per km²,
VIIRS confidence n/h + MODIS confidence_value >= threshold) plus weather windows
(rainfall 7d sum, humidity 24h mean, temp 24h max, wind 24h mean, non-forecast rows
only), scored by app.risk.engine and upserted into risk_assessments on
(area_id, assessed_for, horizon, model_version).

Run bookkeeping reuses the ingest runner's helpers (advisory_lock + running-first
DataIngestionLog row) without duplicating them. The log row is filed under the
primary-signal FIRMS source tagged params {"job": "risk-recompute"}; the /status
endpoint explicitly excludes that tag so compute health can never poison ingestion
freshness semantics.
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db import get_session_factory
from app.ingest.runner import AdvisoryLockError, advisory_lock
from app.models import DataIngestionLog, RiskAssessment
from app.risk import config as C
from app.risk.engine import (
    FactorInput,
    RiskResult,
    compute_risk,
    fuel_reason,
    hotspot_reason,
    humidity_reason,
    normalize_factor,
    rainfall_reason,
    temperature_reason,
    unavailable_reason,
    wind_reason,
)

logger = logging.getLogger(__name__)

RISK_JOB_TAG = "risk-recompute"
PRIMARY_SOURCE_KEY = "firms_viirs_nrt"

_AREAS_SQL = text("""
    SELECT a.id AS id, a.name AS name,
           ST_Area(a.geom::geography) / 1000000.0 AS area_km2
    FROM administrative_areas a
    WHERE a.level = 'kabupaten_kota'
    ORDER BY a.id
""")

_HOTSPOT_COUNT_SQL = text("""
    SELECT COUNT(*) AS n FROM hotspots h
    WHERE h.area_id = :area_id
      AND h.acquired_at >= :since
      AND (h.confidence IN ('n', 'h') OR h.confidence_value >= :modis_thr)
""")

_WEATHER_SQL = text("""
    SELECT SUM(CASE WHEN w.valid_time >= :t7 THEN w.precipitation_mm END) AS rain_7d,
           AVG(CASE WHEN w.valid_time >= :t24 THEN w.humidity_pct END) AS humidity_24h,
           MAX(CASE WHEN w.valid_time >= :t24 THEN w.temperature_c END) AS temp_max_24h,
           AVG(CASE WHEN w.valid_time >= :t24 THEN w.wind_speed_kmh END) AS wind_24h,
           AVG(CASE WHEN w.valid_time >= :t24 THEN (w.raw->>'soil_moisture_0_to_7cm')::float END) AS soil_moisture_24h
    FROM weather_observations w
    WHERE w.area_id = :area_id
      AND w.is_forecast = false
      AND w.valid_time >= :t7
      AND w.valid_time <= :now
""")

_FIRMS_FRESH_SQL = text("""
    SELECT MAX(l.finished_at) AS last_ok
    FROM data_ingestion_logs l JOIN data_sources s ON s.id = l.source_id
    WHERE s.key LIKE 'firms%' AND l.status = 'success'
      AND (l.params IS NULL OR l.params->>'job' IS NULL
           OR l.params->>'job' <> 'risk-recompute')
""")


def _num(value: Any) -> float | None:
    return None if value is None else float(value)


def _resolve_source_id(session: Session, key: str) -> int:
    row = session.execute(
        text("SELECT id FROM data_sources WHERE key = :k"), {"k": key}
    ).scalar_one_or_none()
    if row is None:
        raise RuntimeError(f"data source not found: {key}")
    return int(row)


_AQ_NEAREST_SQL = text("""
    SELECT o.value AS pm25
    FROM air_quality_observations o
    JOIN monitoring_stations s ON s.id = o.station_id
    WHERE o.pollutant = 'pm25'
    ORDER BY s.geom <-> (SELECT centroid FROM administrative_areas WHERE id = :area_id), o.observed_at DESC
    LIMIT 1
""")


def _assess_area(
    session: Session,
    area_id: int,
    area_km2: float,
    firms_fresh: bool,
    ref: datetime,
    t24: datetime,
    t7d: datetime,
) -> RiskResult:
    """Build factors for one area and score them (pure engine call at the end)."""
    since = ref - timedelta(hours=C.HOTSPOT_LOOKBACK_HOURS)
    count = int(
        session.execute(
            _HOTSPOT_COUNT_SQL,
            {"area_id": area_id, "since": since, "modis_thr": C.MODIS_CONFIDENCE_THRESHOLD},
        ).scalar()
        or 0
    )
    weather = session.execute(
        _WEATHER_SQL, {"area_id": area_id, "t7": t7d, "t24": t24, "now": ref}
    ).mappings().first()
    w: dict[str, Any] = dict(weather) if weather else {}

    aq_pm25 = session.execute(_AQ_NEAREST_SQL, {"area_id": area_id}).scalar()
    pm25_val = _num(aq_pm25)

    inputs: list[FactorInput] = []
    if firms_fresh and area_km2 > 0:
        density = round(count / area_km2, 4)
        sub = normalize_factor("hotspot_density_48h", density)
        inputs.append(
            FactorInput(
                name="hotspot_density_48h",
                value=density,
                subscore=sub,
                reason=hotspot_reason(count),
            )
        )
    else:
        inputs.append(
            FactorInput(
                name="hotspot_density_48h",
                value=None,
                reason=unavailable_reason("hotspot_density_48h"),
            )
        )

    rain = _num(w.get("rain_7d"))
    if rain is not None:
        rain = round(rain, 1)
        sub = normalize_factor("rainfall_7d", rain)
        inputs.append(FactorInput(name="rainfall_7d", value=rain, subscore=sub,
                                  reason=rainfall_reason(rain, sub)))
    else:
        inputs.append(FactorInput(name="rainfall_7d", value=None,
                                  reason=unavailable_reason("rainfall_7d")))

    hum = _num(w.get("humidity_24h"))
    if hum is not None:
        hum = round(hum, 1)
        sub = normalize_factor("humidity_24h", hum)
        inputs.append(FactorInput(name="humidity_24h", value=hum, subscore=sub,
                                  reason=humidity_reason(hum, sub)))
    else:
        inputs.append(FactorInput(name="humidity_24h", value=None,
                                  reason=unavailable_reason("humidity_24h")))

    tmax = _num(w.get("temp_max_24h"))
    if tmax is not None:
        tmax = round(tmax, 1)
        sub = normalize_factor("temperature_24h_max", tmax)
        inputs.append(FactorInput(name="temperature_24h_max", value=tmax, subscore=sub,
                                  reason=temperature_reason(tmax, sub)))
    else:
        inputs.append(FactorInput(name="temperature_24h_max", value=None,
                                  reason=unavailable_reason("temperature_24h_max")))

    wind = _num(w.get("wind_24h"))
    if wind is not None:
        wind = round(wind, 1)
        sub = normalize_factor("wind_24h_mean", wind)
        inputs.append(FactorInput(name="wind_24h_mean", value=wind, subscore=sub,
                                  reason=wind_reason(wind, sub)))
    else:
        inputs.append(FactorInput(name="wind_24h_mean", value=None,
                                  reason=unavailable_reason("wind_24h_mean")))

    fuel = _num(w.get("soil_moisture_24h"))
    if fuel is not None:
        fuel = round(fuel, 2)
        sub = normalize_factor("fuel_index", fuel)
        inputs.append(FactorInput(name="fuel_index", value=fuel, subscore=sub,
                                  reason=fuel_reason(fuel, sub)))
    else:
        inputs.append(FactorInput(name="fuel_index", value=None,
                                  reason=unavailable_reason("fuel_index")))

    return compute_risk(inputs, observed_from=t7d, observed_to=ref, pm25_value=pm25_val)


def _upsert(session: Session, area_id: int, assessed_for: datetime, result: RiskResult) -> None:
    stmt = pg_insert(RiskAssessment).values(
        area_id=area_id,
        assessed_for=assessed_for,
        horizon=C.HORIZON,
        model_version=C.MODEL_VERSION,
        risk_level=result.level,
        score=result.score,
        factors=result.to_dict(),
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["area_id", "assessed_for", "horizon", "model_version"],
        set_={
            "risk_level": result.level,
            "score": result.score,
            "factors": result.to_dict(),
            "computed_at": datetime.now(UTC),
        },
    )
    session.execute(stmt)


def run_risk_recompute(
    session_factory: Any = None, now: datetime | None = None
) -> dict[str, Any]:
    """Recompute current risk for all kabupaten/kota; returns a summary dict.

    ``session_factory`` and ``now`` are injectable for integration tests.
    """
    factory = session_factory or get_session_factory()
    ref = now or datetime.now(UTC)
    run_id = uuid4()
    started_at = datetime.now(UTC)

    with factory() as session:
        try:
            with advisory_lock(session, "risk_recompute"):
                return _run_with_lock(session, run_id, started_at, ref)
        except AdvisoryLockError as exc:
            logger.warning("Advisory lock unavailable, skipping run", extra={"job": RISK_JOB_TAG})
            source_id = _resolve_source_id(session, PRIMARY_SOURCE_KEY)
            session.add(
                DataIngestionLog(
                    source_id=source_id,
                    run_id=run_id,
                    started_at=started_at,
                    finished_at=datetime.now(UTC),
                    status="failed",
                    params={"job": RISK_JOB_TAG},
                    error_detail=str(exc),
                )
            )
            session.commit()
            return {"run_id": str(run_id), "status": "failed", "error": str(exc)}


def _run_with_lock(
    session: Session, run_id: Any, started_at: datetime, ref: datetime
) -> dict[str, Any]:
    source_id = _resolve_source_id(session, PRIMARY_SOURCE_KEY)
    t24 = ref - timedelta(hours=24)
    t7d = ref - timedelta(days=7)
    assessed_for = ref.replace(minute=0, second=0, microsecond=0)

    log = DataIngestionLog(
        source_id=source_id,
        run_id=run_id,
        started_at=started_at,
        status="running",
        window_from=t7d,
        window_to=ref,
        params={"job": RISK_JOB_TAG, "model_version": C.MODEL_VERSION},
    )
    session.add(log)
    session.commit()

    failures: list[str] = []
    assessed = 0
    try:
        areas = session.execute(_AREAS_SQL).mappings().all()
        last_ok = session.execute(_FIRMS_FRESH_SQL).scalar()
        firms_fresh = (
            last_ok is not None
            and isinstance(last_ok, datetime)
            and last_ok >= ref - timedelta(hours=C.HOTSPOT_STALE_AFTER_HOURS)
        )
        for row in areas:
            area = dict(row)
            try:
                result = _assess_area(
                    session, int(area["id"]), float(area["area_km2"] or 0),
                    firms_fresh, ref, t24, t7d,
                )
                _upsert(session, int(area["id"]), assessed_for, result)
                assessed += 1
            except Exception as exc:  # per-area failure must not abort the run
                logger.exception("Risk assess failed", extra={"area_id": area["id"]})
                failures.append(f"{area['id']}: {exc}")
        session.commit()
    except Exception as exc:
        session.rollback()
        log.status = "failed"
        log.finished_at = datetime.now(UTC)
        log.error_detail = str(exc)
        session.commit()
        logger.exception("Risk recompute failed", extra={"run_id": str(run_id)})
        raise

    if not assessed:
        status = "failed"
    elif failures:
        status = "partial"
    else:
        status = "success"
    log.status = status
    log.finished_at = datetime.now(UTC)
    log.records_fetched = assessed + len(failures)
    log.records_inserted = assessed
    log.records_invalid = len(failures)
    log.error_detail = "; ".join(failures) or None
    session.commit()
    logger.info(
        "Risk recompute finished",
        extra={"run_id": str(run_id), "status": status, "assessed": assessed},
    )
    return {
        "run_id": str(run_id),
        "status": status,
        "areas_assessed": assessed,
        "failures": failures,
    }
