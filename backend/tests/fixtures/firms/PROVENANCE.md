# FIRMS Test Fixtures — Provenance

**Status: SYNTHETIC — until MAP_KEY registered**

## sample_viirs.csv

**Source:** Synthetic data constructed to match FIRMS VIIRS NRT CSV format exactly as documented at:
https://firms.modaps.eosdis.nasa.gov/api/area/

**Column Order (VIIRS NRT):**
```
latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
```

**Edge Cases Included:**
1. **Duplicate row** (row 4 = row 1): Same satellite (S-NPP), acq_time (0), lat/lon (0.5, 101.5) — tests idempotent upsert
2. **acq_time variants**: `0` (no padding), `30`, `1359` (23:59), `0000` (zero-padded midnight) — tests integer minutes-from-midnight parsing
3. **Invalid row** (row 6): latitude=999.0 (out of bounds) — tests quarantine path
4. **Multiple satellites**: S-NPP and NOAA-20 — tests satellite disambiguation in unique key
5. **Confidence values**: l, n, h — tests VIIRS confidence passthrough

**Purpose:**
- Unit tests for CSV parsing, acq_time parsing, confidence mapping, duplicate detection
- Integration tests (when PostGIS available): double-ingest idempotency, overlapping windows, quarantine capture

**Note:** This fixture will be replaced with real recorded FIRMS responses once MAP_KEY is registered and live integration tests are run in Phase 3 validation.