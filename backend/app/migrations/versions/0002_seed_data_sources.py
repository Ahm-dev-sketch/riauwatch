"""Seed data_sources with adopted sources.

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-25
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Insert seed data for adopted sources
    op.bulk_insert(
        sa.table(
            "data_sources",
            sa.column("key", sa.Text()),
            sa.column("name", sa.Text()),
            sa.column("provider_url", sa.Text()),
            sa.column("license_note", sa.Text()),
            sa.column("attribution", sa.Text()),
            sa.column("update_interval_seconds", sa.Integer()),
            sa.column("active", sa.Boolean()),
        ),
        [
            {
                "key": "firms_viirs_nrt",
                "name": "NASA FIRMS VIIRS NRT",
                "provider_url": "https://firms.modaps.eosdis.nasa.gov/api/area/",
                "license_note": "NASA open data; attribution requested",
                "attribution": "Fire detections courtesy of NASA FIRMS (LANCE/EOSDIS)",
                "update_interval_seconds": 7200,  # 2 hours
                "active": True,
            },
            {
                "key": "firms_modis_nrt",
                "name": "NASA FIRMS MODIS NRT",
                "provider_url": "https://firms.modaps.eosdis.nasa.gov/api/area/",
                "license_note": "NASA open data; attribution requested",
                "attribution": "Fire detections courtesy of NASA FIRMS (LANCE/EOSDIS)",
                "update_interval_seconds": 7200,  # 2 hours
                "active": True,
            },
            {
                "key": "open_meteo",
                "name": "Open-Meteo Weather API",
                "provider_url": "https://api.open-meteo.com/v1/forecast",
                "license_note": "Free for non-commercial use with attribution",
                "attribution": "Weather data by Open-Meteo.com",
                "update_interval_seconds": 7200,  # 2 hours
                "active": True,
            },
            {
                "key": "openaq_v3",
                "name": "OpenAQ v3 Air Quality API",
                "provider_url": "https://api.openaq.org/v3/",
                "license_note": "Open data; attribution to OpenAQ and originating monitor network required",
                "attribution": "Air quality data via OpenAQ",
                "update_interval_seconds": 7200,  # 2 hours
                "active": True,
            },
            {
                "key": "geoboundaries",
                "name": "geoBoundaries Administrative Boundaries",
                "provider_url": "https://www.geoboundaries.org/",
                "license_note": "CC-BY 4.0",
                "attribution": "geoBoundaries (Runfola et al., 2020)",
                "update_interval_seconds": None,  # Static, refreshed quarterly
                "active": True,
            },
        ],
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM data_sources WHERE key IN "
        "('firms_viirs_nrt', 'firms_modis_nrt', 'open_meteo', 'openaq_v3', 'geoboundaries');"
    )
