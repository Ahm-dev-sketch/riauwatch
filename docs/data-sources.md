# RIAUWATCH — Data Sources Research & Decision Matrix (Phase 1)

**Date:** 2026-08-24 · **Method:** documentation/terms review via web research. Endpoint behavior, exact coverage figures, and undocumented rate limits are marked **UNVERIFIED** and must be confirmed by live integration tests in Phase 3 before any feature is declared complete.

## Guiding Constraints (from CORE RULES)

- 100% free platform → prefer genuinely free/open sources; no paid tiers unless strongly justified.
- Automated scheduled ingestion must be permitted by each source's terms.
- Hotspot ≠ confirmed fire; source confidence fields must be preserved end-to-end.
- Every stored record carries `source`, `observation_time`, `retrieved_at`; freshness is always shown to users.

## Decision Summary Matrix

| # | Source | Provides | Role | Update freq | License | Automation OK | Verdict | Research confidence |
|---|--------|----------|------|-------------|---------|---------------|---------|---------------------|
| 1 | NASA FIRMS | Active-fire hotspots (MODIS C6.1 ~1 km; VIIRS S-NPP/NOAA-20/21 375 m), confidence, acquisition time | **PRIMARY hotspot source** | NRT ≤ ~3 h; archive ~daily | NASA open data (attribution requested) | Yes — free MAP_KEY, ~5,000 tx/10 min | **ADOPT (MVP)** | High |
| 2 | Open-Meteo | Hourly weather forecast + recent past: temperature, RH, precipitation, wind speed/direction | **PRIMARY weather source** | Model updates multiple times/day; API highly available | Free for non-commercial use, attribution required | Yes — ~10 req/s, no key | **ADOPT (MVP)** | High |
| 3 | OpenAQ (v3) | Ground-station PM2.5/PM10 (+ other pollutants) | **PRIMARY air-quality source** | Near-real-time (~1–6 h station-dependent) | Open, attribution to OpenAQ + origin network | Yes — free API key, ~60 req/min free tier | **ADOPT (MVP)** — caveat: Riau station density possibly low (**UNVERIFIED**) | Medium |
| 4 | geoBoundaries | Admin boundary polygons (province/kabupaten/kota), GeoJSON/SHP | **PRIMARY boundaries source** | Static versioned releases (~annual) | CC-BY 4.0 | One-off download + periodic refresh | **ADOPT (MVP)** | Medium-High |
| 5 | OpenStreetMap (Overpass / tiles) | Admin polygons (fallback/cross-check), map basemap tiles | Boundaries fallback + basemap | Continuous edits | ODbL — attribution "© OpenStreetMap contributors", share-alike for derived data | Yes — Overpass rate-limited (~1–5 req/s polite) | **ADOPT** (basemap + fallback) | High |
| 6 | NOAA HMS | Smoke plume polygons (light/med/heavy), analyst-derived fire points | Optional secondary fire/smoke layer | ~Daily products | US public domain (NOAA attribution) | Yes — courteous use, no key | **DEFER** (post-MVP enhancement) | Medium |
| 7 | BMKG | Official forecasts (DigitalForecast XML), fire-danger index, AQ page | Official reference; link-out | Forecasts 2×/day | Free non-commercial; **automated/machine access requires official API & permission** | **Conditional — written permission needed** | **CONDITIONAL** — link-out/reference now; permission track later (user decision) | Medium (terms reviewed; endpoint stability UNVERIFIED) |
| 8 | WAQI (aqicn.org) | AQI + PM2.5 per station | Backup AQ source | Hourly-ish | Free token, non-commercial, attribution | With registered token | **CONDITIONAL** — activate only if OpenAQ Riau coverage insufficient | Low-Medium (rate limits undocumented) |
| 9 | PurpleAir | Citizen-sensor PM2.5 | Hyperlocal AQ supplement | Minutes | Free dev key, non-commercial; attribution | Yes (key) | **CONDITIONAL** — sparse sensors in Riau (**UNVERIFIED**) | Low-Medium |
| 10 | KLHK/SPKUA ISPU | Official Indonesian ISPU/AQ indices | Official reference | Daily | Government data; programmatic access needs approval | **No public API** | **REJECT for pipeline** — manual reference/link-out only | Medium |
| 11 | BIG (Indonesia geoportal) | Official admin boundaries | Authoritative reference | Periodic | Non-commercial free; commercial/licensed reuse restricted | Not without license | **REJECT for pipeline** | Medium |
| 12 | GADM | Detailed admin polygons | Alternative boundaries | Versioned releases | Free **non-commercial only**; redistribution restricted | One-off OK | **CONDITIONAL** — not adopted; geoBoundaries preferred for license cleanliness | Medium |
| 13 | CHIRPS / GSMaP | Satellite/gauge rainfall estimates | Rainfall observations for risk factors | Monthly (CHIRPS) / 3-hourly coarse (GSMaP) | Open (USGS / JAXA — access details UNVERIFIED) | Yes | **DEFER** — MVP "recent rainfall" factor starts from Open-Meteo past-days data | Low-Medium |
| 14 | data.go.id / BNPB / karhutla portals | Incident logs, peatland/risk datasets | Contextual datasets | Per-dataset | Per-dataset licenses; many restricted | Case-by-case | **CONDITIONAL/REJECT** — survey later; nothing blocking MVP | Low |

## Adopted Sources — Detail

### 1. NASA FIRMS (primary hotspots)
- **Mechanism:** Area REST API (bbox + sensor + date range → CSV) using a free MAP_KEY (email registration). KML footprint feeds exist without key.
- **Fields we ingest:** latitude, longitude, acquisition datetime, satellite, instrument, confidence (l/n/h for VIIRS; 0–100 for MODIS), brightness/frp where present, version (NRT vs archive).
- **Idempotency plan:** unique key on `(source, satellite, latitude_rounded, longitude_rounded, acquired_at)` — repeated ingestion must not duplicate rows (enforced at DB level, tested).
- **Rate limits:** ~5,000 transactions/10 min per key (documented). Our cadence (Riau bbox, 1–3 h) is far below this.
- **Integrity handling:** confidence preserved; UI states "hotspot indikasi titik panas, bukan kebakaran terkonfirmasi".

### 2. Open-Meteo (primary weather)
- **Mechanism:** REST, no key: `api.open-meteo.com/v1/forecast` with lat/lon, hourly variables (temperature_2m, relative_humidity_2m, precipitation, wind_speed_10m, wind_direction_10m), `past_days` for recent observed-ish model data, timezone Asia/Jakarta.
- **Terms:** free for non-commercial use with attribution ("Weather data by Open-Meteo.com"). RIAUWATCH is free/non-commercial → compliant.
- **Usage:** point queries per kabupaten/kota centroid + user-location queries (client-side, no storage of precise coordinates).
- **UNVERIFIED:** exact current rate-limit numbers; confirm during Phase 3 load tests.

### 3. OpenAQ v3 (primary air quality)
- **Mechanism:** REST v3 with free API key (`X-API-Key` header); query locations by bbox/radius; returns pollutant measurements with datetime and provider attribution.
- **Known risk:** Riau ground-station coverage may be very thin (possibly only Pekanbaru/Dumai area). **Must verify actual station list in Phase 3 before promising AQ coverage anywhere in the province.**
- **Fallback ladder:** OpenAQ → WAQI (conditional) → explicit "Data temporarily unavailable." Never interpolate/invent values.

### 4. geoBoundaries (boundaries) + OSM (basemap/fallback)
- **geoBoundaries:** download Indonesia ADM2 (kabupaten/kota) GeoJSON once, store in PostGIS, attribute "geoBoundaries (Runfola et al., 2020)", CC-BY 4.0.
- **OSM:** raster/vector basemap tiles with "© OpenStreetMap contributors"; Overpass used only for occasional cross-checks, respecting rate limits. Cross-check geometry against BIG/official shapes visually; document discrepancies rather than silently mixing sources.

## Conditional / Deferred — Reasoning

- **BMKG:** most authoritative national source, but its terms reserve machine-to-machine access for the official API and require permission for automated redistribution use. RIAUWATCH will (a) deep-link users to BMKG for official forecasts, (b) optionally request written permission later — **this is a user/legal decision, flagged at the Phase 2 checkpoint**, not assumed.
- **NOAA HMS smoke polygons:** valuable context layer ("asap terdeteksi") but analyst-produced daily polygons add scope; deferred to post-MVP.
- **WAQI / PurpleAir:** activated only if OpenAQ verification shows unacceptable gaps; both need tokens/keys and have undocumented limits.
- **CHIRPS/GSMaP:** coarse rainfall climatology useful for risk-model calibration later; MVP risk inputs start with Open-Meteo precipitation history.
- **KLHK ISPU, BIG, SiBakoh-type portals:** rejected for automated ingestion (no public API or license restrictions). Referenced manually where relevant.

## Attribution Requirements (to render on `/data-sources` and map footer)

- Hotspots: "Firm detections courtesy of NASA FIRMS (LANCE/EOSDIS)"
- Weather: "Weather data by Open-Meteo.com"
- Air quality: "Air quality data via OpenAQ" + originating monitor network
- Boundaries: "geoBoundaries (Runfola et al., 2020)" · "© OpenStreetMap contributors"
- Any BMKG-linked content: full attribution + link to bmkg.go.id

## Open Actions Before Phase 3 (ingestion)

1. Register free NASA FIRMS MAP_KEY (email registration) → store as `FIRMS_MAP_KEY` env var (name only in `.env.example`).
2. Register free OpenAQ API key → `OPENAQ_API_KEY`.
3. Live-verify: FIRMS area API response shape; OpenAQ Riau station inventory (decisive for AQ UX); Open-Meteo variable availability for Riau centroids; geoBoundaries ADM2 file integrity.
4. User decision (flagged): pursue BMKG written permission now vs link-out-only for MVP.
5. Define staleness thresholds per source (e.g., hotspots >6 h → "Data may be delayed") — finalized in Phase 2 design.

## Review Cadence

Re-verify licenses/terms of all ADOPTED sources quarterly and before any major release; update this document with date stamps.
