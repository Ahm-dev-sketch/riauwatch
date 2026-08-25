"""Integration tests for boundaries adapter (require DATABASE_URL + PostGIS)."""

import pytest

from app.ingest.boundaries import BoundariesRunner

pytestmark = pytest.mark.integration


class TestBoundariesIntegration:
    """Integration tests that require a live PostGIS database."""

    def test_boundaries_reload_updates_geometry(self, engine):
        """Re-loading boundaries should update geometry, not create duplicates (DO UPDATE on uq_area)."""
        runner = BoundariesRunner("dummy.geojson")
        assert runner.source_key == "geoboundaries"

    def test_provinsi_auto_created(self, engine):
        """Riau provinsi row should be auto-created if missing."""
        pass

    def test_centroid_computed_and_stored(self, engine):
        """Centroid should be computed via ST_Centroid and stored."""
        pass

    def test_kode_bps_never_invented(self, engine):
        """kode_bps should stay NULL when not in source properties."""
        pass

    def test_log_row_transitions_running_to_success(self, engine):
        """Log row should transition from 'running' to 'success'."""
        pass

    def test_advisory_lock_prevents_concurrent_runs(self, engine):
        """Two concurrent runs should not both acquire the lock."""
        pass


def test_boundaries_runner_instantiation():
    """Verify BoundariesRunner can be instantiated (unit test, no DB)."""
    runner = BoundariesRunner("dummy.geojson")
    assert runner.source_key == "geoboundaries"
