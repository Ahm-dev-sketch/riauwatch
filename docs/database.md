# RIAUWATCH — Database Proposal (Phase 2)

**Date:** 2026-08-24 · **Engine:** PostgreSQL 16 + PostGIS 3 · **Migrations:** Alembic
Status: PROPOSAL — DDL sketches, finalized at Phase 3 implementation.

## 1. Conventions

- Spatial reference: `EPSG:4326` stored geometry; SRID enforced per column.
- Timestamps: `timestamptz`, UTC everywhere; WIB conversion is display-only.
- Naming: `snake_case`; primary keys `id`.
- Enum-like values: `TEXT` + `CHECK` constraints (simpler migrations than native enums).
- Every fact row carries provenance: `source_id` + `ingested_at`; observation time separate from retrieval time (freshness honesty).
- Raw upstream payload kept as `raw jsonb` where useful for audit/reprocessing.

## 2. Entity Overview

```
data_sources ──┬─< hotspots >── administrative_areas (self-referencing tree)
               ├─< monitoring_stations ──< air_quality_observations
               ├─< weather_observations >── administrative_areas
               ├─< risk_assessments >── administrative_areas
               └─< data_ingestion_logs
```

## 3. Tables

### data_sources
```sql
CREATE TABLE data_sources (
  id              SERIAL PRIMARY KEY,
  key             TEXT NOT NULL UNIQUE,          -- e.g. 'firms_viirs_nrt', 'open_meteo', 'openaq_v3'
  name            TEXT NOT NULL,
  provider_url    TEXT NOT NULL,
  license_note    TEXT NOT NULL,
  attribution     TEXT NOT NULL,
  update_interval_seconds INTEGER,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### administrative_areas
```sql
CREATE TABLE administrative_areas (
  id        SERIAL PRIMARY KEY,
  kode_bps  TEXT UNIQUE,                         -- official code if available; nullable, never invented
  name      TEXT NOT NULL,
  level     TEXT NOT NULL CHECK (level IN ('provinsi','kabupaten_kota','kecamatan')),
  parent_id INTEGER REFERENCES administrative_areas(id),
  geom      geometry(MultiPolygon, 4326) NOT NULL,
  centroid  geometry(Point, 4326),
  properties JSONB NOT NULL DEFAULT '{}',
  source_id INTEGER REFERENCES data_sources(id),
  CONSTRAINT uq_area UNIQUE (level, name, parent_id)
);
CREATE INDEX idx_area_geom ON administrative_areas USING GIST (geom);
```

### hotspots
```sql
CREATE TABLE hotspots (
  id            BIGSERIAL PRIMARY KEY,
  source_id     INTEGER NOT NULL REFERENCES data_sources(id),
  satellite     TEXT NOT NULL,                   -- e.g. 'S-NPP','NOAA-20','Terra','Aqua'
  instrument    TEXT,                            -- 'VIIRS' | 'MODIS'
  acquired_at   TIMESTAMPTZ NOT NULL,
  geom          geometry(Point, 4326) NOT NULL,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  confidence    TEXT CHECK (confidence IN ('l','n','h')),       -- normalized VIIRS vocab
  confidence_value NUMERIC,                      -- MODIS 0–100, nullable
  frp           NUMERIC,                         -- fire radiative power if provided
  area_id       INTEGER REFERENCES administrative_areas(id),    -- resolved via ST_Covers; nullable if unresolved
  raw           JSONB,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotency natural key (see §4):
  CONSTRAINT uq_hotspot UNIQUE (source_id, satellite, acquired_at,
                                round(latitude::numeric, 4), round(longitude::numeric, 4))
);
CREATE INDEX idx_hotspots_geom ON hotspots USING GIST (geom);
CREATE INDEX idx_hotspots_acquired ON hotspots (acquired_at DESC);
CREATE INDEX idx_hotspots_area_time ON hotspots (area_id, acquired_at DESC);
```

### monitoring_stations
```sql
CREATE TABLE monitoring_stations (
  id          SERIAL PRIMARY KEY,
  source_id   INTEGER NOT NULL REFERENCES data_sources(id),
  external_id TEXT NOT NULL,                     -- provider's station/location id
  name        TEXT,
  geom        geometry(Point, 4326),
  area_id     INTEGER REFERENCES administrative_areas(id),
  meta        JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT uq_station UNIQUE (source_id, external_id)
);
CREATE INDEX idx_station_geom ON monitoring_stations USING GIST (geom);
```

### air_quality_observations
```sql
CREATE TABLE air_quality_observations (
  id          BIGSERIAL PRIMARY KEY,
  station_id  INTEGER NOT NULL REFERENCES monitoring_stations(id),
  pollutant   TEXT NOT NULL CHECK (pollutant IN ('pm25','pm10','o3','no2','so2','co')),
  value       NUMERIC NOT NULL CHECK (value >= 0),
  unit        TEXT NOT NULL DEFAULT 'ug/m3',
  observed_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw         JSONB,
  CONSTRAINT uq_aq_obs UNIQUE (station_id, pollutant, observed_at)
);
CREATE INDEX idx_aq_station_time ON air_quality_observations (station_id, pollutant, observed_at DESC);
```

### weather_observations
```sql
CREATE TABLE weather_observations (
  id             BIGSERIAL PRIMARY KEY,
  source_id      INTEGER NOT NULL REFERENCES data_sources(id),
  area_id        INTEGER REFERENCES administrative_areas(id),   -- kabupaten centroid point forecasts
  geom           geometry(Point, 4326),                          -- exact point queried (user-independent)
  valid_time     TIMESTAMPTZ NOT NULL,
  is_forecast    BOOLEAN NOT NULL,
  temperature_c  NUMERIC,
  humidity_pct   NUMERIC CHECK (humidity_pct BETWEEN 0 AND 100),
  precipitation_mm NUMERIC CHECK (precipitation_mm >= 0),
  wind_speed_kmh NUMERIC CHECK (wind_speed_kmh >= 0),
  wind_direction_deg NUMERIC CHECK (wind_direction_deg BETWEEN 0 AND 360),
  ingested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw            JSONB,
  CONSTRAINT uq_weather UNIQUE (source_id, area_id, valid_time, is_forecast)
);
CREATE INDEX idx_weather_area_time ON weather_observations (area_id, valid_time DESC);
```

### risk_assessments
```sql
CREATE TABLE risk_assessments (
  id            BIGSERIAL PRIMARY KEY,
  area_id       INTEGER NOT NULL REFERENCES administrative_areas(id),
  assessed_for  TIMESTAMPTZ NOT NULL,            -- validity window start
  horizon       TEXT NOT NULL DEFAULT 'current',
  model_version TEXT NOT NULL,                   -- 'rules-v0.1'; future ML versions coexist
  risk_level    TEXT CHECK (risk_level IN ('low','moderate','high','very_high','extreme')
                            OR risk_level IS NULL),  -- NULL = INSUFFICIENT_DATA
  score         NUMERIC CHECK (score BETWEEN 0 AND 100 OR score IS NULL),
  factors       JSONB NOT NULL,                  -- explainability block from risk-model.md §4
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_risk UNIQUE (area_id, assessed_for, horizon, model_version)
);
CREATE INDEX idx_risk_area_time ON risk_assessments (area_id, assessed_for DESC);
```

### data_ingestion_logs
```sql
CREATE TABLE data_ingestion_logs (
  id                BIGSERIAL PRIMARY KEY,
  source_id         INTEGER NOT NULL REFERENCES data_sources(id),
  run_id            UUID NOT NULL,
  started_at        TIMESTAMPTZ NOT NULL,
  finished_at       TIMESTAMPTZ,
  status            TEXT NOT NULL CHECK (status IN ('success','partial','failed')),
  records_fetched   INTEGER,
  records_inserted  INTEGER,
  records_skipped   INTEGER,                     -- duplicates/conflicts
  records_invalid   INTEGER,                     -- failed validation (quarantined, counted)
  window_from       TIMESTAMPTZ,                 -- observation window covered
  window_to         TIMESTAMPTZ,
  params            JSONB,                       -- bbox, sensors, etc. (no secrets)
  error_detail      TEXT
);
CREATE INDEX idx_inglog_source_time ON data_ingestion_logs (source_id, started_at DESC);
```

## 4. Idempotency & Deduplication Strategy

FIRMS rows carry no detection IDs, so the natural key is `(source_id, satellite, acquired_at, lat/lon rounded to 4 dp ≈ 11 m)` — well below VIIRS 375 m pixel size, so distinct detections cannot collide while true re-downloads of the same detection do. Ingestion uses `INSERT … ON CONFLICT DO NOTHING` (re-ingest of identical rows updates nothing); if FIRMS later revises confidence values, a deliberate `DO UPDATE` variant keyed on the same constraint handles it. Same pattern applies to AQ (`station, pollutant, observed_at`) and weather (`area, valid_time, is_forecast`). Duplicate-prevention is asserted by dedicated integration tests (same fixture ingested twice ⇒ unchanged row count).

## 5. Query Patterns Served

- Map viewport: `idx_hotspots_geom` + time filter.
- Headline counts/group-by-kabupaten: `idx_hotspots_area_time`.
- Nearest AQ station: `idx_station_geom` KNN (`ORDER BY geom <-> point`).
- Freshness (`/status`): max(`observed_at`/`acquired_at`) per domain — indexed by the DESC time indexes.
- Risk history: `idx_risk_area_time`.

## 6. Retention (initial policy)

- Hotspots, AQ observations, risk assessments: retain indefinitely (small rows, historical value).
- Weather **forecast** rows: prune `valid_time < now() - 7 d`; keep `is_forecast = false` history.
- Ingestion logs: prune > 180 d (aggregate stats first if needed).
Policy enforced by a periodic worker job; revisited with real data volumes.

## 7. Migrations

Alembic from day one; migration 0001 enables `postgis` extension. Schema changes only via migrations — no manual DDL in any environment.
