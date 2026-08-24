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
  daynight      TEXT CHECK (daynight IN ('D','N')),             -- FIRMS day/night flag (interpretation-relevant)
  version       TEXT,                            -- 'NRT' | archive tag (reconciles data-sources.md field list)
  frp           NUMERIC,                         -- fire radiative power if provided
  area_id       INTEGER REFERENCES administrative_areas(id),    -- resolved via ST_Covers; nullable if unresolved
  raw           JSONB,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Expression keys cannot be declared inline — standalone unique index (see §4):
CREATE UNIQUE INDEX uq_hotspot ON hotspots
  (source_id, satellite, acquired_at, round(latitude::numeric, 4), round(longitude::numeric, 4));
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
  area_id        INTEGER NOT NULL REFERENCES administrative_areas(id),  -- kabupaten centroid point forecasts;
                                                                                -- NOT NULL keeps the unique key NULL-safe
  geom           geometry(Point, 4326),                          -- exact point queried (user-independent)
  valid_time     TIMESTAMPTZ NOT NULL,
  is_forecast    BOOLEAN NOT NULL,               -- boundary rule: valid_time ≤ last complete hour ⇒ false;
                                                 -- both classes are model-derived (see risk-model.md §2)
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
  status            TEXT NOT NULL CHECK (status IN ('running','success','partial','failed')),
                    -- row is INSERTED AT RUN START as 'running' and updated on completion, so crashed/killed
                    -- runs remain visible; stale 'running' rows past a timeout count as failures for /status
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

### quarantine_rows
```sql
CREATE TABLE quarantine_rows (
  id               BIGSERIAL PRIMARY KEY,
  source_id        INTEGER NOT NULL REFERENCES data_sources(id),
  run_id           UUID NOT NULL,
  raw              JSONB NOT NULL,             -- offending payload exactly as received
  validation_error TEXT NOT NULL,
  detected_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quarantine_run ON quarantine_rows (run_id);
```

Exists so "invalid rows quarantined" is a real mechanism, not just a counter — source format drift becomes debuggable. Pruned aggressively (see §6).

## 4. Idempotency & Deduplication Strategy

Conflict policy is **per-table and explicit** — revision semantics differ by source:

| Table | Natural key | Conflict policy | Rationale |
|---|---|---|---|
| hotspots | `(source_id, satellite, acquired_at, lat/lon @4dp)` | `ON CONFLICT DO NOTHING` — **first-seen wins** | FIRMS NRT files are regenerated; keeping the first-seen version never loses data. Documented consequence: our historical counts can exceed live FIRMS if rows vanish upstream — this is intentional, nobody should "fix" it later. |
| weather_observations | `(source_id, area_id, valid_time, is_forecast)` | `ON CONFLICT DO UPDATE` — **latest-cycle-wins**, refresh `ingested_at` | Open-Meteo re-emits the same `valid_time` hours with revised values every model cycle. First-wins here would serve week-old forecasts while `/status` stays green — unacceptable. |
| air_quality_observations | `(station_id, pollutant, observed_at)` | `ON CONFLICT DO NOTHING` — first-wins | Provider corrections for an identical timestamp are rare; policy is stated rather than silent. Revisit if corrections prove material. |

FIRMS key soundness: CSV timestamps are minute-precision (`acq_date` + `acq_time` parsed as **integer minutes-from-midnight**, not fixed-width string — zero-padding is not guaranteed); a satellite cannot re-observe the same point within a minute (orbital period ~101 min), and same-pass detections are separated by ≥1 pixel IFOV (375 m VIIRS / 1 km MODIS) ≫ the 11 m rounding cell. Cross-satellite coincidence is disambiguated by `satellite`. Overlapping retrieval windows are absorbed by `DO NOTHING`.

Retrieval windows: every hotspots run looks back **≥ 48 h** (cheap because idempotent) so worker downtime never creates permanent gaps; the covered window is recorded in `window_from/to`. FIRMS area-API day-range cap verified live in Phase 3.

Duplicate-prevention and revision semantics are asserted by dedicated integration tests: same fixture twice ⇒ unchanged row count; **forecast cycle A then cycle B over the same `valid_time`s ⇒ values updated, row count unchanged**; overlapping-window ingest ⇒ no duplicates.

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
- Quarantine rows: prune > 30 d (long enough to debug source drift, short enough to stay negligible).
Policy enforced by a periodic worker job; revisited with real data volumes.

## 7. Migrations

Alembic from day one; migration 0001 enables `postgis` extension. Schema changes only via migrations — no manual DDL in any environment.
