"""Database engine and session factory."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.settings import settings

_engine = None
_SessionLocal = None


def get_engine():
    """Get or create the database engine (lazy initialization)."""
    global _engine
    if _engine is None:
        _engine = create_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )
    return _engine


def get_session_factory():
    """Get or create the session factory (lazy initialization)."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=get_engine(),
        )
    return _SessionLocal


def get_db():
    """Dependency for FastAPI to get a database session."""
    SessionLocal = get_session_factory()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# For backwards compatibility - these are accessed as module attributes
# but lazily initialize on first access
class _LazyEngine:
    def __getattr__(self, name):
        return getattr(get_engine(), name)


class _LazySessionFactory:
    def __getattr__(self, name):
        return getattr(get_session_factory(), name)


engine = _LazyEngine()
SessionLocal = _LazySessionFactory()
