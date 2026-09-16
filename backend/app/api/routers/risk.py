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
    assessments = []
    for row in rows:
        factors_dict = dict(row["factors"]) if row["factors"] is not None else {}
        fire_idx = factors_dict.get("fire_hazard_index")
        if fire_idx is None and row["score"] is not None:
            fire_idx = float(row["score"])

        fire_lvl = factors_dict.get("fire_risk_level")
        if not fire_lvl and row["risk_level"]:
            lvl_map = {"extreme": "Ekstrem", "very_high": "Sangat Tinggi", "high": "Tinggi", "moderate": "Sedang", "low": "Rendah"}
            fire_lvl = lvl_map.get(str(row["risk_level"]).lower(), "Rendah")

        assessments.append(
            m.RiskAssessmentResponse(
                area_id=int(row["area_id"]),
                area_name=str(row["area_name"]),
                assessed_for=row["assessed_for"],  # type: ignore[arg-type]
                horizon=str(row["horizon"]),
                model_version=str(row["model_version"]),
                risk_level=row["risk_level"],  # type: ignore[arg-type]
                score=None if row["score"] is None else float(row["score"]),  # type: ignore[arg-type]
                fire_hazard_index=float(fire_idx) if fire_idx is not None else None,
                fire_risk_level=str(fire_lvl) if fire_lvl else None,
                air_quality_hazard_index=float(factors_dict["air_quality_hazard_index"]) if factors_dict.get("air_quality_hazard_index") is not None else None,
                air_quality_level=str(factors_dict["air_quality_level"]) if factors_dict.get("air_quality_level") else None,
                pm25_value=float(factors_dict["pm25_value"]) if factors_dict.get("pm25_value") is not None else None,
                factors=factors_dict,
            )
        )
    if not assessments:
        return m.RiskCurrentResponse(assessments=[], note=RISK_NOT_YET_COMPUTED)
    return m.RiskCurrentResponse(assessments=assessments, note=None)
