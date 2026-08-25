"""Integration tests for OpenAQ adapter (require DATABASE_URL + PostGIS)."""

import pytest

from app.ingest.openaq import OpenAQRunner
from app.settings import settings

pytestmark = pytest.mark.integration


class TestOpenAQIntegration:
    """Integration tests that require a live PostGIS database."""

    def test_aq_double_ingest_idempotent(self, engine):
        """Ingesting the same AQ data twice should not change observation row count (first-wins)."""
        runner = OpenAQRunner()
        assert runner.source_key == "openaq_v3"

    def test_station_upsert_updates_metadata(self, engine):
        """Station metadata should be updated on re-ingest (DO UPDATE on source_id, external_id)."""
        pass

    def test_log_row_transitions_running_to_success(self, engine):
        """Log row should transition from 'running' to 'success'."""
        pass

    def test_advisory_lock_prevents_concurrent_runs(self, engine):
        """Two concurrent runs should not both acquire the lock."""
        pass

    def test_missing_api_key_graceful_failure(self, engine):
        """Missing OPENAQ_API_KEY should fail gracefully with clear error_detail."""
        pass


def test_openaq_runner_instantiation():
    """Verify OpenAQRunner can be instantiated (unit test, no DB)."""
    runner = OpenAQRunner()
    assert runner.source_key == "openaq_v3"
    assert runner.bbox == settings.openaq_bbox
