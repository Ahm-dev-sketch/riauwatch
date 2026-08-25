"""Quarantine utilities for writing invalid records."""

from uuid import UUID

from sqlalchemy import insert
from sqlalchemy.orm import Session

from app.models import QuarantineRow


def write_quarantine(
    session: Session,
    source_id: int,
    run_id: UUID,
    raw_payload: dict,
    validation_error: str,
) -> None:
    """Write an invalid record to quarantine_rows."""
    stmt = insert(QuarantineRow).values(
        source_id=source_id,
        run_id=run_id,
        raw=raw_payload,
        validation_error=validation_error,
    )
    session.execute(stmt)
