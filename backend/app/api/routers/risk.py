"""GET /risk/current — latest risk assessment per area (Phase 7 populates data)."""

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import models as m
from app.api.deps import get_db_dependency

router = APIRouter(tags=["risk"])

RISK_NOT_YET_COMPUTED = "risk_not_yet_computed"

_RISK_SQL = (
    "SELECT DISTINCT ON (r.area_id) r.area_id AS area_id, a.name AS area_name, "
    "r.assessed_for AS assessed_for, r.horizon AS horizon, r.model_version AS model_version, "
    "r.risk_level AS risk_level, r.score AS score, r.factors AS factors "
    "FROM risk_assessments r JOIN administrative_areas a ON a.id = r.area_id "
    "WHERE r.model_version = :mv {area_filter} "
    "ORDER BY r.area_id, r.assessed_for DESC"
)


@router.get("/risk/current", response_model=m.RiskCurrentResponse)
def get_risk_current(
    kabupaten_id: int | None = Query(default=None),
    model_version: str = Query(default="rules-v0.1"),
    db: Session = Depends(get_db_dependency),
) -> m.RiskCurrentResponse:
    """Latest assessment per area; honest empty note when Phase 7 has not run yet."""
    area_filter = "AND r.area_id = :kab" if kabupaten_id is not None else ""
    params: dict[str, Any] = {"mv": model_version}
    if kabupaten_id is not None:
        params["kab"] = kabupaten_id
    rows = db.execute(text(_RISK_SQL.format(area_filter=area_filter)), params).mappings().all()
    assessments = [
        m.RiskAssessmentResponse(
            area_id=int(row["area_id"]),
            area_name=str(row["area_name"]),
            assessed_for=row["assessed_for"],  # type: ignore[arg-type]
            horizon=str(row["horizon"]),
            model_version=str(row["model_version"]),
            risk_level=row["risk_level"],  # type: ignore[arg-type]
            score=None if row["score"] is None else float(row["score"]),  # type: ignore[arg-type]
            factors=dict(row["factors"]) if row["factors"] is not None else {},
        )
        for row in rows
    ]
    if not assessments:
        return m.RiskCurrentResponse(assessments=[], note=RISK_NOT_YET_COMPUTED)
    return m.RiskCurrentResponse(assessments=assessments, note=None)
