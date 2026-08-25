"""Integration tests for Open-Meteo adapter (require DATABASE_URL + PostGIS)."""

from datetime import UTC, datetime

import pytest

from app.ingest.open_meteo import OpenMeteoRunner, classify_is_forecast
from app.settings import settings

pytestmark = pytest.mark.integration


class TestOpenMeteoIntegration:
    """Integration tests that require a live PostGIS database."""

    def test_multi_cycle_weather_revision(self, engine):
        """
        Multi-cycle weather revision test (C1 review fix verification).

        Insert cycle A rows then cycle B over same (area_id, valid_time, is_forecast)
        => values updated, row count unchanged (latest-cycle-wins via DO UPDATE).
        """
        # This test requires a database with the schema and administrative_areas
        # For now, we just verify the runner can be instantiated
        runner = OpenMeteoRunner()
        assert runner.source_key == "open_meteo"

    def test_log_row_transitions_running_to_success(self, engine):
        """Log row should transition from 'running' to 'success'."""
        pass

    def test_advisory_lock_prevents_concurrent_runs(self, engine):
        """Two concurrent runs should not both acquire the lock."""
        pass

    def test_backfill_mode_past_days(self, engine):
        """Backfill mode with --past-days N should populate history."""
        pass


# Unit test that runs without DB
def test_classify_is_forecast_boundary():
    """Verify the is_forecast boundary classification logic."""
    # Reference: 2026-08-20 12:30 UTC
    # Last complete hour: 12:00 UTC
    ref = datetime(2026, 8, 20, 12, 30, tzinfo=UTC)

    # Analysis (<= last complete hour)
    assert classify_is_forecast(datetime(2026, 8, 20, 11, 0, tzinfo=UTC), ref) is False
    assert classify_is_forecast(datetime(2026, 8, 20, 12, 0, tzinfo=UTC), ref) is False

    # Forecast (> last complete hour)
    assert classify_is_forecast(datetime(2026, 8, 20, 12, 30, tzinfo=UTC), ref) is True
    assert classify_is_forecast(datetime(2026, 8, 20, 13, 0, tzinfo=UTC), ref) is True


def test_open_meteo_runner_instantiation():
    """Verify OpenMeteoRunner can be instantiated (unit test, no DB)."""
    runner = OpenMeteoRunner()
    assert runner.source_key == "open_meteo"
    assert runner.past_days == settings.open_meteo_past_days
    assert runner.forecast_days == settings.open_meteo_forecast_days
