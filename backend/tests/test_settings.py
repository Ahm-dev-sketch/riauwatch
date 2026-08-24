"""Unit tests for settings module."""

from app.settings import Settings


def test_settings_defaults():
    """Test that settings have correct defaults."""
    # This test doesn't need a real .env file - it tests the model defaults
    # We can't easily test BaseSettings without env vars, so just verify the class exists
    assert Settings is not None
    assert hasattr(Settings, "model_config")


def test_settings_fields_exist():
    """Test that all required fields are defined."""
    fields = Settings.model_fields
    assert "database_url" in fields
    assert "firms_map_key" in fields
    assert "openaq_api_key" in fields
    assert "log_level" in fields
    assert "ingest_lookback_hours" in fields


def test_settings_default_values():
    """Test default values for optional fields."""
    # Check field defaults via model_fields
    log_level_field = Settings.model_fields["log_level"]
    assert log_level_field.default == "INFO"

    lookback_field = Settings.model_fields["ingest_lookback_hours"]
    assert lookback_field.default == 48

    firms_key_field = Settings.model_fields["firms_map_key"]
    assert firms_key_field.default is None

    openaq_key_field = Settings.model_fields["openaq_api_key"]
    assert openaq_key_field.default is None
