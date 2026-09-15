"""Shared pure validators/helpers for API v1 routers.

DB-free by design so unit tests exercise them without infrastructure.
Endpoint code converts ValueError into HTTP 422 (problem+json via handlers).
"""

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException

# Confidence vocabulary ordering: l < n < h (VIIRS normalized).
CONFIDENCE_ORDER = {"l": 0, "n": 1, "h": 2}

# Max bbox span per axis in degrees (map-viewport guard).
MAX_BBOX_SPAN_DEG = 1.0

# Pollutants accepted by air-quality history (matches DB CHECK constraint).
POLLUTANTS = ("pm25", "pm10", "o3", "no2", "so2", "co")

# Administrative levels (matches DB CHECK constraint).
AREA_LEVELS = ("provinsi", "kabupaten_kota", "kecamatan")


def utcnow() -> datetime:
    """Timezone-aware UTC now."""
    return datetime.now(UTC)


def unprocessable(message: str) -> HTTPException:
    """Build an HTTP 422 error rendered as problem+json by the global handler."""
    return HTTPException(status_code=422, detail=message)


def not_found(message: str) -> HTTPException:
    """Build an HTTP 404 error rendered as problem+json by the global handler."""
    return HTTPException(status_code=404, detail=message)


def parse_bbox(value: str) -> tuple[float, float, float, float]:
    """Parse 'west,south,east,north'; raises ValueError on any violation.

    Rules: lon in [-180,180], lat in [-90,90], west<east, south<north,
    span <= MAX_BBOX_SPAN_DEG on each axis.
    """
    try:
        parts = [float(p.strip()) for p in value.split(",")]
    except ValueError:
        raise ValueError("bbox must be four comma-separated numbers: west,south,east,north") from None
    if len(parts) != 4:
        raise ValueError("bbox must be four comma-separated numbers: west,south,east,north")
    west, south, east, north = parts
    if not (-180 <= west <= 180 and -180 <= east <= 180):
        raise ValueError("bbox longitudes (west,east) must be within [-180, 180]")
    if not (-90 <= south <= 90 and -90 <= north <= 90):
        raise ValueError("bbox latitudes (south,north) must be within [-90, 90]")
    if not west < east:
        raise ValueError("bbox requires west < east")
    if not south < north:
        raise ValueError("bbox requires south < north")
    if east - west > MAX_BBOX_SPAN_DEG or north - south > MAX_BBOX_SPAN_DEG:
        raise ValueError(
            f"bbox span exceeds {MAX_BBOX_SPAN_DEG} degree per axis "
            "(zoom in or split the viewport)"
        )
    return west, south, east, north


def parse_near(value: str) -> tuple[float, float]:
    """Parse 'lat,lon'; returns (lat, lon); raises ValueError on any violation."""
    try:
        parts = [float(p.strip()) for p in value.split(",")]
    except ValueError:
        raise ValueError("near must be two comma-separated numbers: lat,lon") from None
    if len(parts) != 2:
        raise ValueError("near must be two comma-separated numbers: lat,lon")
    lat, lon = parts
    if not -90 <= lat <= 90:
        raise ValueError("near latitude must be within [-90, 90]")
    if not -180 <= lon <= 180:
        raise ValueError("near longitude must be within [-180, 180]")
    return lat, lon


def parse_iso_datetime(value: str) -> datetime:
    """Parse an ISO 8601 datetime; naive values are assumed UTC. Raises ValueError."""
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise ValueError(f"invalid ISO 8601 datetime: {value!r}") from None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed


def resolve_date_range(
    date_from: str | None,
    date_to: str | None,
    *,
    default_lookback_hours: float,
    max_range_days: float,
    now: datetime | None = None,
) -> tuple[datetime, datetime]:
    """Resolve (from, to) with defaults; raises ValueError when from > to or range too wide."""
    ref = now or utcnow()
    try:
        start = parse_iso_datetime(date_from) if date_from is not None else ref - timedelta(hours=default_lookback_hours)
        end = parse_iso_datetime(date_to) if date_to is not None else ref
    except ValueError as exc:
        raise ValueError(str(exc)) from None
    if start > end:
        raise ValueError("date_from must not be later than date_to")
    if (end - start).total_seconds() > max_range_days * 86400:
        raise ValueError(f"date range exceeds maximum of {max_range_days:g} days")
    return start, end


def allowed_confidences(min_confidence: str | None) -> list[str] | None:
    """Return the confidence values admitted by an l<n<h minimum; None = no filter.

    Raises ValueError for unknown levels.
    """
    if min_confidence is None:
        return None
    if min_confidence not in CONFIDENCE_ORDER:
        raise ValueError("min_confidence must be one of 'l', 'n', 'h' (l < n < h)")
    rank = CONFIDENCE_ORDER[min_confidence]
    return [level for level, rank_of in CONFIDENCE_ORDER.items() if rank_of >= rank]


def compute_degraded(
    recent_completed_statuses: list[str],
    has_stale_running: bool,
    threshold: int,
) -> bool:
    """Pure degradation predicate (unit-testable with synthetic run lists).

    recent_completed_statuses: most-recent-first statuses of finished runs
        ('success'/'partial'/'failed'); in-progress 'running' rows are excluded
        by the caller and reported separately via has_stale_running.
    Degraded when the N most-recent finished runs are all failed/partial,
    or when a 'running' row is older than the stale timeout.
    """
    if has_stale_running:
        return True
    if len(recent_completed_statuses) < threshold:
        return False
    window = recent_completed_statuses[:threshold]
    return all(status in ("failed", "partial") for status in window)


def age_seconds(observed_at: datetime, now: datetime | None = None) -> int:
    """Age of an observation in whole seconds (never negative)."""
    ref = now or utcnow()
    if observed_at.tzinfo is None:
        observed_at = observed_at.replace(tzinfo=UTC)
    return max(0, int((ref - observed_at).total_seconds()))


def as_float(value: object) -> float | None:
    """Coerce NUMERIC/Decimal DB values to float (None-safe)."""
    return None if value is None else float(value)  # type: ignore[arg-type]
