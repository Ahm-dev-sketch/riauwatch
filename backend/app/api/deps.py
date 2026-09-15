"""Database dependency for API (read-only)."""

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_session_factory


@contextmanager
def get_read_only_db() -> Iterator[Session]:
    """
    Provide a read-only database session for API endpoints.

    The session is configured with read-only transaction isolation
    to enforce that API layer never writes to the database.
    """
    SessionLocal = get_session_factory()
    session = SessionLocal()
    try:
        # Set transaction to read-only
        session.execute(text("SET TRANSACTION READ ONLY"))
        yield session
    finally:
        session.close()


def get_db_dependency() -> Iterator[Session]:
    """FastAPI dependency for read-only database session."""
    with get_read_only_db() as session:
        yield session
