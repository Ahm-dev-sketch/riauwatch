# Fixture Provenance — boundaries/

## sample_areas.geojson

**Status: SYNTHETIC — minimal two-polygon fixture for unit testing**

**Real Data Source:** geoBoundaries IDN ADM2 (kabupaten/kota level)
- **Download URL:** https://www.geoboundaries.org/api/current/gbOpen/IDN/ADM2/
- **Response field:** `gjDownloadURL` provides the actual GeoJSON download link
- **License:** CC-BY 4.0
- **Attribution required:** "geoBoundaries (Runfola et al., 2020)"

**Real Data Structure (geoBoundaries ADM2 properties):**
- `shapeName`: kabupaten/kota name (e.g., "Pekanbaru", "Dumai")
- `shapeGroup`: "IDN" (ISO country code)
- `shapeType`: "ADM2" (administrative level)
- `shapeID`: unique identifier (e.g., "IDN.14.71" for Pekanbaru in Riau province 14)
- `ADM2_NAME`: local name
- `ADM2_EN`: English name
- `ADM2_PCODE`: administrative code (same as shapeID)

**Synthetic Fixture Design:**
- Two simple rectangular polygons approximating Pekanbaru and Dumai kabupaten
- Minimal coordinate precision for fast test execution
- Includes all key property fields for mapping validation

**Purpose:**
- Unit tests for GeoJSON parsing, geometry→WKT conversion, property mapping
- Integration tests for boundary upsert (ON CONFLICT DO UPDATE on uq_area: level, name, parent_id)
- Verification that kode_bps is extracted from shapeID/ADM2_PCODE but never invented
- Verification that centroid is computed and stored
- Verification that unmapped properties are logged but preserved in JSONB

**Download Procedure for Production:**
1. GET https://www.geoboundaries.org/api/current/gbOpen/IDN/ADM2/
2. Extract `gjDownloadURL` from response
3. Download the GeoJSON from that URL
4. Run `python -m app.worker boundaries-load --file <downloaded.geojson>`

**Attribution (must appear on /data-sources page and map footer):**
"geoBoundaries (Runfola et al., 2020)" · "© OpenStreetMap contributors"