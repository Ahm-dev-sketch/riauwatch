"""Unit tests for OpenAQ adapter (no DB required)."""

import json
from datetime import UTC, datetime

from app.ingest.openaq import OpenAQRunner


class TestOpenAQRunnerValidate:
    """Tests for OpenAQRunner.validate() method."""

    def test_valid_location_and_measurement(self):
        runner = OpenAQRunner()
        raw = {
            "location": {
                "id": 12345,
                "name": "Pekanbaru Station",
                "coordinates": {"latitude": 0.5071, "longitude": 101.4478},
                "country": "ID",
                "city": "Pekanbaru",
                "isMobile": False,
                "isAnalysis": False,
                "entity": "government",
                "sensorType": "reference",
            },
            "measurement": {
                "parameter": "pm25",
                "value": 25.5,
                "unit": "µg/m³",
                "lastUpdated": "2026-08-20T10:00:00Z",
                "sourceName": "Pekanbaru Station",
            },
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is True
        assert error is None

    def test_valid_pm10_measurement(self):
        runner = OpenAQRunner()
        raw = {
            "location": {
                "id": 12346,
                "name": "Dumai Station",
                "coordinates": {"latitude": 1.6667, "longitude": 101.4500},
                "country": "ID",
                "city": "Dumai",
            },
            "measurement": {
                "parameter": "pm10",
                "value": 45.2,
                "unit": "µg/m³",
                "lastUpdated": "2026-08-20T10:00:00Z",
            },
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is True
        assert error is None

    def test_missing_location(self):
        runner = OpenAQRunner()
        raw = {"measurement": {"parameter": "pm25", "value": 25.5, "lastUpdated": "2026-08-20T10:00:00Z"}}
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "location" in error

    def test_missing_measurement(self):
        runner = OpenAQRunner()
        raw = {"location": {"id": 12345, "name": "Test", "coordinates": {"latitude": 0.5, "longitude": 101.5}}}
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "measurement" in error

    def test_location_missing_coordinates(self):
        runner = OpenAQRunner()
        raw = {
            "location": {"id": 12345, "name": "Test"},
            "measurement": {"parameter": "pm25", "value": 25.5, "lastUpdated": "2026-08-20T10:00:00Z"},
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "coordinates" in error

    def test_invalid_latitude(self):
        runner = OpenAQRunner()
        raw = {
            "location": {"id": 12345, "name": "Test", "coordinates": {"latitude": 999.0, "longitude": 101.5}},
            "measurement": {"parameter": "pm25", "value": 25.5, "lastUpdated": "2026-08-20T10:00:00Z"},
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "coordinates" in error

    def test_unwanted_pollutant(self):
        runner = OpenAQRunner()
        raw = {
            "location": {"id": 12345, "name": "Test", "coordinates": {"latitude": 0.5, "longitude": 101.5}},
            "measurement": {"parameter": "o3", "value": 50.0, "lastUpdated": "2026-08-20T10:00:00Z"},
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "Unwanted pollutant" in error

    def test_negative_value(self):
        runner = OpenAQRunner()
        raw = {
            "location": {"id": 12345, "name": "Test", "coordinates": {"latitude": 0.5, "longitude": 101.5}},
            "measurement": {"parameter": "pm25", "value": -5.0, "lastUpdated": "2026-08-20T10:00:00Z"},
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "Negative value" in error

    def test_invalid_timestamp(self):
        runner = OpenAQRunner()
        raw = {
            "location": {"id": 12345, "name": "Test", "coordinates": {"latitude": 0.5, "longitude": 101.5}},
            "measurement": {"parameter": "pm25", "value": 25.5, "lastUpdated": "invalid-date"},
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "timestamp" in error


class TestOpenAQRunnerNormalize:
    """Tests for OpenAQRunner.normalize() method."""

    def test_normalize_station_and_observation(self):
        runner = OpenAQRunner()
        runner._source_id = 1

        raw = {
            "location": {
                "id": 12345,
                "name": "Pekanbaru Station",
                "coordinates": {"latitude": 0.5071, "longitude": 101.4478},
                "country": "ID",
                "city": "Pekanbaru",
                "isMobile": False,
                "isAnalysis": False,
                "entity": "government",
                "sensorType": "reference",
            },
            "measurement": {
                "parameter": "pm25",
                "value": 25.5,
                "unit": "µg/m³",
                "lastUpdated": "2026-08-20T10:00:00Z",
            },
        }

        normalized = runner.normalize(raw)

        # Check station data
        station = normalized["station"]
        assert station["source_id"] == 1
        assert station["external_id"] == "12345"
        assert station["name"] == "Pekanbaru Station"
        assert station["geom"] is not None
        assert station["meta"]["country"] == "ID"
        assert station["meta"]["city"] == "Pekanbaru"
        assert station["meta"]["entity"] == "government"

        # Check observation data
        obs = normalized["observation"]
        assert obs["station_external_id"] == "12345"
        assert obs["pollutant"] == "pm25"
        assert obs["value"] == 25.5
        assert obs["unit"] == "µg/m³"
        assert obs["observed_at"] == datetime(2026, 8, 20, 10, 0, tzinfo=UTC)
        assert "raw" in obs


class TestOpenAQSyntheticFixtures:
    """Tests using the synthetic OpenAQ fixtures."""

    def test_parse_sample_locations(self):
        """Parse the synthetic locations fixture."""
        fixture_path = "tests/fixtures/openaq/sample_locations.json"
        with open(fixture_path) as f:
            data = json.load(f)

        assert "results" in data
        locations = data["results"]
        assert len(locations) == 2

        # Check first location
        loc1 = locations[0]
        assert loc1["id"] == 12345
        assert loc1["name"] == "Pekanbaru Station"
        assert loc1["coordinates"]["latitude"] == 0.5071
        assert loc1["coordinates"]["longitude"] == 101.4478

        # Check second location
        loc2 = locations[1]
        assert loc2["id"] == 12346
        assert loc2["name"] == "Dumai Station"

    def test_parse_sample_measurements(self):
        """Parse the synthetic measurements fixture."""
        fixture_path = "tests/fixtures/openaq/sample_measurements.json"
        with open(fixture_path) as f:
            data = json.load(f)

        assert "results" in data
        measurements = data["results"]
        assert len(measurements) == 3

        # Check pm25
        pm25 = measurements[0]
        assert pm25["parameter"] == "pm25"
        assert pm25["value"] == 25.5
        assert pm25["unit"] == "µg/m³"  # Unicode micro sign + superscript 3

        # Check pm10
        pm10 = measurements[1]
        assert pm10["parameter"] == "pm10"
        assert pm10["value"] == 45.2

    def test_validate_all_fixture_records(self):
        """Validate all records from synthetic fixtures."""
        runner = OpenAQRunner()

        # Load locations
        with open("tests/fixtures/openaq/sample_locations.json") as f:
            locations_data = json.load(f)

        # Load measurements
        with open("tests/fixtures/openaq/sample_measurements.json") as f:
            measurements_data = json.load(f)

        # Create combined records and validate
        for location in locations_data["results"]:
            for measurement in measurements_data["results"]:
                raw = {"location": location, "measurement": measurement}
                is_valid, error = runner.validate(raw)
                # All synthetic records should be valid
                assert is_valid is True, f"Validation failed: {error}"


class TestOpenAQQuarantine:
    """Tests for quarantine record construction from invalid OpenAQ rows."""

    def test_invalid_pollutant_creates_quarantine_payload(self):
        runner = OpenAQRunner()
        raw = {
            "location": {"id": 12345, "name": "Test", "coordinates": {"latitude": 0.5, "longitude": 101.5}},
            "measurement": {"parameter": "o3", "value": 50.0, "lastUpdated": "2026-08-20T10:00:00Z"},
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False

        quarantine_payload = {
            "source_id": 1,
            "run_id": "test-run-id",
            "raw": raw,
            "validation_error": error,
        }

        assert quarantine_payload["raw"]["measurement"]["parameter"] == "o3"
        assert error is not None and "Unwanted pollutant" in error
