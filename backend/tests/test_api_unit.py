"""Unit tests for Phase 4 public read API (no infrastructure required)."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import get_db_dependency
from app.api.errors import RateLimitMiddleware
from app.api.main import create_app
from app.api.routers import _common as c

# =============================================================================
# Pure validators
# =============================================================================


class TestParseBbox:
    def test_valid(self):
        assert c.parse_bbox("100.0,0.0,100.5,0.5") == (100.0, 0.0, 100.5, 0.5)

    def test_bad_count(self):
        with pytest.raises(ValueError):
            c.parse_bbox("100.0,0.0,100.5")

    def test_non_numeric(self):
        with pytest.raises(ValueError):
            c.parse_bbox("a,b,c,d")

    def test_lon_out_of_range(self):
        with pytest.raises(ValueError):
            c.parse_bbox("200.0,0.0,201.0,0.5")

    def test_lat_out_of_range(self):
        with pytest.raises(ValueError):
            c.parse_bbox("100.0,-95.0,100.5,0.5")

    def test_west_not_less_than_east(self):
        with pytest.raises(ValueError):
            c.parse_bbox("101.0,0.0,100.0,0.5")

    def test_south_not_less_than_north(self):
        with pytest.raises(ValueError):
            c.parse_bbox("100.0,0.5,100.5,0.0")

    def test_span_x_too_wide(self):
        with pytest.raises(ValueError):
            c.parse_bbox("99.5,-2.0,103.0,2.5")

    def test_span_y_too_wide(self):
        with pytest.raises(ValueError):
            c.parse_bbox("100.0,-1.0,100.5,1.5")


class TestParseNear:
    def test_valid(self):
        assert c.parse_near("0.5,101.4") == (0.5, 101.4)

    def test_bad_shape(self):
        with pytest.raises(ValueError):
            c.parse_near("0.5")

    def test_lat_out_of_range(self):
        with pytest.raises(ValueError):
            c.parse_near("91.0,101.4")

    def test_lon_out_of_range(self):
        with pytest.raises(ValueError):
            c.parse_near("0.5,181.0")


class TestResolveDateRange:
    NOW = datetime(2026, 9, 15, 12, 0, tzinfo=UTC)

    def test_defaults_last_48h(self):
        start, end = c.resolve_date_range(
            None, None, default_lookback_hours=48, max_range_days=30, now=self.NOW
        )
        assert end == self.NOW
        assert start == self.NOW - timedelta(hours=48)

    def test_explicit_iso_z_suffix(self):
        start, end = c.resolve_date_range(
            "2026-09-10T00:00:00Z",
            "2026-09-12T00:00:00Z",
            default_lookback_hours=48,
            max_range_days=30,
            now=self.NOW,
        )
        assert (end - start).days == 2

    def test_naive_assumed_utc(self):
        start, _ = c.resolve_date_range(
            "2026-09-10T00:00:00",
            None,
            default_lookback_hours=48,
            max_range_days=30,
            now=self.NOW,
        )
        assert start.tzinfo is not None

    def test_from_after_to(self):
        with pytest.raises(ValueError):
            c.resolve_date_range(
                "2026-09-12T00:00:00Z",
                "2026-09-10T00:00:00Z",
                default_lookback_hours=48,
                max_range_days=30,
                now=self.NOW,
            )

    def test_range_over_30d_rejected(self):
        with pytest.raises(ValueError):
            c.resolve_date_range(
                "2026-08-01T00:00:00Z",
                "2026-09-15T00:00:00Z",
                default_lookback_hours=48,
                max_range_days=30,
                now=self.NOW,
            )

    def test_range_over_90d_rejected_for_history(self):
        with pytest.raises(ValueError):
            c.resolve_date_range(
                "2026-05-01T00:00:00Z",
                "2026-09-15T00:00:00Z",
                default_lookback_hours=168,
                max_range_days=90,
                now=self.NOW,
            )


class TestAllowedConfidences:
    def test_none_means_no_filter(self):
        assert c.allowed_confidences(None) is None

    def test_ordering_l_lt_n_lt_h(self):
        assert set(c.allowed_confidences("l") or []) == {"l", "n", "h"}
        assert set(c.allowed_confidences("n") or []) == {"n", "h"}
        assert c.allowed_confidences("h") == ["h"]

    def test_invalid(self):
        with pytest.raises(ValueError):
            c.allowed_confidences("x")


class TestComputeDegraded:
    def test_healthy(self):
        assert c.compute_degraded(["success", "success", "success"], False, 3) is False

    def test_three_consecutive_failures(self):
        assert c.compute_degraded(["failed", "failed", "failed"], False, 3) is True

    def test_partial_counts_as_failure(self):
        assert c.compute_degraded(["partial", "failed", "partial"], False, 3) is True

    def test_success_breaks_chain(self):
        assert c.compute_degraded(["failed", "failed", "success", "failed"], False, 3) is False

    def test_too_few_runs_not_degraded(self):
        assert c.compute_degraded(["failed", "failed"], False, 3) is False

    def test_no_runs_not_degraded(self):
        assert c.compute_degraded([], False, 3) is False

    def test_stale_running_degrades(self):
        assert c.compute_degraded(["success"], True, 3) is True
        assert c.compute_degraded([], True, 3) is True


class TestAgeSeconds:
    def test_non_negative(self):
        future = datetime.now(UTC) + timedelta(hours=1)
        assert c.age_seconds(future) == 0

    def test_positive(self):
        past = datetime.now(UTC) - timedelta(seconds=90)
        assert 80 <= c.age_seconds(past) <= 120


# =============================================================================
# Rate limiter
# =============================================================================


def _limited_app(limit: int) -> FastAPI:
    app = FastAPI()

    @app.get("/ping")
    def ping() -> dict[str, str]:
        return {"pong": "yes"}

    app.add_middleware(RateLimitMiddleware, requests_per_minute=limit)
    return app


class TestRateLimiter:
    def test_allows_then_429s_with_retry_after(self):
        client = TestClient(_limited_app(2))
        assert client.get("/ping").status_code == 200
        assert client.get("/ping").status_code == 200
        resp = client.get("/ping")
        assert resp.status_code == 429
        assert "Retry-After" in resp.headers
        assert resp.headers["content-type"] == "application/problem+json"
        body = resp.json()
        assert body["status"] == 429
        assert {"type", "title", "status", "detail"} <= set(body)

    def test_rate_limit_headers_on_success(self):
        client = TestClient(_limited_app(10))
        resp = client.get("/ping")
        assert resp.status_code == 200
        assert resp.headers["X-RateLimit-Limit"] == "10"
        assert "X-RateLimit-Remaining" in resp.headers


# =============================================================================
# Error shapes via dependency-overridden DB
# =============================================================================


class _FakeMappings:
    def __init__(self, rows: list[dict]):
        self._rows = rows

    def all(self) -> list[dict]:
        return self._rows

    def first(self) -> dict | None:
        return self._rows[0] if self._rows else None


class _FakeResult:
    def __init__(self, rows: list[dict] | None = None, scalar: object = None):
        self._rows = rows or []
        self._scalar = scalar

    def mappings(self) -> _FakeMappings:
        return _FakeMappings(self._rows)

    def scalar(self) -> object:
        return self._scalar


class FakeSession:
    """Minimal stub of a SQLAlchemy Session dispatching canned rows by SQL text."""

    def __init__(self, handler=None):
        self._handler = handler or (lambda sql, params: _FakeResult())
        self.executed: list[str] = []

    def execute(self, statement, params=None):
        sql = str(statement)
        self.executed.append(sql)
        return self._handler(sql, params or {})


HOTSPOT_ROW = {
    "id": 1,
    "geometry": '{"type":"Point","coordinates":[100.5,0.5]}',
    "satellite": "S-NPP",
    "instrument": "VIIRS",
    "confidence": "h",
    "confidence_value": 85.0,
    "daynight": "D",
    "acquired_at": datetime(2026, 9, 14, 10, 30, tzinfo=UTC),
    "area_name": "Pekanbaru",
}


def _hotspot_handler(sql: str, params: dict):
    if "GROUP BY" in sql:
        return _FakeResult(
            rows=[{"area_id": 7, "area_name": "Pekanbaru", "count": 1}]
        )
    if "ST_AsGeoJSON(h.geom)" in sql:
        return _FakeResult(rows=[HOTSPOT_ROW])
    if "COUNT(*)" in sql:
        return _FakeResult(scalar=1)
    return _FakeResult()


def _status_handler_factory(runs: list[dict], last_obs=None, last_ok=None):
    def handler(sql: str, params: dict):
        if "AS last_obs" in sql:
            return _FakeResult(scalar=last_obs)
        if "AS last_ok" in sql:
            return _FakeResult(scalar=last_ok)
        if "source_key" in sql:
            pat = str(params.get("pat", ""))
            prefix = pat.rstrip("%")
            return _FakeResult(rows=[r for r in runs if r["source_key"].startswith(prefix)])
        return _FakeResult()

    return handler


@pytest.fixture()
def hotspot_client():
    app = create_app()
    app.dependency_overrides[get_db_dependency] = lambda: FakeSession(_hotspot_handler)
    try:
        yield TestClient(app, raise_server_exceptions=False)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
def empty_client():
    app = create_app()
    app.dependency_overrides[get_db_dependency] = lambda: FakeSession()
    try:
        yield TestClient(app, raise_server_exceptions=False)
    finally:
        app.dependency_overrides.clear()


class TestValidationShapes:
    def test_bad_bbox_422_problem(self, hotspot_client):
        resp = hotspot_client.get("/api/v1/hotspots", params={"bbox": "garbage"})
        assert resp.status_code == 422
        assert resp.headers["content-type"] == "application/problem+json"
        assert resp.json()["status"] == 422

    def test_oversize_bbox_422(self, hotspot_client):
        resp = hotspot_client.get(
            "/api/v1/hotspots", params={"bbox": "99.5,-2.0,103.0,2.5"}
        )
        assert resp.status_code == 422

    def test_limit_cap_422(self, hotspot_client):
        assert hotspot_client.get("/api/v1/hotspots", params={"limit": 2001}).status_code == 422

    def test_bad_confidence_422(self, hotspot_client):
        resp = hotspot_client.get("/api/v1/hotspots", params={"min_confidence": "x"})
        assert resp.status_code == 422

    def test_date_range_too_wide_422(self, hotspot_client):
        resp = hotspot_client.get(
            "/api/v1/hotspots",
            params={"date_from": "2026-01-01T00:00:00Z", "date_to": "2026-09-15T00:00:00Z"},
        )
        assert resp.status_code == 422

    def test_lookup_missing_params_422(self, empty_client):
        assert empty_client.get("/api/v1/administrative-areas/lookup").status_code == 422

    def test_lookup_bad_lat_422(self, empty_client):
        resp = empty_client.get(
            "/api/v1/administrative-areas/lookup", params={"lat": 999, "lon": 100}
        )
        assert resp.status_code == 422
        assert resp.json()["title"] == "Validation Error"

    def test_forecast_bad_near_422(self, empty_client):
        assert empty_client.get("/api/v1/weather/forecast", params={"near": "invalid"}).status_code == 422

    def test_forecast_hours_cap_422(self, empty_client):
        resp = empty_client.get(
            "/api/v1/weather/forecast", params={"near": "0.5,101.4", "hours": 73}
        )
        assert resp.status_code == 422


class TestNotFoundShapes:
    def test_lookup_miss_404_problem(self, empty_client):
        resp = empty_client.get(
            "/api/v1/administrative-areas/lookup", params={"lat": 0.5, "lon": 100.5}
        )
        assert resp.status_code == 404
        assert resp.headers["content-type"] == "application/problem+json"
        body = resp.json()
        assert body["status"] == 404
        assert body["title"] == "Not Found"
        assert "instance" in body

    def test_weather_current_unknown_area_404(self, empty_client):
        resp = empty_client.get("/api/v1/weather/current", params={"kabupaten_id": 424242})
        assert resp.status_code == 404


class TestContractShapes:
    def test_hotspots_geojson_and_disclaimer(self, hotspot_client):
        resp = hotspot_client.get("/api/v1/hotspots")
        assert resp.status_code == 200
        body = resp.json()
        assert body["type"] == "FeatureCollection"
        assert "NOT confirmed fires" in body["disclaimer"]
        assert body["count"] == 1
        feature = body["features"][0]
        assert feature["type"] == "Feature"
        assert feature["geometry"]["type"] == "Point"
        props = feature["properties"]
        assert props["hotspot_indication"] is True
        assert props["satellite"] == "S-NPP"
        assert props["confidence"] == "h"
        assert "area_name" in props

    def test_hotspots_summary(self, hotspot_client):
        resp = hotspot_client.get("/api/v1/hotspots/summary")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["kabupaten_name"] == "Pekanbaru"

    def test_risk_empty_note(self, empty_client):
        resp = empty_client.get("/api/v1/risk/current")
        assert resp.status_code == 200
        body = resp.json()
        assert body["assessments"] == []
        assert body["note"] == "risk_not_yet_computed"

    def test_meta_sources_empty_ok(self, empty_client):
        resp = empty_client.get("/api/v1/meta/data-sources")
        assert resp.status_code == 200
        assert resp.json() == {"sources": []}

    def test_status_shape_and_degraded_transitions(self):
        runs = [
            {"source_key": "firms_viirs_nrt", "status": "failed", "started_at": "x"},
            {"source_key": "firms_viirs_nrt", "status": "failed", "started_at": "x"},
            {"source_key": "firms_viirs_nrt", "status": "failed", "started_at": "x"},
            {"source_key": "openaq_v3", "status": "success", "started_at": "x"},
        ]
        app = create_app()
        app.dependency_overrides[get_db_dependency] = lambda: FakeSession(
            _status_handler_factory(
                runs,
                last_obs=datetime(2026, 9, 14, tzinfo=UTC),
                last_ok=datetime(2026, 9, 13, tzinfo=UTC),
            )
        )
        try:
            resp = TestClient(app).get("/api/v1/status")
        finally:
            app.dependency_overrides.clear()
        assert resp.status_code == 200
        body = resp.json()
        assert set(body) == {"hotspots", "air_quality", "weather", "generated_at"}
        assert body["hotspots"]["degraded"] is True
        assert body["air_quality"]["degraded"] is False
        assert body["weather"]["degraded"] is False  # no runs: no evidence of failure
        assert body["hotspots"]["last_observation_at"] is not None
        assert body["hotspots"]["last_successful_run_at"] is not None

    def test_no_sql_leak_on_db_error(self):
        class ExplodingSession(FakeSession):
            def execute(self, statement, params=None):
                raise SQLAlchemyError("SELECT * FROM secret_table WHERE x")

        app = create_app()
        app.dependency_overrides[get_db_dependency] = lambda: ExplodingSession()
        try:
            resp = TestClient(app, raise_server_exceptions=False).get("/api/v1/hotspots")
        finally:
            app.dependency_overrides.clear()
        assert resp.status_code == 500
        assert "secret_table" not in resp.text


class TestReadOnlyDiscipline:
    def test_api_layer_never_imports_ingest(self):
        api_dir = Path(__file__).resolve().parent.parent / "app" / "api"
        offenders = [
            p.name
            for p in api_dir.rglob("*.py")
            if "app.ingest" in p.read_text(encoding="utf-8")
            or "app/worker" in p.read_text(encoding="utf-8").replace("\\", "/")
            or "from app import worker" in p.read_text(encoding="utf-8")
        ]
        assert offenders == []
