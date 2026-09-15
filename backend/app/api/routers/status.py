"""GET /status — per-domain freshness and degradation."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import models as m
from app.api.deps import get_db_dependency
from app.api.routers._common import compute_degraded, utcnow
from app.settings import settings

router = APIRouter(tags=["status"])

# Domain -> data_sources key LIKE pattern (robust to future key additions).
DOMAIN_SOURCE_PATTERN = {
    "hotspots": "firms%",
    "air_quality": "openaq%",
    "weather": "open_meteo%",
}

# Domain -> last-observation query (max acquired_at/observed_at/valid_time).
DOMAIN_OBSERVATION_SQL = {
    "hotspots": (
        "SELECT MAX(h.acquired_at) AS last_obs FROM hotspots h "
        "WHERE h.source_id IN (SELECT s.id FROM data_sources s WHERE s.key LIKE :pat)"
    ),
    "air_quality": (
        "SELECT MAX(o.observed_at) AS last_obs FROM air_quality_observations o "
        "WHERE o.station_id IN (SELECT st.id FROM monitoring_stations st "
        "WHERE st.source_id IN (SELECT s.id FROM data_sources s WHERE s.key LIKE :pat))"
    ),
    "weather": (
        "SELECT MAX(w.valid_time) AS last_obs FROM weather_observations w "
        "WHERE w.is_forecast = false AND w.source_id IN (SELECT s.id FROM data_sources s WHERE s.key LIKE :pat)"
    ),
}

# Log rows tagged params {"job": "risk-recompute"} are compute bookkeeping, not
# ingestion runs: exclude them so compute health can never flip ingestion freshness.
_INGESTION_ONLY = (
    "AND (l.params IS NULL OR l.params->>'job' IS NULL "
    "OR l.params->>'job' <> 'risk-recompute')"
)

_RECENT_RUNS_SQL = (
    "SELECT s.key AS source_key, l.status AS status, l.started_at AS started_at "
    "FROM data_ingestion_logs l JOIN data_sources s ON s.id = l.source_id "
    "WHERE s.key LIKE :pat " + _INGESTION_ONLY + " ORDER BY l.started_at DESC LIMIT 200"
)

_LAST_SUCCESS_SQL = (
    "SELECT MAX(l.finished_at) AS last_ok FROM data_ingestion_logs l "
    "JOIN data_sources s ON s.id = l.source_id "
    "WHERE s.key LIKE :pat AND l.status = 'success' " + _INGESTION_ONLY
)


def _domain_status(
    db: Session,
    pattern: str,
    obs_sql: str,
    threshold: int,
    stale_cutoff: datetime,
) -> m.DomainStatus:
    last_obs = db.execute(text(obs_sql), {"pat": pattern}).scalar()
    last_ok = db.execute(text(_LAST_SUCCESS_SQL), {"pat": pattern}).scalar()
    rows = db.execute(text(_RECENT_RUNS_SQL), {"pat": pattern}).mappings().all()

    by_source: dict[str, list[dict[str, object]]] = {}
    for row in rows:
        by_source.setdefault(str(row["source_key"]), []).append(
            {"status": str(row["status"]), "started_at": row["started_at"]}
        )

    degraded = False
    for runs in by_source.values():
        if not runs:
            continue
        completed = [str(r["status"]) for r in runs if r["status"] != "running"]
        latest_run = runs[0]
        stale = (
            latest_run["status"] == "running"
            and isinstance(latest_run["started_at"], datetime)
            and latest_run["started_at"] < stale_cutoff
        )
        if compute_degraded(completed, stale, threshold):
            degraded = True
            break
    return m.DomainStatus(
        last_observation_at=last_obs,
        last_successful_run_at=last_ok,
        degraded=degraded,
    )


@router.get("/status", response_model=m.StatusResponse)
def get_status(db: Session = Depends(get_db_dependency)) -> m.StatusResponse:
    """Freshness per domain: last observation, last successful run, degraded flag."""
    now = utcnow()
    stale_cutoff = now - timedelta(minutes=settings.running_stale_timeout_minutes)
    threshold = settings.degraded_after_consecutive_failures
    blocks = {
        domain: _domain_status(db, DOMAIN_SOURCE_PATTERN[domain], DOMAIN_OBSERVATION_SQL[domain], threshold, stale_cutoff)
        for domain in ("hotspots", "air_quality", "weather")
    }
    return m.StatusResponse(
        hotspots=blocks["hotspots"],
        air_quality=blocks["air_quality"],
        weather=blocks["weather"],
        generated_at=now,
    )
