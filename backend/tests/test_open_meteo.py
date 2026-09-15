"""Unit tests for Open-Meteo adapter (no DB required)."""

import json
from datetime import UTC, datetime, timedelta

from app.ingest.open_meteo import OpenMeteoRunner, classify_is_forecast


class TestClassifyIsForecast:
    """Tests for the is_forecast boundary classification function."""

    def test_analysis_before_last_complete_hour(self):
        """Times at or before last complete hour should be analysis (False)."""
        # Reference time: 2026-08-20 12:30 UTC
        # Last complete hour: 2026-08-20 12:00 UTC
        ref = datetime(2026, 8, 20, 12, 30, tzinfo=UTC)

        # 11:00 UTC is before last complete hour
        assert classify_is_forecast(datetime(2026, 8, 20, 11, 0, tzinfo=UTC), ref) is False
        # 12:00 UTC is exactly last complete hour
        assert classify_is_forecast(datetime(2026, 8, 20, 12, 0, tzinfo=UTC), ref) is False

    def test_forecast_after_last_complete_hour(self):
        """Times after last complete hour should be forecast (True)."""
        # Reference time: 2026-08-20 12:30 UTC
        # Last complete hour: 2026-08-20 12:00 UTC
        ref = datetime(2026, 8, 20, 12, 30, tzinfo=UTC)

        # 12:30 UTC is after last complete hour
        assert classify_is_forecast(datetime(2026, 8, 20, 12, 30, tzinfo=UTC), ref) is True
        # 13:00 UTC is after last complete hour
        assert classify_is_forecast(datetime(2026, 8, 20, 13, 0, tzinfo=UTC), ref) is True

    def test_exactly_on_hour_boundary(self):
        """When reference is exactly on hour boundary, last complete hour is previous hour."""
        # Reference time: 2026-08-20 12:00:00 UTC exactly
        # Last complete hour should be 11:00 UTC
        ref = datetime(2026, 8, 20, 12, 0, 0, tzinfo=UTC)

        # 11:00 UTC is last complete hour
        assert classify_is_forecast(datetime(2026, 8, 20, 11, 0, tzinfo=UTC), ref) is False
        # 12:00 UTC is after last complete hour (which is 11:00)
        assert classify_is_forecast(datetime(2026, 8, 20, 12, 0, tzinfo=UTC), ref) is True

    def test_past_days_are_analysis(self):
        """Past days should always be classified as analysis."""
        ref = datetime(2026, 8, 20, 12, 30, tzinfo=UTC)

        # 7 days ago
        past = ref - timedelta(days=7)
        assert classify_is_forecast(past, ref) is False

        # 1 day ago
        past = ref - timedelta(days=1)
        assert classify_is_forecast(past, ref) is False


class TestOpenMeteoResponseParsing:
    """Tests for parsing the REAL Open-Meteo fixture."""

    def test_parse_real_fixture(self):
        """Parse the real pekanbaru_forecast.json fixture."""
        fixture_path = "../tests/fixtures/open_meteo/pekanbaru_forecast.json"
        with open(fixture_path, encoding="utf-8") as f:
            data = json.load(f)

        # Verify structure
        assert "hourly" in data
        assert "hourly_units" in data
        assert "timezone" in data
        assert data["timezone"] == "Asia/Jakarta"

        hourly = data["hourly"]
        assert "time" in hourly
        assert len(hourly["time"]) > 0

        # Verify all expected variables present
        for var in ["temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m", "wind_direction_10m"]:
            assert var in hourly
            assert len(hourly[var]) == len(hourly["time"])

    def test_time_format_iso8601(self):
        """Verify time strings are ISO8601 format."""
        fixture_path = "../tests/fixtures/open_meteo/pekanbaru_forecast.json"
        with open(fixture_path, encoding="utf-8") as f:
            data = json.load(f)

        for time_str in data["hourly"]["time"][:5]:  # Check first 5
            # Should parse without error
            dt = datetime.fromisoformat(time_str)
            assert dt.tzinfo is None  # Naive datetime in local timezone (Asia/Jakarta)

    def test_units_match_expectations(self):
        """Verify hourly_units match expected units."""
        fixture_path = "../tests/fixtures/open_meteo/pekanbaru_forecast.json"
        with open(fixture_path, encoding="utf-8") as f:
            data = json.load(f)

        units = data["hourly_units"]
        assert units["temperature_2m"] == "°C"
        assert units["relative_humidity_2m"] == "%"
        assert units["precipitation"] == "mm"
        assert units["wind_speed_10m"] == "km/h"
        assert units["wind_direction_10m"] == "°"


class TestOpenMeteoRunnerNormalize:
    """Tests for OpenMeteoRunner.normalize() method."""

    def test_normalize_record(self):
        """Test normalizing a single record from the fixture."""
        runner = OpenMeteoRunner()
        runner._source_id = 1  # Avoid DB query

        raw = {
            "area_id": 42,
            "valid_time": "2026-08-20T12:00",
            "latitude": 0.5,
            "longitude": 101.5,
            "temperature_2m": 28.5,
            "relative_humidity_2m": 75,
            "precipitation": 0.0,
            "wind_speed_10m": 5.2,
            "wind_direction_10m": 180,
        }

        normalized = runner.normalize(raw)

        assert normalized["source_id"] == 1
        assert normalized["area_id"] == 42
        assert normalized["valid_time"] == datetime(2026, 8, 20, 12, 0)
        assert normalized["is_forecast"] is False  # Past time
        assert normalized["temperature_c"] == 28.5
        assert normalized["humidity_pct"] == 75
        assert normalized["precipitation_mm"] == 0.0
        assert normalized["wind_speed_kmh"] == 5.2
        assert normalized["wind_direction_deg"] == 180
        assert normalized["geom"] is not None
        assert "raw" in normalized

    def test_normalize_future_record_is_forecast(self):
        """Test that future times are classified as forecast."""
        runner = OpenMeteoRunner()
        runner._source_id = 1

        # Use a future time relative to a fixed reference
        # We'll test by directly calling classify_is_forecast
        future = datetime(2030, 1, 1, 12, 0, tzinfo=UTC)
        assert classify_is_forecast(future, datetime(2026, 8, 20, 12, 30, tzinfo=UTC)) is True

    def test_normalize_missing_optional_fields(self):
        """Test normalizing with some optional fields missing."""
        runner = OpenMeteoRunner()
        runner._source_id = 1

        raw = {
            "area_id": 42,
            "valid_time": "2026-08-20T12:00",
            "latitude": 0.5,
            "longitude": 101.5,
            "temperature_2m": 28.5,
            # Missing humidity, precipitation, wind
        }

        normalized = runner.normalize(raw)

        assert normalized["temperature_c"] == 28.5
        assert normalized["humidity_pct"] is None
        assert normalized["precipitation_mm"] is None
        assert normalized["wind_speed_kmh"] is None
        assert normalized["wind_direction_deg"] is None


class TestOpenMeteoRunnerValidate:
    """Tests for OpenMeteoRunner.validate() method."""

    def test_valid_record(self):
        runner = OpenMeteoRunner()
        raw = {
            "area_id": 42,
            "valid_time": "2026-08-20T12:00",
            "latitude": 0.5,
            "longitude": 101.5,
            "temperature_2m": 28.5,
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is True
        assert error is None

    def test_missing_area_id(self):
        runner = OpenMeteoRunner()
        raw = {
            "valid_time": "2026-08-20T12:00",
            "latitude": 0.5,
            "longitude": 101.5,
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "area_id" in error

    def test_invalid_time_format(self):
        runner = OpenMeteoRunner()
        raw = {
            "area_id": 42,
            "valid_time": "20-08-2026 12:00",
            "latitude": 0.5,
            "longitude": 101.5,
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "valid_time" in error

    def test_invalid_latitude(self):
        runner = OpenMeteoRunner()
        raw = {
            "area_id": 42,
            "valid_time": "2026-08-20T12:00",
            "latitude": 999.0,
            "longitude": 101.5,
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "coordinates" in error

    def test_invalid_longitude(self):
        runner = OpenMeteoRunner()
        raw = {
            "area_id": 42,
            "valid_time": "2026-08-20T12:00",
            "latitude": 0.5,
            "longitude": 200.0,
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "coordinates" in error
