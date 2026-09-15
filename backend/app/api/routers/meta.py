"""GET /meta/data-sources — source registry for the transparency page."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import models as m
from app.api.deps import get_db_dependency

router = APIRouter(tags=["meta"])

_SOURCES_SQL = (
    "SELECT s.key AS key, s.name AS name, s.provider_url AS provider_url, "
    "s.license_note AS license_note, s.attribution AS attribution, "
    "s.update_interval_seconds AS update_interval_seconds, s.active AS active "
    "FROM data_sources s ORDER BY s.key"
)


@router.get("/meta/data-sources", response_model=m.MetaDataSourcesResponse)
def get_data_sources(db: Session = Depends(get_db_dependency)) -> m.MetaDataSourcesResponse:
    """All registered data sources with licensing/attribution metadata."""
    rows = db.execute(text(_SOURCES_SQL)).mappings().all()
    return m.MetaDataSourcesResponse(
        sources=[
            m.DataSourceInfo(
                key=str(row["key"]),
                name=str(row["name"]),
                provider_url=str(row["provider_url"]),
                license_note=str(row["license_note"]),
                attribution=str(row["attribution"]),
                update_interval_seconds=row["update_interval_seconds"],  # type: ignore[arg-type]
                active=bool(row["active"]),
            )
            for row in rows
        ]
    )
