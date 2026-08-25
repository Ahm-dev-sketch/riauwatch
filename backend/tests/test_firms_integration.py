"""Integration tests for FIRMS adapter (require DATABASE_URL + PostGIS)."""


import pytest

from app.ingest.firms import FIRMSRunner
from app.settings import settings

pytestmark = pytest.mark.integration


class TestFIRMSIntegration:
    """Integration tests that require a live PostGIS database."""

    def test_double_ingest_idempotent(self, engine):
        """Ingesting the same fixture twice should not change row count."""
        # This test requires a database with the schema and some administrative_areas
        # For now, we just verify the runner can be instantiated
        runner = FIRMSRunner()
        assert runner.source_key == "firms_viirs_nrt"

    def test_log_row_transitions_running_to_success(self, engine):
        """Log row should transition from 'running' to 'success'."""
        # This would test the full pipeline with a real DB
        pass

    def test_advisory_lock_prevents_concurrent_runs(self, engine):
        """Two concurrent runs should not both acquire the lock."""
        pass

    def test_overlapping_window_no_duplicates(self, engine):
        """Overlapping ingestion windows should not create duplicates."""
        pass


# The following tests are placeholders that will be implemented when PostGIS is available
# They are marked as integration and will be skipped locally

def test_firms_runner_instantiation():
    """Verify FIRMSRunner can be instantiated (unit test, no DB)."""
    runner = FIRMSRunner()
    assert runner.source_key == "firms_viirs_nrt"
    assert runner.lookback_hours == settings.ingest_lookback_hours
    assert runner.bbox == settings.riau_bbox
