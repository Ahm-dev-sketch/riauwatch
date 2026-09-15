"""Integration contract tests for Phase 4 API (require DATABASE_URL + PostGIS).

Seeds small TEST_-prefixed fixtures, exercises every endpoint, then cleans up.
Skipped automatically when the database is unreachable (see conftest engine fixture).
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.api.deps import get_db_dependency
from app.api.main import create_app
from app.db import get_session_factory
from app.models import Base

pytestmark = pytest.mark.integration

NOW = datetime(2026, 9, 15, 12, 0, tzinfo=UTC)

POLY_A = "MULTIPOLYGON(((100 0, 101 0, 101 1, 100 1, 100 0)))"
POLY_B = "MULTIPOLYGON(((101 0, 102 0, 102 1, 101 1, 101 0)))"

TEST_RUN_IDS = [str(uuid4()) for _ in range(6)]


def _seed(engine):
    """Create schema if needed and insert TEST fixtures; returns id map."""
    from sqlalchemy.exc import OperationalError, ProgrammingError

    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    except (OperationalError, ProgrammingError):
        pytest.skip("PostGIS extension unavailable — integration requires PostGIS")
    Base.metadata.create_all(engine, checkfirst=True)

    ids: dict[str, int] = {}
    with engine.begin() as conn:
        for key, name in [
            ("firms_viirs_nrt", "NASA FIRMS VIIRS NRT"),
            ("openaq_v3", "OpenAQ v3"),
            ("open_meteo", "Open-Meteo"),
        ]:
            conn.execute(
                text(
                    "INSERT INTO data_sources (key, name, provider_url, license_note, "
                    "attribution, update_interval_seconds, active) VALUES "
                    "(:k, :n, 'https://example.invalid/', 'test', 'test', 7200, TRUE) "
                    "ON CONFLICT (key) DO NOTHING"
                ),
                {"k": key, "n": name},
            )
            ids[key] = int(
                conn.execute(
                    text("SELECT id FROM data_sources WHERE key = :k"), {"k": key}
                ).scalar()
            )
        conn.execute(text("DELETE FROM hotspots WHERE area_id IN "
                          "(SELECT id FROM administrative_areas WHERE name LIKE 'TEST\\_%')"))
        for table in ("weather_observations", "air_quality_observations",
                      "risk_assessments", "monitoring_stations"):
            conn.execute(text(
                f"DELETE FROM {table} WHERE area_id IN "
                "(SELECT id FROM administrative_areas WHERE name LIKE 'TEST\\_%')"
                if table != "air_quality_observations" else
                "DELETE FROM air_quality_observations WHERE station_id IN "
                "(SELECT s.id FROM monitoring_stations s JOIN administrative_areas a "
                "ON a.id = s.area_id WHERE a.name LIKE 'TEST\\_%')"
            ))
        conn.execute(text("DELETE FROM monitoring_stations WHERE area_id IN "
                          "(SELECT id FROM administrative_areas WHERE name LIKE 'TEST\\_%')"))
        conn.execute(text("DELETE FROM administrative_areas WHERE name LIKE 'TEST\\_%'"))
        for name, poly in [("TEST_KAB_A", POLY_A), ("TEST_KAB_B", POLY_B)]:
            area_id = int(
                conn.execute(
                    text(
                        "INSERT INTO administrative_areas (name, level, geom) VALUES "
                        "(:n, 'kabupaten_kota', ST_GeomFromText(:g, 4326)) RETURNING id"
                    ),
                    {"n": name, "g": poly},
                ).scalar()
            )
            ids[name] = area_id
        # Hotspots: 2x h in A, 1x n in B.
        for lon, area, conf in [(100.2, "TEST_KAB_A", "h"), (100.3, "TEST_KAB_A", "h"),
                                (101.5, "TEST_KAB_B", "n")]:
            conn.execute(
                text(
                    "INSERT INTO hotspots (source_id, satellite, instrument, acquired_at, "
                    "geom, latitude, longitude, confidence, daynight, area_id) VALUES "
                    "(:s, 'S-NPP', 'VIIRS', :t, ST_SetSRID(ST_MakePoint(:lo, 0.5), 4326), "
                    "0.5, :lo, :c, 'D', :a)"
                ),
                {"s": ids["firms_viirs_nrt"], "t": NOW - timedelta(hours=5),
                 "lo": lon, "c": conf, "a": ids[area]},
            )
        # AQ station in A with pm25 (latest + older) and pm10.
        station_id = int(
            conn.execute(
                text(
                    "INSERT INTO monitoring_stations (source_id, external_id, name, geom, area_id) "
                    "VALUES (:s, 'TEST-ST-1', 'TEST Station 1', "
                    "ST_SetSRID(ST_MakePoint(100.4, 0.6), 4326), :a) RETURNING id"
                ),
                {"s": ids["openaq_v3"], "a": ids["TEST_KAB_A"]},
            ).scalar()
        )
        ids["station"] = station_id
        for pol, val, age_h in [("pm25", 42.5, 1), ("pm25", 40.0, 3), ("pm10", 60.0, 2)]:
            conn.execute(
                text(
                    "INSERT INTO air_quality_observations (station_id, pollutant, value, unit, "
                    "observed_at) VALUES (:st, :p, :v, 'ug/m3', :t)"
                ),
                {"st": station_id, "p": pol, "v": val, "t": NOW - timedelta(hours=age_h)},
            )
        # Weather: one current + two forecast rows for A.
        conn.execute(
            text(
                "INSERT INTO weather_observations (source_id, area_id, valid_time, is_forecast, "
                "temperature_c, humidity_pct) VALUES (:s, :a, :t, false, 31.5, 70)"
            ),
            {"s": ids["open_meteo"], "a": ids["TEST_KAB_A"], "t": NOW - timedelta(hours=1)},
        )
        for ahead, temp in [(3, 32.0), (6, 31.0)]:
            conn.execute(
                text(
                    "INSERT INTO weather_observations (source_id, area_id, valid_time, "
                    "is_forecast, temperature_c) VALUES (:s, :a, :t, true, :v)"
                ),
                {"s": ids["open_meteo"], "a": ids["TEST_KAB_A"],
                 "t": NOW + timedelta(hours=ahead), "v": temp},
            )
        # Logs: firms success; openaq 3 consecutive failures; open_meteo stale running.
        conn.execute(
            text(
                "INSERT INTO data_ingestion_logs (source_id, run_id, started_at, finished_at, "
                "status) VALUES (:s, :r, :t0, :t1, 'success')"
            ),
            {"s": ids["firms_viirs_nrt"], "r": TEST_RUN_IDS[0],
             "t0": NOW - timedelta(hours=2), "t1": NOW - timedelta(hours=2) + timedelta(minutes=5)},
        )
        for i, rid in enumerate(TEST_RUN_IDS[1:4]):
            conn.execute(
                text(
                    "INSERT INTO data_ingestion_logs (source_id, run_id, started_at, finished_at, "
                    "status, error_detail) VALUES (:s, :r, :t0, :t1, 'failed', 'boom')"
                ),
                {"s": ids["openaq_v3"], "r": rid,
                 "t0": NOW - timedelta(hours=2 * (i + 1)),
                 "t1": NOW - timedelta(hours=2 * (i + 1)) + timedelta(minutes=1)},
            )
        conn.execute(
            text(
                "INSERT INTO data_ingestion_logs (source_id, run_id, started_at, status) "
                "VALUES (:s, :r, :t0, 'running')"
            ),
            {"s": ids["open_meteo"], "r": TEST_RUN_IDS[4], "t0": NOW - timedelta(hours=5)},
        )
        # Risk: one assessment for A.
        conn.execute(
            text(
                "INSERT INTO risk_assessments (area_id, assessed_for, model_version, risk_level, "
                "score, factors) VALUES (:a, :t, 'rules-v0.1', 'moderate', 45.0, '{}')"
            ),
            {"a": ids["TEST_KAB_A"], "t": NOW - timedelta(hours=1)},
        )
    return ids


def _cleanup(engine):
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM weather_observations WHERE area_id IN "
                 "(SELECT id FROM administrative_areas WHERE name LIKE 'TEST\\_%')")
        )
        conn.execute(
            text("DELETE FROM air_quality_observations WHERE station_id IN "
                 "(SELECT s.id FROM monitoring_stations s JOIN administrative_areas a "
                 "ON a.id = s.area_id WHERE a.name LIKE 'TEST\\_%')")
        )
        conn.execute(
            text("DELETE FROM risk_assessments WHERE area_id IN "
                 "(SELECT id FROM administrative_areas WHERE name LIKE 'TEST\\_%')")
        )
        conn.execute(
            text("DELETE FROM hotspots WHERE area_id IN "
                 "(SELECT id FROM administrative_areas WHERE name LIKE 'TEST\\_%')")
        )
        conn.execute(
            text("DELETE FROM monitoring_stations WHERE area_id IN "
                 "(SELECT id FROM administrative_areas WHERE name LIKE 'TEST\\_%')")
        )
        conn.execute(text("DELETE FROM data_ingestion_logs WHERE run_id = ANY(:rids)"),
                     {"rids": TEST_RUN_IDS})
        conn.execute(text("DELETE FROM administrative_areas WHERE name LIKE 'TEST\\_%'"))


@pytest.fixture()
def api_client(engine):
    ids = _seed(engine)
    app = create_app()
    session_factory = get_session_factory()

    def _override():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db_dependency] = _override
    try:
        yield TestClient(app), ids
    finally:
        app.dependency_overrides.clear()
        _cleanup(engine)


RECENT_FROM = "2026-09-13T00:00:00Z"
RECENT_TO = "2026-09-16T00:00:00Z"


class TestStatusContract:
    def test_freshness_and_degraded(self, api_client):
        client, _ = api_client
        resp = client.get("/api/v1/status")
        assert resp.status_code == 200
        body = resp.json()
        for domain in ("hotspots", "air_quality", "weather"):
            assert body[domain]["last_observation_at"] is not None
        assert body["hotspots"]["last_successful_run_at"] is not None
        assert body["hotspots"]["degraded"] is False
        assert body["air_quality"]["degraded"] is True  # 3 consecutive failures
        assert body["weather"]["degraded"] is True  # stale 'running' row


class TestHotspotsContract:
    def test_list_geojson(self, api_client):
        client, _ = api_client
        resp = client.get("/api/v1/hotspots", params={"date_from": RECENT_FROM, "date_to": RECENT_TO})
        assert resp.status_code == 200
        body = resp.json()
        assert body["type"] == "FeatureCollection"
        assert "NOT confirmed fires" in body["disclaimer"]
        assert body["count"] >= 3
        props = body["features"][0]["properties"]
        assert props["hotspot_indication"] is True
        assert {"satellite", "confidence", "acquired_at", "area_name"} <= set(props)

    def test_confidence_filter(self, api_client):
        client, _ = api_client
        base = {"date_from": RECENT_FROM, "date_to": RECENT_TO}
        all_count = client.get("/api/v1/hotspots", params=base).json()["count"]
        h_count = client.get("/api/v1/hotspots", params={**base, "min_confidence": "h"}).json()["count"]
        assert 0 < h_count < all_count

    def test_pagination(self, api_client):
        client, _ = api_client
        base = {"date_from": RECENT_FROM, "date_to": RECENT_TO, "limit": 1}
        page1 = client.get("/api/v1/hotspots", params=base).json()
        page2 = client.get("/api/v1/hotspots", params={**base, "offset": 1}).json()
        assert page1["count"] == 1 and page2["count"] == 1
        assert page1["features"] != page2["features"]

    def test_bbox_caps(self, api_client):
        client, _ = api_client
        ok = client.get("/api/v1/hotspots", params={
            "bbox": "100.0,0.0,100.5,0.5", "date_from": RECENT_FROM, "date_to": RECENT_TO})
        assert ok.status_code == 200
        bad = client.get("/api/v1/hotspots", params={"bbox": "99.5,-2.0,103.0,2.5"})
        assert bad.status_code == 422

    def test_summary(self, api_client):
        client, ids = api_client
        resp = client.get("/api/v1/hotspots/summary",
                          params={"date_from": RECENT_FROM, "date_to": RECENT_TO})
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 3
        names = {i["kabupaten_name"] for i in body["items"]}
        assert {"TEST_KAB_A", "TEST_KAB_B"} <= names
        kab = client.get("/api/v1/hotspots/summary",
                         params={"date_from": RECENT_FROM, "date_to": RECENT_TO,
                                 "kabupaten_id": ids["TEST_KAB_A"]}).json()
        assert kab["total"] == 2


class TestAirQualityContract:
    def test_latest_near(self, api_client):
        client, _ = api_client
        resp = client.get("/api/v1/air-quality/latest", params={"near": "0.6,100.4"})
        assert resp.status_code == 200
        stations = resp.json()["stations"]
        assert stations
        first = stations[0]
        assert first["distance_km"] is not None
        assert first["category"] is None
        pollutants = {o["pollutant"] for o in first["observations"]}
        assert {"pm25", "pm10"} <= pollutants
        pm25 = next(o for o in first["observations"] if o["pollutant"] == "pm25")
        assert pm25["value"] == pytest.approx(42.5)  # latest per pollutant wins
        assert pm25["age_seconds"] >= 0

    def test_latest_by_kabupaten(self, api_client):
        client, ids = api_client
        resp = client.get("/api/v1/air-quality/latest", params={"kabupaten_id": ids["TEST_KAB_A"]})
        assert resp.status_code == 200
        assert resp.json()["stations"]

    def test_history(self, api_client):
        client, ids = api_client
        resp = client.get("/api/v1/air-quality/history", params={
            "station_id": ids["station"], "pollutant": "pm25",
            "from": RECENT_FROM, "to": RECENT_TO})
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["points"]) == 2
        times = [p["observed_at"] for p in body["points"]]
        assert times == sorted(times)
        assert body["points"][-1]["value"] == pytest.approx(42.5)

    def test_history_bad_pollutant(self, api_client):
        client, ids = api_client
        resp = client.get("/api/v1/air-quality/history",
                          params={"station_id": ids["station"], "pollutant": "xyz"})
        assert resp.status_code == 422


class TestWeatherContract:
    def test_current(self, api_client):
        client, ids = api_client
        resp = client.get("/api/v1/weather/current", params={"kabupaten_id": ids["TEST_KAB_A"]})
        assert resp.status_code == 200
        body = resp.json()
        assert body["area_name"] == "TEST_KAB_A"
        obs = body["observation"]
        assert obs["is_forecast"] is False
        assert obs["temperature_c"] == pytest.approx(31.5)
        assert obs["age_seconds"] is not None

    def test_current_near(self, api_client):
        client, _ = api_client
        resp = client.get("/api/v1/weather/current", params={"near": "0.5,100.5"})
        assert resp.status_code == 200

    def test_forecast(self, api_client):
        client, _ = api_client
        resp = client.get("/api/v1/weather/forecast", params={"near": "0.5,100.5", "hours": 24})
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["forecast"]) == 2
        times = [f["valid_time"] for f in body["forecast"]]
        assert times == sorted(times)


class TestRiskAreasMetaContract:
    def test_risk_current(self, api_client):
        client, ids = api_client
        resp = client.get("/api/v1/risk/current", params={"kabupaten_id": ids["TEST_KAB_A"]})
        assert resp.status_code == 200
        body = resp.json()
        assert body["note"] is None
        assert body["assessments"][0]["risk_level"] == "moderate"

    def test_risk_empty_model_version(self, api_client):
        client, _ = api_client
        resp = client.get("/api/v1/risk/current", params={"model_version": "ml-v9.9"})
        assert resp.status_code == 200
        assert resp.json() == {"assessments": [], "note": "risk_not_yet_computed"}

    def test_areas_geojson(self, api_client):
        client, _ = api_client
        resp = client.get("/api/v1/administrative-areas")
        assert resp.status_code == 200
        body = resp.json()
        assert body["type"] == "FeatureCollection"
        assert body["features"]
        assert body["features"][0]["geometry"]["type"] == "MultiPolygon"

    def test_areas_simplify(self, api_client):
        client, _ = api_client
        resp = client.get("/api/v1/administrative-areas", params={"simplify": 0.01})
        assert resp.status_code == 200

    def test_lookup(self, api_client):
        client, ids = api_client
        resp = client.get("/api/v1/administrative-areas/lookup",
                          params={"lat": 0.5, "lon": 100.5})
        assert resp.status_code == 200
        body = resp.json()
        assert body == {"id": ids["TEST_KAB_A"], "name": "TEST_KAB_A", "level": "kabupaten_kota"}

    def test_meta_sources(self, api_client):
        client, _ = api_client
        resp = client.get("/api/v1/meta/data-sources")
        assert resp.status_code == 200
        keys = {s["key"] for s in resp.json()["sources"]}
        assert {"firms_viirs_nrt", "openaq_v3", "open_meteo"} <= keys
        firms = next(s for s in resp.json()["sources"] if s["key"] == "firms_viirs_nrt")
        assert firms["attribution"]
