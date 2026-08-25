"""Ingestion runner pipeline: Fetch→Validate→Quarantine→Normalize→Dedupe→Transform→Store→Log."""

import logging
import uuid
from abc import ABC, abstractmethod
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db import get_session_factory
from app.models import DataIngestionLog, DataSource

# Structured JSON logging
logger = logging.getLogger(__name__)


class IngestionError(Exception):
    """Base exception for ingestion errors."""
    pass


class SourceNotConfiguredError(IngestionError):
    """Raised when a required API key is missing."""
    pass


class AdvisoryLockError(IngestionError):
    """Raised when advisory lock cannot be acquired."""
    pass


@contextmanager
def advisory_lock(session: Session, job_name: str):
    """Acquire a PostgreSQL advisory lock for the job name.

    Uses hashtext to convert string to int64. If lock unavailable, raises AdvisoryLockError.
    """
    lock_id = session.execute(
        text("SELECT hashtext(:job_name)"), {"job_name": job_name}
    ).scalar()
    acquired = session.execute(
        text("SELECT pg_try_advisory_lock(:lock_id)"), {"lock_id": lock_id}
    ).scalar()
    if not acquired:
        raise AdvisoryLockError(f"Could not acquire advisory lock for job: {job_name}")
    try:
        yield
    finally:
        session.execute(text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": lock_id})


class IngestionRunner(ABC):
    """Base class for ingestion runners."""

    def __init__(self, source_key: str):
        self.source_key = source_key
        self.run_id = uuid.uuid4()
        self.started_at = datetime.now(UTC)
        self.records_fetched = 0
        self.records_inserted = 0
        self.records_skipped = 0
        self.records_invalid = 0
        self.window_from: datetime | None = None
        self.window_to: datetime | None = None
        self.params: dict[str, Any] = {}
        self.error_detail: str | None = None
        self._source_id: int | None = None

    @property
    def source_id(self) -> int:
        """Get source_id, fetching from DB if needed."""
        if self._source_id is None:
            with get_session_factory()() as session:
                source = session.execute(
                    select(DataSource).where(DataSource.key == self.source_key)
                ).scalar_one_or_none()
                if source is None or source.id is None:
                    raise IngestionError(f"Source not found: {self.source_key}")
                self._source_id = source.id
        return self._source_id  # type: ignore[return-value]

    @abstractmethod
    def fetch(self) -> list[dict]:
        """Fetch raw records from the source. Returns list of raw dicts."""
        pass

    @abstractmethod
    def validate(self, raw_record: dict) -> tuple[bool, str | None]:
        """Validate a raw record. Returns (is_valid, error_message)."""
        pass

    @abstractmethod
    def normalize(self, raw_record: dict) -> dict:
        """Normalize a validated record to the target schema."""
        pass

    @abstractmethod
    def store(self, session: Session, normalized_records: list[dict]) -> int:
        """Store normalized records. Returns count of inserted records."""
        pass

    @abstractmethod
    def transform(self, session: Session) -> None:
        """Post-insert transform (e.g., area assignment via ST_Covers)."""
        pass

    def run(self) -> DataIngestionLog:
        """Execute the full ingestion pipeline."""
        SessionLocal = get_session_factory()

        with SessionLocal() as session:
            # Acquire advisory lock
            try:
                with advisory_lock(session, f"ingest_{self.source_key}"):
                    return self._run_with_lock(session)
            except AdvisoryLockError as e:
                logger.warning("Advisory lock unavailable, skipping run", extra={"job": self.source_key})
                # Create a log entry for the skipped run
                log = DataIngestionLog(
                    source_id=self.source_id,
                    run_id=self.run_id,
                    started_at=self.started_at,
                    finished_at=datetime.now(UTC),
                    status="failed",
                    error_detail=str(e),
                )
                session.add(log)
                session.commit()
                return log

    def _run_with_lock(self, session: Session) -> DataIngestionLog:
        """Run ingestion with lock held."""
        # Insert initial log row with status 'running'
        log = DataIngestionLog(
            source_id=self.source_id,
            run_id=self.run_id,
            started_at=self.started_at,
            status="running",
        )
        session.add(log)
        session.commit()

        logger.info(
            "Ingestion started",
            extra={
                "source": self.source_key,
                "run_id": str(self.run_id),
                "started_at": self.started_at.isoformat(),
            },
        )

        try:
            # Fetch
            raw_records = self.fetch()
            self.records_fetched = len(raw_records)

            if not raw_records:
                logger.info("No records fetched", extra={"source": self.source_key})
                self._finalize_log(session, log, "success")
                return log

            # Validate + Quarantine + Normalize
            normalized_records = []
            for raw in raw_records:
                is_valid, error = self.validate(raw)
                if not is_valid:
                    self.records_invalid += 1
                    from app.ingest.quarantine import write_quarantine
                    write_quarantine(session, self.source_id, self.run_id, raw, error or "Validation failed")
                    continue
                normalized = self.normalize(raw)
                normalized_records.append(normalized)

            # Store (Dedupe happens at DB level via ON CONFLICT)
            self.records_inserted = self.store(session, normalized_records)
            self.records_skipped = self.records_fetched - self.records_inserted - self.records_invalid

            # Transform
            self.transform(session)

            # Finalize
            self._finalize_log(session, log, "success")
            logger.info(
                "Ingestion completed",
                extra={
                    "source": self.source_key,
                    "run_id": str(self.run_id),
                    "fetched": self.records_fetched,
                    "inserted": self.records_inserted,
                    "skipped": self.records_skipped,
                    "invalid": self.records_invalid,
                },
            )
            return log

        except Exception as e:
            self.error_detail = str(e)
            logger.exception(
                "Ingestion failed",
                extra={"source": self.source_key, "run_id": str(self.run_id), "error": str(e)},
            )
            self._finalize_log(session, log, "failed")
            raise

    def _finalize_log(self, session: Session, log: DataIngestionLog, status: str) -> None:
        """Update the log row with final status and counts."""
        log.finished_at = datetime.now(UTC)
        log.status = status
        log.records_fetched = self.records_fetched
        log.records_inserted = self.records_inserted
        log.records_skipped = self.records_skipped
        log.records_invalid = self.records_invalid
        log.window_from = self.window_from
        log.window_to = self.window_to
        log.params = self.params if self.params else None
        log.error_detail = self.error_detail
        session.commit()
