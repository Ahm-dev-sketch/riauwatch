"""Pytest configuration and fixtures for backend tests."""

import os

# Set a dummy DATABASE_URL for unit tests before any app modules are imported
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError


def _database_url_reachable(url: str, timeout: int = 2) -> bool:
    """Check if DATABASE_URL is reachable with a fast timeout."""
    try:
        engine = create_engine(url, connect_args={"connect_timeout": timeout})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except (OperationalError, Exception):
        return False


@pytest.fixture(scope="session")
def database_url() -> str | None:
    """Return DATABASE_URL if set and reachable, otherwise None."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        return None
    if _database_url_reachable(url):
        return url
    return None


@pytest.fixture(scope="session")
def engine(database_url: str | None):
    """Provide a SQLAlchemy engine only when DATABASE_URL is set and reachable."""
    if database_url is None:
        pytest.skip("DATABASE_URL not set/unreachable — integration requires PostGIS")
    return create_engine(database_url)


# Unit test marker - runs without any infrastructure
def pytest_configure(config):
    config.addinivalue_line("markers", "integration: marks tests as integration tests requiring DATABASE_URL")


# Trivial unit test to prove the suite runs green with no infra
def test_unit_suite_runs():
    """Trivial unit test proving the test suite runs without infrastructure."""
    assert True
