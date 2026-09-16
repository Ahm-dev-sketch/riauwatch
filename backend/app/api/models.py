"""Pydantic response models for the API v1."""

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# =============================================================================
# Common / Shared Models
# =============================================================================

class ProblemDetail(BaseModel):
    """RFC 9457 Problem Details object."""
    type: str = "about:blank"
    title: str
    status: int
    detail: str
    instance: str | None = None


class DomainStatus(BaseModel):
    """Status for a single data domain (hotspots, air_quality, weather)."""
    last_observation_at: datetime | None = None
    last_successful_run_at: datetime | None = None
    degraded: bool = False


class StatusResponse(BaseModel):
    """GET /status response."""
    hotspots: DomainStatus
    air_quality: DomainStatus
    weather: DomainStatus
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# =============================================================================
# Hotspots Models
# =============================================================================

class HotspotProperties(BaseModel):
    """Properties for a hotspot GeoJSON feature."""
    id: int | None = None
    satellite: str
    instrument: str | None = None
    confidence: str | None = None
    confidence_value: float | None = None
    daynight: str | None = None
    frp: float | None = None
    acquired_at: datetime
    area_name: str | None = None
    hotspot_indication: bool = True
    sensor: str | None = None
    raw_detections_count: int | None = None
    in_peatland: bool | None = None

    model_config = ConfigDict(extra="allow")


class HotspotFeature(BaseModel):
    """GeoJSON Feature for a hotspot."""
    type: Literal["Feature"] = "Feature"
    geometry: dict  # Point geometry as GeoJSON dict
    properties: HotspotProperties


class HotspotsResponse(BaseModel):
    """GET /hotspots response - GeoJSON FeatureCollection."""
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[HotspotFeature]
    disclaimer: str = (
        "Hotspots indicate heat detections from satellite sensors. "
        "They are NOT confirmed fires. Ground verification is required."
    )
    count: int


class HotspotSummaryItem(BaseModel):
    """Single item in hotspots summary."""
    kabupaten_id: int
    kabupaten_name: str
    count: int


class HotspotsSummaryResponse(BaseModel):
    """GET /hotspots/summary response."""
    items: list[HotspotSummaryItem]
    total: int


# =============================================================================
# Air Quality Models
# =============================================================================

class AQObservation(BaseModel):
    """Single air quality observation."""
    pollutant: str
    value: float
    unit: str
    observed_at: datetime
    age_seconds: int


class AQStationLatest(BaseModel):
    """Station with its latest observations per pollutant."""
    station_id: int
    station_name: str | None = None
    external_id: str
    distance_km: float | None = None
    observations: list[AQObservation]
    # Category bands are defined in Phase 6; field is present in the contract but null until then.
    category: str | None = Field(
        default=None,
        description=(
            "Air quality category for the station (e.g. Good/Moderate). "
            "Always null until Phase 6 defines category bands."
        ),
    )


class AirQualityLatestResponse(BaseModel):
    """GET /air-quality/latest response."""
    stations: list[AQStationLatest]


class AQHistoryPoint(BaseModel):
    """Single point in air quality history time series."""
    observed_at: datetime
    value: float
    unit: str


class AirQualityHistoryResponse(BaseModel):
    """GET /air-quality/history response."""
    station_id: int
    pollutant: str
    unit: str
    points: list[AQHistoryPoint]


# =============================================================================
# Weather Models
# =============================================================================

class WeatherObservationResponse(BaseModel):
    """Single weather observation (current or forecast)."""
    valid_time: datetime
    is_forecast: bool
    temperature_c: float | None = None
    humidity_pct: float | None = None
    precipitation_mm: float | None = None
    wind_speed_kmh: float | None = None
    wind_direction_deg: float | None = None
    cloud_cover_pct: float | None = None
    soil_moisture_m3: float | None = None
    age_seconds: int | None = None  # only for current (non-forecast)


class WeatherCurrentResponse(BaseModel):
    """GET /weather/current response."""
    area_id: int
    area_name: str
    observation: WeatherObservationResponse


class WeatherForecastResponse(BaseModel):
    """GET /weather/forecast response."""
    area_id: int
    area_name: str
    forecast: list[WeatherObservationResponse]


# =============================================================================
# Risk Models
# =============================================================================

class RiskAssessmentResponse(BaseModel):
    """Single risk assessment."""
    area_id: int
    area_name: str
    assessed_for: datetime
    horizon: str
    model_version: str
    risk_level: str | None = None
    score: float | None = None
    fire_hazard_index: float | None = None
    fire_risk_level: str | None = None
    air_quality_hazard_index: float | None = None
    air_quality_level: str | None = None
    pm25_value: float | None = None
    factors: dict


class RiskCurrentResponse(BaseModel):
    """GET /risk/current response."""
    assessments: list[RiskAssessmentResponse]
    note: str | None = None  # e.g., "risk_not_yet_computed"


# =============================================================================
# Administrative Areas Models
# =============================================================================

class AdminAreaProperties(BaseModel):
    """Properties for an administrative area GeoJSON feature."""
    id: int
    name: str
    level: str
    kode_bps: str | None = None
    parent_id: int | None = None

    model_config = ConfigDict(extra="allow")


class AdminAreaFeature(BaseModel):
    """GeoJSON Feature for an administrative area."""
    type: Literal["Feature"] = "Feature"
    geometry: dict  # MultiPolygon geometry as GeoJSON dict
    properties: AdminAreaProperties


class AdminAreasResponse(BaseModel):
    """GET /administrative-areas response - GeoJSON FeatureCollection."""
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[AdminAreaFeature]


class AdminAreaLookupResponse(BaseModel):
    """GET /administrative-areas/lookup response."""
    id: int
    name: str
    level: str


# =============================================================================
# Meta Models
# =============================================================================

class DataSourceInfo(BaseModel):
    """Data source information for /meta/data-sources."""
    key: str
    name: str
    provider_url: str
    license_note: str
    attribution: str
    update_interval_seconds: int | None = None
    active: bool


class MetaDataSourcesResponse(BaseModel):
    """GET /meta/data-sources response."""
    sources: list[DataSourceInfo]
