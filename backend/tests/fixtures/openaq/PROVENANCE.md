# Fixture Provenance — openaq/

## sample_locations.json

**Status: SYNTHETIC — until API key registered**

**Source:** Constructed to match OpenAQ v3 API `/locations` response structure as documented at:
https://docs.openaq.org/api-v3/locations/get

**Structure based on documented fields:**
- `id`: integer location identifier
- `name`: station name
- `coordinates`: object with `latitude` and `longitude`
- `country`: ISO country code
- `city`: city name
- `isMobile`: boolean
- `isAnalysis`: boolean
- `entity`: entity type (government, community, etc.)
- `sensorType`: sensor type (reference, low-cost, etc.)

**Purpose:**
- Unit tests for location parsing, station normalization, coordinate validation
- Integration tests for station upsert (ON CONFLICT DO UPDATE on source_id, external_id)

## sample_measurements.json

**Status: SYNTHETIC — until API key registered**

**Source:** Constructed to match OpenAQ v3 API `/locations/{id}/latest` response structure as documented at:
https://docs.openaq.org/api-v3/locations/latest/get

**Structure based on documented fields:**
- `parameter`: pollutant code (pm25, pm10, etc.)
- `value`: numeric measurement value
- `unit`: unit string (µg/m³)
- `lastUpdated`: ISO8601 timestamp
- `sourceName`: station name reference

**Purpose:**
- Unit tests for measurement parsing, observation normalization, pollutant filtering
- Integration tests for observation upsert (ON CONFLICT DO NOTHING on station_id, pollutant, observed_at)

**Note:** These fixtures will be replaced with real recorded OpenAQ responses once API key is registered and live integration tests are run in Phase 3 validation. The actual Riau station inventory must be verified live (docs/data-sources.md §3.3 caveat).