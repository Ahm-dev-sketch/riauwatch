"""Enable PostGIS extension and create all tables.

Revision ID: 0001
Revises:
Create Date: 2026-08-25
"""

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable PostGIS extension first
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    # data_sources
    op.create_table(
        "data_sources",
        sa.Column("id", sa.Integer(), sa.Identity(), nullable=False),
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("provider_url", sa.Text(), nullable=False),
        sa.Column("license_note", sa.Text(), nullable=False),
        sa.Column("attribution", sa.Text(), nullable=False),
        sa.Column("update_interval_seconds", sa.Integer(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name="pk_data_sources"),
        sa.UniqueConstraint("key", name="uq_data_sources_key"),
    )

    # administrative_areas
    op.create_table(
        "administrative_areas",
        sa.Column("id", sa.Integer(), sa.Identity(), nullable=False),
        sa.Column("kode_bps", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("level", sa.Text(), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column(
            "geom",
            Geometry(geometry_type="MULTIPOLYGON", srid=4326, spatial_index=False),
            nullable=False,
        ),
        sa.Column(
            "centroid",
            Geometry(geometry_type="POINT", srid=4326, spatial_index=False),
            nullable=True,
        ),
        sa.Column("properties", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_administrative_areas"),
        sa.ForeignKeyConstraint(["parent_id"], ["administrative_areas.id"], name="fk_area_parent"),
        sa.ForeignKeyConstraint(["source_id"], ["data_sources.id"], name="fk_area_source"),
        sa.CheckConstraint("level IN ('provinsi','kabupaten_kota','kecamatan')", name="ck_area_level"),
    )
    # NULLS NOT DISTINCT keeps provinsi rows (parent_id IS NULL) inside dedup scope (PG16+).
    op.execute(
        "ALTER TABLE administrative_areas ADD CONSTRAINT uq_area "
        "UNIQUE NULLS NOT DISTINCT (level, name, parent_id);"
    )
    op.create_index("idx_area_geom", "administrative_areas", ["geom"], postgresql_using="gist")
    op.create_index("idx_area_parent", "administrative_areas", ["parent_id"])

    # hotspots
    op.create_table(
        "hotspots",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("satellite", sa.Text(), nullable=False),
        sa.Column("instrument", sa.Text(), nullable=True),
        sa.Column("acquired_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("geom", Geometry(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Text(), nullable=True),
        sa.Column("confidence_value", sa.Numeric(), nullable=True),
        sa.Column("daynight", sa.Text(), nullable=True),
        sa.Column("version", sa.Text(), nullable=True),
        sa.Column("frp", sa.Numeric(), nullable=True),
        sa.Column("area_id", sa.Integer(), nullable=True),
        sa.Column("raw", JSONB(), nullable=True),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name="pk_hotspots"),
        sa.ForeignKeyConstraint(["source_id"], ["data_sources.id"], name="fk_hotspot_source"),
        sa.ForeignKeyConstraint(["area_id"], ["administrative_areas.id"], name="fk_hotspot_area"),
        sa.CheckConstraint("confidence IN ('l','n','h')", name="ck_hotspot_confidence"),
        sa.CheckConstraint("daynight IN ('D','N')", name="ck_hotspot_daynight"),
    )
    op.create_index("idx_hotspots_geom", "hotspots", ["geom"], postgresql_using="gist")
    op.create_index("idx_hotspots_acquired", "hotspots", ["acquired_at"], postgresql_ops={"acquired_at": "DESC"})
    op.create_index("idx_hotspots_area_time", "hotspots", ["area_id", "acquired_at"], postgresql_ops={"acquired_at": "DESC"})
    # Standalone unique index for hotspot deduplication (expression index)
    op.execute(
        "CREATE UNIQUE INDEX uq_hotspot ON hotspots "
        "(source_id, satellite, acquired_at, round(latitude::numeric, 4), round(longitude::numeric, 4));"
    )

    # monitoring_stations
    op.create_table(
        "monitoring_stations",
        sa.Column("id", sa.Integer(), sa.Identity(), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("external_id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("geom", Geometry(geometry_type="POINT", srid=4326, spatial_index=False), nullable=True),
        sa.Column("area_id", sa.Integer(), nullable=True),
        sa.Column("meta", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.PrimaryKeyConstraint("id", name="pk_monitoring_stations"),
        sa.ForeignKeyConstraint(["source_id"], ["data_sources.id"], name="fk_station_source"),
        sa.ForeignKeyConstraint(["area_id"], ["administrative_areas.id"], name="fk_station_area"),
        sa.UniqueConstraint("source_id", "external_id", name="uq_station"),
    )
    op.create_index("idx_station_geom", "monitoring_stations", ["geom"], postgresql_using="gist")

    # air_quality_observations
    op.create_table(
        "air_quality_observations",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("station_id", sa.Integer(), nullable=False),
        sa.Column("pollutant", sa.Text(), nullable=False),
        sa.Column("value", sa.Numeric(), nullable=False),
        sa.Column("unit", sa.Text(), nullable=False, server_default=sa.text("'ug/m3'")),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("raw", JSONB(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_air_quality_observations"),
        sa.ForeignKeyConstraint(["station_id"], ["monitoring_stations.id"], name="fk_aq_station"),
        sa.CheckConstraint("pollutant IN ('pm25','pm10','o3','no2','so2','co')", name="ck_aq_pollutant"),
        sa.CheckConstraint("value >= 0", name="ck_aq_value_nonneg"),
        sa.UniqueConstraint("station_id", "pollutant", "observed_at", name="uq_aq_obs"),
    )
    op.create_index("idx_aq_station_time", "air_quality_observations", ["station_id", "pollutant", "observed_at"], postgresql_ops={"observed_at": "DESC"})

    # weather_observations
    op.create_table(
        "weather_observations",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("area_id", sa.Integer(), nullable=False),
        sa.Column("geom", Geometry(geometry_type="POINT", srid=4326, spatial_index=False), nullable=True),
        sa.Column("valid_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_forecast", sa.Boolean(), nullable=False),
        sa.Column("temperature_c", sa.Numeric(), nullable=True),
        sa.Column("humidity_pct", sa.Numeric(), nullable=True),
        sa.Column("precipitation_mm", sa.Numeric(), nullable=True),
        sa.Column("wind_speed_kmh", sa.Numeric(), nullable=True),
        sa.Column("wind_direction_deg", sa.Numeric(), nullable=True),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("raw", JSONB(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_weather_observations"),
        sa.ForeignKeyConstraint(["source_id"], ["data_sources.id"], name="fk_weather_source"),
        sa.ForeignKeyConstraint(["area_id"], ["administrative_areas.id"], name="fk_weather_area"),
        sa.CheckConstraint("humidity_pct BETWEEN 0 AND 100", name="ck_weather_humidity"),
        sa.CheckConstraint("precipitation_mm >= 0", name="ck_weather_precip"),
        sa.CheckConstraint("wind_speed_kmh >= 0", name="ck_weather_wind_speed"),
        sa.CheckConstraint("wind_direction_deg BETWEEN 0 AND 360", name="ck_weather_wind_dir"),
        sa.UniqueConstraint("source_id", "area_id", "valid_time", "is_forecast", name="uq_weather"),
    )
    op.create_index("idx_weather_area_time", "weather_observations", ["area_id", "valid_time"], postgresql_ops={"valid_time": "DESC"})

    # risk_assessments
    op.create_table(
        "risk_assessments",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("area_id", sa.Integer(), nullable=False),
        sa.Column("assessed_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("horizon", sa.Text(), nullable=False, server_default=sa.text("'current'")),
        sa.Column("model_version", sa.Text(), nullable=False),
        sa.Column("risk_level", sa.Text(), nullable=True),
        sa.Column("score", sa.Numeric(), nullable=True),
        sa.Column("factors", JSONB(), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name="pk_risk_assessments"),
        sa.ForeignKeyConstraint(["area_id"], ["administrative_areas.id"], name="fk_risk_area"),
        sa.CheckConstraint(
            "risk_level IN ('low','moderate','high','very_high','extreme') OR risk_level IS NULL",
            name="ck_risk_level",
        ),
        sa.CheckConstraint("score BETWEEN 0 AND 100 OR score IS NULL", name="ck_risk_score"),
        sa.UniqueConstraint("area_id", "assessed_for", "horizon", "model_version", name="uq_risk"),
    )
    op.create_index("idx_risk_area_time", "risk_assessments", ["area_id", "assessed_for"], postgresql_ops={"assessed_for": "DESC"})

    # data_ingestion_logs
    op.create_table(
        "data_ingestion_logs",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("run_id", UUID(as_uuid=False), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("records_fetched", sa.Integer(), nullable=True),
        sa.Column("records_inserted", sa.Integer(), nullable=True),
        sa.Column("records_skipped", sa.Integer(), nullable=True),
        sa.Column("records_invalid", sa.Integer(), nullable=True),
        sa.Column("window_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("window_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("params", JSONB(), nullable=True),
        sa.Column("error_detail", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_data_ingestion_logs"),
        sa.ForeignKeyConstraint(["source_id"], ["data_sources.id"], name="fk_inglog_source"),
        sa.CheckConstraint(
            "status IN ('running','success','partial','failed')",
            name="ck_inglog_status",
        ),
    )
    op.create_index("idx_inglog_source_time", "data_ingestion_logs", ["source_id", "started_at"], postgresql_ops={"started_at": "DESC"})

    # quarantine_rows
    op.create_table(
        "quarantine_rows",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("run_id", UUID(as_uuid=False), nullable=False),
        sa.Column("raw", JSONB(), nullable=False),
        sa.Column("validation_error", sa.Text(), nullable=False),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name="pk_quarantine_rows"),
        sa.ForeignKeyConstraint(["source_id"], ["data_sources.id"], name="fk_quarantine_source"),
    )
    op.create_index("idx_quarantine_run", "quarantine_rows", ["run_id"])


def downgrade() -> None:
    op.drop_index("idx_quarantine_run", table_name="quarantine_rows")
    op.drop_table("quarantine_rows")

    op.drop_index("idx_inglog_source_time", table_name="data_ingestion_logs")
    op.drop_table("data_ingestion_logs")

    op.drop_index("idx_risk_area_time", table_name="risk_assessments")
    op.drop_table("risk_assessments")

    op.drop_index("idx_weather_area_time", table_name="weather_observations")
    op.drop_table("weather_observations")

    op.drop_index("idx_aq_station_time", table_name="air_quality_observations")
    op.drop_table("air_quality_observations")

    op.drop_index("idx_station_geom", table_name="monitoring_stations")
    op.drop_table("monitoring_stations")

    op.execute("DROP INDEX IF EXISTS uq_hotspot;")
    op.drop_index("idx_hotspots_area_time", table_name="hotspots")
    op.drop_index("idx_hotspots_acquired", table_name="hotspots")
    op.drop_index("idx_hotspots_geom", table_name="hotspots")
    op.drop_table("hotspots")

    op.drop_index("idx_area_parent", table_name="administrative_areas")
    op.drop_index("idx_area_geom", table_name="administrative_areas")
    op.drop_table("administrative_areas")

    op.drop_table("data_sources")

    op.execute("DROP EXTENSION IF EXISTS postgis;")
