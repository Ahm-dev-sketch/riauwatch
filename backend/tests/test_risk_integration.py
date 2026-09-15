"""Integration tests for risk recompute (require DATABASE_URL + PostGIS).

Seeds TEST_RISK_ fixtures, runs the recompute job, asserts rows + upsert-on-rerun.
Skipped automatically when the database is unreachable (conftest engine fixture).
"""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from app.db import get_session_factory
from app.models import Base
from app.risk import config as C
from app.risk.recompute import run_risk_recompute

pytestmark = pytest.mark.integration

POLY_A = "MULTIPOLYGON(((100 0, 100.1 0, 100.1 0.1, 100 0.1, 100 0)))"
POLY_B = "MULTIPOLYGON(((101 0, 101.1 0, 101.1 0.1, 101 0.1, 101 0)))"


def _seed(engine):
    """Seed sources, two TEST_RISK_ areas, hotspots, weather, and a fresh FIRMS log."""
    from sqlalchemy.exc import OperationalError, ProgrammingError

    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    except (OperationalError, ProgrammingError):
        pytest.skip("PostGIS extension unavailable — integration requires PostGIS")
    Base.metadata.create_all(engine, checkfirst=True)

    now = datetime.now(UTC)
    ids: dict[str, int] = {}
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO data_sources (key, name, provider_url, license_note, "
                "attribution, update_interval_seconds, active) VALUES "
                "('firms_viirs_nrt', 'NASA FIRMS VIIRS NRT', 'https://example.invalid/', "
                "'test', 'test', 7200, TRUE) ON CONFLICT (key) DO NOTHING"
            )
        )
        ids["firms"] = int(
            conn.execute(
                text("SELECT id FROM data_sources WHERE key = 'firms_viirs_nrt'")
            ).scalar()
        )
        conn.execute(
            text(
                "INSERT INTO data_sources (key, name, provider_url, license_note, "
                "attribution, update_interval_seconds, active) VALUES "
                "('open_meteo', 'Open-Meteo', 'https://example.invalid/', "
                "'test', 'test', 7200, TRUE) ON CONFLICT (key) DO NOTHING"
            )
        )
        ids["meteo"] = int(
            conn.execute(text("SELECT id FROM data_sources WHERE key = 'open_meteo'")).scalar()
        )
        conn.execute(
            text("DELETE FROM risk_assessments WHERE area_id IN "
                 "(SELECT id FROM administrative_areas WHERE name LIKE 'TEST\\_RISK\\_%')")
        )
        conn.execute(
            text("DELETE FROM weather_observations WHERE area_id IN "
                 "(SELECT id FROM administrative_areas WHERE name LIKE 'TEST\\_RISK\\_%')")
        )
        conn.execute(
            text("DELETE FROM hotspots WHERE area_id IN "
                 "(SELECT id FROM administrative_areas WHERE name LIKE 'TEST\\_RISK\\_%')")
        )
        conn.execute(text("DELETE FROM administrative_areas WHERE name LIKE 'TEST\\_RISK\\_%'"))
        for name, poly in [("TEST_RISK_A", POLY_A), ("TEST_RISK_B", POLY_B)]:
            ids[name] = int(
                conn.execute(
                    text(
                        "INSERT INTO administrative_areas (name, level, geom) VALUES "
                        "(:n, 'kabupaten_kota', ST_GeomFromText(:g, 4326)) RETURNING id"
                    ),
                    {"n": name, "g": poly},
                ).scalar()
            )
        # Area A: 3 VIIRS-h + 1 MODIS-85 (counted) + 1 VIIRS-l + 1 MODIS-10 (excluded).
        hotspots = [
            ("S-NPP", "VIIRS", "h", None, 100.02),
            ("NOAA-20", "VIIRS", "h", None, 100.04),
            ("S-NPP", "VIIRS", "n", None, 100.06),
            ("Terra", "MODIS", "h", 85.0, 100.03),
            ("S-NPP", "VIIRS", "l", None, 100.05),
            ("Aqua", "MODIS", "l", 10.0, 100.07),
        ]
        for i, (sat, inst, conf, conf_val, lon) in enumerate(hotspots):
            conn.execute(
                text(
                    "INSERT INTO hotspots (source_id, satellite, instrument, acquired_at, "
                    "geom, latitude, longitude, confidence, confidence_value, area_id) VALUES "
                    "(:s, :sat, :inst, :t, ST_SetSRID(ST_MakePoint(:lo, 0.05), 4326), "
                    "0.05, :lo, :c, :cv, :a)"
                ),
                {
                    "s": ids["firms"],
                    "sat": sat,
                    "inst": inst,
                    "t": now - timedelta(hours=5 + i),
                    "lo": lon,
                    "c": conf,
                    "cv": conf_val,
                    "a": ids["TEST_RISK_A"],
                },
            )
        # Area A weather: dry, hot, windy recent conditions.
        for hours_ago, rain, hum, temp, wind in [
            (2, 0.0, 45.0, 34.0, 18.0),
            (6, 1.0, 50.0, 33.0, 15.0),
            (12, 0.5, 55.0, 32.0, 12.0),
            (30, 2.0, 60.0, 31.0, 10.0),  # outside 24h window, inside 7d
        ]:
            conn.execute(
                text(
                    "INSERT INTO weather_observations (source_id, area_id, valid_time, "
                    "is_forecast, temperature_c, humidity_pct, precipitation_mm, "
                    "wind_speed_kmh) VALUES (:s, :a, :t, false, :te, :h, :r, :w)"
                ),
                {
                    "s": ids["meteo"],
                    "a": ids["TEST_RISK_A"],
                    "t": now - timedelta(hours=hours_ago),
                    "te": temp,
                    "h": hum,
                    "r": rain,
                    "w": wind,
                },
            )
        # Fresh successful FIRMS run => hotspot factor trusted.
        conn.execute(
            text(
                "INSERT INTO data_ingestion_logs (source_id, run_id, started_at, finished_at, "
                "status) VALUES (:s, gen_random_uuid(), :t0, :t1, 'success')"
            ),
            {"s": ids["firms"], "t0": now - timedelta(hours=1), "t1": now - timedelta(minutes=50)},
        )
    return ids


def _cleanup(engine, run_ids: list[str]):
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM risk_assessments WHERE area_id IN "
                 "(SELECT id FROM administrative_areas WHERE name LIKE 'TEST\\_RISK\\_%')")
        )
        conn.execute(
            text("DELETE FROM weather_observations WHERE area_id IN "
                 "(SELECT id FROM administrative_areas WHERE name LIKE 'TEST\\_RISK\\_%')")
        )
        conn.execute(
            text("DELETE FROM hotspots WHERE area_id IN "
                 "(SELECT id FROM administrative_areas WHERE name LIKE 'TEST\\_RISK\\_%')")
        )
        conn.execute(text("DELETE FROM administrative_areas WHERE name LIKE 'TEST\\_RISK\\_%'"))
        if run_ids:
            conn.execute(
                text("DELETE FROM data_ingestion_logs WHERE run_id = ANY(:rids)"),
                {"rids": run_ids},
            )


def _risk_rows(engine, area_id: int):
    with engine.begin() as conn:
        return conn.execute(
            text(
                "SELECT assessed_for, horizon, model_version, risk_level, score, factors "
                "FROM risk_assessments WHERE area_id = :a ORDER BY assessed_for DESC"
            ),
            {"a": area_id},
        ).mappings().all()


class TestRiskRecompute:
    def test_recompute_writes_rows_and_upserts_on_rerun(self, engine):
        ids = _seed(engine)
        run_ids: list[str] = []
        try:
            summary = run_risk_recompute(get_session_factory())
            assert summary["status"] == "success"
            run_ids.append(summary["run_id"])

            rows_a = _risk_rows(engine, ids["TEST_RISK_A"])
            assert len(rows_a) == 1
            row = dict(rows_a[0])
            assert row["horizon"] == "current"
            assert row["model_version"] == C.MODEL_VERSION
            assert row["risk_level"] in ("low", "moderate", "high", "very_high", "extreme")
            assert row["score"] is not None and 0 <= float(row["score"]) <= 100
            factors = row["factors"]
            assert factors["model_version"] == C.MODEL_VERSION
            assert {f["name"] for f in factors["factors"]} >= {
                "hotspot_density_48h",
                "rainfall_7d",
                "humidity_24h",
                "temperature_24h_max",
                "wind_24h_mean",
                "fuel_index",
            }
            hotspot = next(f for f in factors["factors"] if f["name"] == "hotspot_density_48h")
            assert hotspot["available"] is True
            # 4 of 6 seeded hotspots pass the confidence filter.
            assert hotspot["reason"].startswith("4 indikasi titik panas")
            assert factors["observed_window"]["from"] is not None

            # Area B has no weather: coverage 0.35 < floor => honest INSUFFICIENT.
            rows_b = _risk_rows(engine, ids["TEST_RISK_B"])
            assert len(rows_b) == 1
            assert dict(rows_b[0])["risk_level"] is None
            assert dict(rows_b[0])["score"] is None

            # Rerun within the same hour: same upsert key => row count unchanged.
            summary2 = run_risk_recompute(get_session_factory())
            run_ids.append(summary2["run_id"])
            assert len(_risk_rows(engine, ids["TEST_RISK_A"])) == 1
            assert len(_risk_rows(engine, ids["TEST_RISK_B"])) == 1
        finally:
            _cleanup(engine, run_ids)
