"""SQLAlchemy ORM models for all nine tables matching migration 0001 exactly."""

from datetime import datetime
from uuid import UUID

from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""
    pass


class DataSource(Base):
    """data_sources table."""
    __tablename__ = "data_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    provider_url: Mapped[str] = mapped_column(Text, nullable=False)
    license_note: Mapped[str] = mapped_column(Text, nullable=False)
    attribution: Mapped[str] = mapped_column(Text, nullable=False)
    update_interval_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class AdministrativeArea(Base):
    """administrative_areas table."""
    __tablename__ = "administrative_areas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kode_bps: Mapped[str | None] = mapped_column(Text, nullable=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    level: Mapped[str] = mapped_column(Text, nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("administrative_areas.id", name="fk_area_parent"), nullable=True
    )
    geom: Mapped[str] = mapped_column(
        Geometry(geometry_type="MULTIPOLYGON", srid=4326, spatial_index=False),
        nullable=False,
    )
    centroid: Mapped[str | None] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326, spatial_index=False),
        nullable=True,
    )
    properties: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default="{}"
    )
    source_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("data_sources.id", name="fk_area_source"), nullable=True
    )

    # Relationships
    parent: Mapped["AdministrativeArea | None"] = relationship(
        "AdministrativeArea", remote_side=[id], backref="children"
    )
    source: Mapped["DataSource | None"] = relationship("DataSource")

    __table_args__ = (
        CheckConstraint(
            "level IN ('provinsi','kabupaten_kota','kecamatan')",
            name="ck_area_level",
        ),
        # UNIQUE NULLS NOT DISTINCT applied via raw SQL in migration
        Index("idx_area_geom", "geom", postgresql_using="gist"),
        Index("idx_area_parent", "parent_id"),
    )


class Hotspot(Base):
    """hotspots table."""
    __tablename__ = "hotspots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("data_sources.id", name="fk_hotspot_source"), nullable=False
    )
    satellite: Mapped[str] = mapped_column(Text, nullable=False)
    instrument: Mapped[str | None] = mapped_column(Text, nullable=True)
    acquired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    geom: Mapped[str] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence_value: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    daynight: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[str | None] = mapped_column(Text, nullable=True)
    frp: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    area_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("administrative_areas.id", name="fk_hotspot_area"), nullable=True
    )
    raw: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    source: Mapped["DataSource"] = relationship("DataSource")
    area: Mapped["AdministrativeArea | None"] = relationship("AdministrativeArea")

    __table_args__ = (
        CheckConstraint("confidence IN ('l','n','h')", name="ck_hotspot_confidence"),
        CheckConstraint("daynight IN ('D','N')", name="ck_hotspot_daynight"),
        Index("idx_hotspots_geom", "geom", postgresql_using="gist"),
        Index("idx_hotspots_acquired", "acquired_at", postgresql_ops={"acquired_at": "DESC"}),
        Index("idx_hotspots_area_time", "area_id", "acquired_at", postgresql_ops={"acquired_at": "DESC"}),
        # uq_hotspot expression index created via raw SQL in migration
    )


class MonitoringStation(Base):
    """monitoring_stations table."""
    __tablename__ = "monitoring_stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("data_sources.id", name="fk_station_source"), nullable=False
    )
    external_id: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str | None] = mapped_column(Text, nullable=True)
    geom: Mapped[str | None] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326, spatial_index=False), nullable=True
    )
    area_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("administrative_areas.id", name="fk_station_area"), nullable=True
    )
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")

    # Relationships
    source: Mapped["DataSource"] = relationship("DataSource")
    area: Mapped["AdministrativeArea | None"] = relationship("AdministrativeArea")

    __table_args__ = (
        UniqueConstraint("source_id", "external_id", name="uq_station"),
        Index("idx_station_geom", "geom", postgresql_using="gist"),
    )


class AirQualityObservation(Base):
    """air_quality_observations table."""
    __tablename__ = "air_quality_observations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    station_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("monitoring_stations.id", name="fk_aq_station"), nullable=False
    )
    pollutant: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[float] = mapped_column(Numeric, nullable=False)
    unit: Mapped[str] = mapped_column(Text, nullable=False, server_default="ug/m3")
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    raw: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    station: Mapped["MonitoringStation"] = relationship("MonitoringStation")

    __table_args__ = (
        CheckConstraint("pollutant IN ('pm25','pm10','o3','no2','so2','co')", name="ck_aq_pollutant"),
        CheckConstraint("value >= 0", name="ck_aq_value_nonneg"),
        UniqueConstraint("station_id", "pollutant", "observed_at", name="uq_aq_obs"),
        Index("idx_aq_station_time", "station_id", "pollutant", "observed_at", postgresql_ops={"observed_at": "DESC"}),
    )


class WeatherObservation(Base):
    """weather_observations table."""
    __tablename__ = "weather_observations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("data_sources.id", name="fk_weather_source"), nullable=False
    )
    area_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("administrative_areas.id", name="fk_weather_area"), nullable=False
    )
    geom: Mapped[str | None] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326, spatial_index=False), nullable=True
    )
    valid_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_forecast: Mapped[bool] = mapped_column(Boolean, nullable=False)
    temperature_c: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    humidity_pct: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    precipitation_mm: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    wind_speed_kmh: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    wind_direction_deg: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    raw: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    source: Mapped["DataSource"] = relationship("DataSource")
    area: Mapped["AdministrativeArea"] = relationship("AdministrativeArea")

    __table_args__ = (
        CheckConstraint("humidity_pct BETWEEN 0 AND 100", name="ck_weather_humidity"),
        CheckConstraint("precipitation_mm >= 0", name="ck_weather_precip"),
        CheckConstraint("wind_speed_kmh >= 0", name="ck_weather_wind_speed"),
        CheckConstraint("wind_direction_deg BETWEEN 0 AND 360", name="ck_weather_wind_dir"),
        UniqueConstraint("source_id", "area_id", "valid_time", "is_forecast", name="uq_weather"),
        Index("idx_weather_area_time", "area_id", "valid_time", postgresql_ops={"valid_time": "DESC"}),
    )


class RiskAssessment(Base):
    """risk_assessments table."""
    __tablename__ = "risk_assessments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    area_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("administrative_areas.id", name="fk_risk_area"), nullable=False
    )
    assessed_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    horizon: Mapped[str] = mapped_column(Text, nullable=False, server_default="current")
    model_version: Mapped[str] = mapped_column(Text, nullable=False)
    risk_level: Mapped[str | None] = mapped_column(Text, nullable=True)
    score: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    factors: Mapped[dict] = mapped_column(JSONB, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    area: Mapped["AdministrativeArea"] = relationship("AdministrativeArea")

    __table_args__ = (
        CheckConstraint(
            "risk_level IN ('low','moderate','high','very_high','extreme') OR risk_level IS NULL",
            name="ck_risk_level",
        ),
        CheckConstraint("score BETWEEN 0 AND 100 OR score IS NULL", name="ck_risk_score"),
        UniqueConstraint("area_id", "assessed_for", "horizon", "model_version", name="uq_risk"),
        Index("idx_risk_area_time", "area_id", "assessed_for", postgresql_ops={"assessed_for": "DESC"}),
    )


class DataIngestionLog(Base):
    """data_ingestion_logs table."""
    __tablename__ = "data_ingestion_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("data_sources.id", name="fk_inglog_source"), nullable=False
    )
    run_id: Mapped[UUID] = mapped_column(nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    records_fetched: Mapped[int | None] = mapped_column(Integer, nullable=True)
    records_inserted: Mapped[int | None] = mapped_column(Integer, nullable=True)
    records_skipped: Mapped[int | None] = mapped_column(Integer, nullable=True)
    records_invalid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    window_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    window_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    params: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    source: Mapped["DataSource"] = relationship("DataSource")

    __table_args__ = (
        CheckConstraint(
            "status IN ('running','success','partial','failed')",
            name="ck_inglog_status",
        ),
        Index("idx_inglog_source_time", "source_id", "started_at", postgresql_ops={"started_at": "DESC"}),
    )


class QuarantineRow(Base):
    """quarantine_rows table."""
    __tablename__ = "quarantine_rows"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("data_sources.id", name="fk_quarantine_source"), nullable=False
    )
    run_id: Mapped[UUID] = mapped_column(nullable=False)
    raw: Mapped[dict] = mapped_column(JSONB, nullable=False)
    validation_error: Mapped[str] = mapped_column(Text, nullable=False)
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    source: Mapped["DataSource"] = relationship("DataSource")

    __table_args__ = (
        Index("idx_quarantine_run", "run_id"),
    )
