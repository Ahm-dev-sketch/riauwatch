"""Unit tests for FIRMS adapter (no DB required)."""

import csv
from datetime import UTC, datetime

from app.ingest.firms import (
    FIRMSRunner,
    modis_confidence_to_category,
    parse_acq_datetime,
    parse_acq_time,
)


class TestAcqTimeParsing:
    """Tests for acq_time parsing (integer minutes from midnight)."""

    def test_acq_time_no_padding(self):
        assert parse_acq_time("0") == 0
        assert parse_acq_time("30") == 30
        assert parse_acq_time("1359") == 1359

    def test_acq_time_zero_padded(self):
        assert parse_acq_time("0000") == 0
        assert parse_acq_time("0030") == 30
        assert parse_acq_time("1359") == 1359

    def test_acq_time_invalid(self):
        try:
            parse_acq_time("abc")
            assert False, "Should have raised ValueError"
        except ValueError:
            pass


class TestAcqDatetimeParsing:
    """Tests for acq_date + acq_time -> UTC datetime."""

    def test_midnight(self):
        dt = parse_acq_datetime("2026-08-20", "0")
        assert dt == datetime(2026, 8, 20, 0, 0, tzinfo=UTC)

    def test_zero_padded_midnight(self):
        dt = parse_acq_datetime("2026-08-20", "0000")
        assert dt == datetime(2026, 8, 20, 0, 0, tzinfo=UTC)

    def test_half_hour(self):
        dt = parse_acq_datetime("2026-08-20", "30")
        assert dt == datetime(2026, 8, 20, 0, 30, tzinfo=UTC)

    def test_end_of_day(self):
        dt = parse_acq_datetime("2026-08-20", "1359")
        assert dt == datetime(2026, 8, 20, 22, 39, tzinfo=UTC)

    def test_noon(self):
        dt = parse_acq_datetime("2026-08-20", "720")
        assert dt == datetime(2026, 8, 20, 12, 0, tzinfo=UTC)


class TestModisConfidenceMapping:
    """Tests for MODIS confidence 0-100 -> l/n/h mapping."""

    def test_low(self):
        assert modis_confidence_to_category(0) == "l"
        assert modis_confidence_to_category(15) == "l"
        assert modis_confidence_to_category(29) == "l"

    def test_nominal(self):
        assert modis_confidence_to_category(30) == "n"
        assert modis_confidence_to_category(50) == "n"
        assert modis_confidence_to_category(79) == "n"

    def test_high(self):
        assert modis_confidence_to_category(80) == "h"
        assert modis_confidence_to_category(90) == "h"
        assert modis_confidence_to_category(100) == "h"


class TestCSVHeaderDrivenParsing:
    """Tests that CSV parsing is header-driven, not positional."""

    def test_parse_sample_fixture(self):
        """Parse the synthetic fixture and verify all rows are read."""
        fixture_path = "tests/fixtures/firms/sample_viirs.csv"
        with open(fixture_path, newline="") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        assert len(rows) == 6
        # Check header-driven access
        assert rows[0]["latitude"] == "0.5"
        assert rows[0]["longitude"] == "101.5"
        assert rows[0]["satellite"] == "S-NPP"
        assert rows[0]["confidence"] == "l"
        assert rows[0]["acq_time"] == "0"

    def test_duplicate_row_present(self):
        """Fixture contains a duplicate row (row 4 = row 1)."""
        fixture_path = "tests/fixtures/firms/sample_viirs.csv"
        with open(fixture_path, newline="") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        # Row 0 and row 3 should be identical in key fields
        assert rows[0]["latitude"] == rows[3]["latitude"]
        assert rows[0]["longitude"] == rows[3]["longitude"]
        assert rows[0]["satellite"] == rows[3]["satellite"]
        assert rows[0]["acq_time"] == rows[3]["acq_time"]
        assert rows[0]["acq_date"] == rows[3]["acq_date"]

    def test_invalid_row_present(self):
        """Fixture contains an invalid row (latitude=999.0)."""
        fixture_path = "tests/fixtures/firms/sample_viirs.csv"
        with open(fixture_path, newline="") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        invalid_row = rows[5]
        assert invalid_row["latitude"] == "999.0"


class TestFIRMSRunnerValidation:
    """Tests for FIRMSRunner.validate() method."""

    def test_valid_viirs_record(self):
        runner = FIRMSRunner()
        raw = {
            "latitude": "0.5",
            "longitude": "101.5",
            "acq_date": "2026-08-20",
            "acq_time": "0",
            "satellite": "S-NPP",
            "instrument": "VIIRS",
            "confidence": "l",
            "version": "NRT",
            "frp": "15.3",
            "daynight": "D",
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is True
        assert error is None

    def test_valid_noaa20_record(self):
        runner = FIRMSRunner()
        raw = {
            "latitude": "0.6",
            "longitude": "101.6",
            "acq_date": "2026-08-20",
            "acq_time": "30",
            "satellite": "NOAA-20",
            "instrument": "VIIRS",
            "confidence": "n",
            "version": "NRT",
            "frp": "20.1",
            "daynight": "N",
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is True
        assert error is None

    def test_missing_latitude(self):
        runner = FIRMSRunner()
        raw = {
            "longitude": "101.5",
            "acq_date": "2026-08-20",
            "acq_time": "0",
            "satellite": "S-NPP",
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "latitude" in error

    def test_invalid_latitude_out_of_bounds(self):
        runner = FIRMSRunner()
        raw = {
            "latitude": "999.0",
            "longitude": "101.5",
            "acq_date": "2026-08-20",
            "acq_time": "0",
            "satellite": "S-NPP",
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "Invalid coordinates" in error

    def test_invalid_longitude_out_of_bounds(self):
        runner = FIRMSRunner()
        raw = {
            "latitude": "0.5",
            "longitude": "200.0",
            "acq_date": "2026-08-20",
            "acq_time": "0",
            "satellite": "S-NPP",
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "Invalid coordinates" in error

    def test_invalid_acq_time(self):
        runner = FIRMSRunner()
        raw = {
            "latitude": "0.5",
            "longitude": "101.5",
            "acq_date": "2026-08-20",
            "acq_time": "abc",
            "satellite": "S-NPP",
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "Invalid acq_time" in error

    def test_invalid_acq_date(self):
        runner = FIRMSRunner()
        raw = {
            "latitude": "0.5",
            "longitude": "101.5",
            "acq_date": "20-08-2026",
            "acq_time": "0",
            "satellite": "S-NPP",
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "Invalid acq_date" in error


class TestFIRMSRunnerNormalize:
    """Tests for FIRMSRunner.normalize() method."""

    def test_normalize_viirs_record(self):
        runner = FIRMSRunner()
        runner._source_id = 1  # Avoid DB query in unit test
        raw = {
            "latitude": "0.5",
            "longitude": "101.5",
            "acq_date": "2026-08-20",
            "acq_time": "0",
            "satellite": "S-NPP",
            "instrument": "VIIRS",
            "confidence": "l",
            "version": "NRT",
            "frp": "15.3",
            "daynight": "D",
            "_firms_source": "VIIRS_SNPP_NRT",
        }
        normalized = runner.normalize(raw)

        assert normalized["satellite"] == "S-NPP"
        assert normalized["instrument"] == "VIIRS"
        assert normalized["confidence"] == "l"
        assert normalized["confidence_value"] is None
        assert normalized["daynight"] == "D"
        assert normalized["version"] == "NRT"
        assert normalized["frp"] == 15.3
        assert normalized["latitude"] == 0.5
        assert normalized["longitude"] == 101.5
        assert normalized["acquired_at"] == datetime(2026, 8, 20, 0, 0, tzinfo=UTC)
        assert normalized["geom"] is not None
        assert normalized["area_id"] is None
        assert "raw" in normalized

    def test_normalize_modis_record(self):
        runner = FIRMSRunner()
        runner._source_id = 1  # Avoid DB query in unit test
        raw = {
            "latitude": "0.5",
            "longitude": "101.5",
            "acq_date": "2026-08-20",
            "acq_time": "720",
            "satellite": "Terra",
            "instrument": "MODIS",
            "confidence": "85",
            "version": "NRT",
            "frp": "25.0",
            "daynight": "D",
            "_firms_source": "MODIS_NRT",
        }
        normalized = runner.normalize(raw)

        assert normalized["satellite"] == "Terra"
        assert normalized["instrument"] == "MODIS"
        assert normalized["confidence"] == "h"  # 85 -> h
        assert normalized["confidence_value"] == 85.0
        assert normalized["daynight"] == "D"
        assert normalized["acquired_at"] == datetime(2026, 8, 20, 12, 0, tzinfo=UTC)

    def test_normalize_modis_low_confidence(self):
        runner = FIRMSRunner()
        runner._source_id = 1  # Avoid DB query in unit test
        raw = {
            "latitude": "0.5",
            "longitude": "101.5",
            "acq_date": "2026-08-20",
            "acq_time": "0",
            "satellite": "Aqua",
            "instrument": "MODIS",
            "confidence": "20",
            "version": "NRT",
            "daynight": "N",
            "_firms_source": "MODIS_NRT",
        }
        normalized = runner.normalize(raw)
        assert normalized["confidence"] == "l"
        assert normalized["confidence_value"] == 20.0

    def test_normalize_modis_nominal_confidence(self):
        runner = FIRMSRunner()
        runner._source_id = 1  # Avoid DB query in unit test
        raw = {
            "latitude": "0.5",
            "longitude": "101.5",
            "acq_date": "2026-08-20",
            "acq_time": "0",
            "satellite": "Terra",
            "instrument": "MODIS",
            "confidence": "50",
            "version": "NRT",
            "daynight": "D",
            "_firms_source": "MODIS_NRT",
        }
        normalized = runner.normalize(raw)
        assert normalized["confidence"] == "n"
        assert normalized["confidence_value"] == 50.0


class TestQuarantineRecordConstruction:
    """Tests for quarantine record construction from invalid rows."""

    def test_invalid_row_creates_quarantine_payload(self):
        """Verify that an invalid row produces the expected quarantine structure."""
        runner = FIRMSRunner()
        raw = {
            "latitude": "999.0",
            "longitude": "101.5",
            "acq_date": "2026-08-20",
            "acq_time": "0",
            "satellite": "S-NPP",
            "instrument": "VIIRS",
            "confidence": "l",
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False

        # Simulate quarantine record
        quarantine_payload = {
            "source_id": 1,
            "run_id": "test-run-id",
            "raw": raw,
            "validation_error": error,
        }

        assert quarantine_payload["raw"]["latitude"] == "999.0"
        assert "Invalid coordinates" in quarantine_payload["validation_error"]
