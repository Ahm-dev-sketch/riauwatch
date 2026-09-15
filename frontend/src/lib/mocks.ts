// Realistic mock data for Riau province environmental monitoring.
// NEVER serves this data unless NEXT_PUBLIC_USE_MOCKS=true.
// All coordinates are real Riau locations. Timestamps simulate realistic freshness.

import type {
  StatusResponse,
  HotspotsResponse,
  HotspotsSummaryResponse,
  AirQualityLatestResponse,
  AirQualityHistoryResponse,
  WeatherCurrentResponse,
  WeatherForecastResponse,
  RiskCurrentResponse,
  AdminAreasResponse,
  AdminAreaLookupResponse,
  MetaDataSourcesResponse,
} from "./types";

const NOW = new Date().toISOString();
const TWO_HOURS_AGO = new Date(Date.now() - 2 * 3600_000).toISOString();
const SIX_HOURS_AGO = new Date(Date.now() - 6 * 3600_000).toISOString();
const ONE_DAY_AGO = new Date(Date.now() - 24 * 3600_000).toISOString();

export const mockStatus: StatusResponse = {
  generated_at: NOW,
  hotspots: {
    last_observation_at: TWO_HOURS_AGO,
    last_successful_run_at: TWO_HOURS_AGO,
    degraded: false,
  },
  air_quality: {
    last_observation_at: SIX_HOURS_AGO,
    last_successful_run_at: SIX_HOURS_AGO,
    degraded: false,
  },
  weather: {
    last_observation_at: TWO_HOURS_AGO,
    last_successful_run_at: TWO_HOURS_AGO,
    degraded: false,
  },
};

// Realistic hotspot cluster locations in Riau:
// - Rokan Hilir / Dumai area (active deforestation hotspot zone)
// - Kampar (peatland area)
// - Pelalawan
// - Siak
// - Kuantan Singingi
export const mockHotspots: HotspotsResponse = {
  type: "FeatureCollection",
  disclaimer:
    "Hotspots are satellite heat indications and are NOT confirmed fires. Ground verification is required; absence of hotspots does not guarantee absence of fire.",
  count: 14,
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.4345, 1.6521] },
      properties: {
        satellite: "VIIRS",
        instrument: "VIIRS",
        confidence: "nominal",
        confidence_value: 65,
        daynight: "D",
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Rokan Hilir",
        hotspot_indication: true,
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.4512, 1.6388] },
      properties: {
        satellite: "VIIRS",
        instrument: "VIIRS",
        confidence: "nominal",
        confidence_value: 58,
        daynight: "D",
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Rokan Hilir",
        hotspot_indication: true,
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.2750, 1.7100] },
      properties: {
        satellite: "VIIRS",
        instrument: "VIIRS",
        confidence: "high",
        confidence_value: 82,
        daynight: "D",
        acquired_at: ONE_DAY_AGO,
        area_name: "Kota Dumai",
        hotspot_indication: true,
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.3900, 0.4200] },
      properties: {
        satellite: "VIIRS",
        instrument: "VIIRS",
        confidence: "nominal",
        confidence_value: 55,
        daynight: "D",
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Kampar",
        hotspot_indication: true,
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.3850, 0.4050] },
      properties: {
        satellite: "MODIS",
        instrument: "MODIS",
        confidence: "low",
        confidence_value: 30,
        daynight: "D",
        acquired_at: SIX_HOURS_AGO,
        area_name: "Kab. Kampar",
        hotspot_indication: true,
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.8700, -0.2050] },
      properties: {
        satellite: "VIIRS",
        instrument: "VIIRS",
        confidence: "high",
        confidence_value: 88,
        daynight: "D",
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Pelalawan",
        hotspot_indication: true,
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.8900, -0.2200] },
      properties: {
        satellite: "VIIRS",
        instrument: "VIIRS",
        confidence: "nominal",
        confidence_value: 62,
        daynight: "D",
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Pelalawan",
        hotspot_indication: true,
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [102.1500, 0.8100] },
      properties: {
        satellite: "VIIRS",
        instrument: "VIIRS",
        confidence: "nominal",
        confidence_value: 50,
        daynight: "D",
        acquired_at: ONE_DAY_AGO,
        area_name: "Kab. Siak",
        hotspot_indication: true,
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.6200, -0.5200] },
      properties: {
        satellite: "MODIS",
        instrument: "MODIS",
        confidence: "high",
        confidence_value: 78,
        daynight: "D",
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Kuantan Singingi",
        hotspot_indication: true,
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.6000, -0.5400] },
      properties: {
        satellite: "MODIS",
        instrument: "MODIS",
        confidence: "nominal",
        confidence_value: 60,
        daynight: "D",
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Kuantan Singingi",
        hotspot_indication: true,
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [102.3300, 0.3800] },
      properties: {
        satellite: "VIIRS",
        instrument: "VIIRS",
        confidence: "low",
        confidence_value: 25,
        daynight: "N",
        acquired_at: SIX_HOURS_AGO,
        area_name: "Kab. Indragiri Hulu",
        hotspot_indication: true,
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [100.5300, 0.2500] },
      properties: {
        satellite: "VIIRS",
        instrument: "VIIRS",
        confidence: "nominal",
        confidence_value: 55,
        daynight: "D",
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Rokan Hulu",
        hotspot_indication: true,
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [100.5500, 0.2700] },
      properties: {
        satellite: "VIIRS",
        instrument: "VIIRS",
        confidence: "high",
        confidence_value: 75,
        daynight: "D",
        acquired_at: TWO_HOURS_AGO,
        area_name: "Kab. Rokan Hulu",
        hotspot_indication: true,
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [101.7600, 1.8800] },
      properties: {
        satellite: "VIIRS",
        instrument: "VIIRS",
        confidence: "nominal",
        confidence_value: 48,
        daynight: "D",
        acquired_at: ONE_DAY_AGO,
        area_name: "Kab. Bengkalis",
        hotspot_indication: true,
      },
    },
  ],
};

export const mockHotspotsSummary: HotspotsSummaryResponse = {
  total: 14,
  items: [
    { kabupaten_id: 1, kabupaten_name: "Kab. Rokan Hilir", count: 2 },
    { kabupaten_id: 2, kabupaten_name: "Kota Dumai", count: 1 },
    { kabupaten_id: 3, kabupaten_name: "Kab. Kampar", count: 2 },
    { kabupaten_id: 4, kabupaten_name: "Kab. Pelalawan", count: 2 },
    { kabupaten_id: 5, kabupaten_name: "Kab. Siak", count: 1 },
    { kabupaten_id: 6, kabupaten_name: "Kab. Kuantan Singingi", count: 2 },
    { kabupaten_id: 7, kabupaten_name: "Kab. Indragiri Hulu", count: 1 },
    { kabupaten_id: 8, kabupaten_name: "Kab. Rokan Hulu", count: 2 },
    { kabupaten_id: 9, kabupaten_name: "Kab. Bengkalis", count: 1 },
  ],
};

export const mockAirQuality: AirQualityLatestResponse = {
  stations: [
    {
      station_id: 1,
      station_name: "Stasiun Pekanbaru",
      external_id: "openaq-pek-001",
      distance_km: 0,
      observations: [
        {
          pollutant: "pm25",
          value: 38.5,
          unit: "ug/m3",
          observed_at: SIX_HOURS_AGO,
          age_seconds: 21600,
        },
        {
          pollutant: "pm10",
          value: 52.1,
          unit: "ug/m3",
          observed_at: SIX_HOURS_AGO,
          age_seconds: 21600,
        },
      ],
      category: null, // Phase 6
    },
    {
      station_id: 2,
      station_name: "Stasiun Dumai",
      external_id: "openaq-dum-002",
      distance_km: 120.3,
      observations: [
        {
          pollutant: "pm25",
          value: 55.2,
          unit: "ug/m3",
          observed_at: SIX_HOURS_AGO,
          age_seconds: 21600,
        },
      ],
      category: null,
    },
  ],
};

export const mockWeather: WeatherCurrentResponse = {
  area_id: 1,
  area_name: "Kab. Kampar",
  observation: {
    valid_time: TWO_HOURS_AGO,
    is_forecast: false,
    temperature_c: 31.2,
    humidity_pct: 78.5,
    precipitation_mm: 0.0,
    wind_speed_kmh: 8.3,
    wind_direction_deg: 225,
    age_seconds: 7200,
  },
};

export const mockRisk: RiskCurrentResponse = {
  assessments: [
    {
      area_id: 1,
      area_name: "Kab. Rokan Hilir",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "HIGH",
      score: 0.78,
      factors: {
        hotspot_count_7d: 12,
        recent_trend: "increasing",
        dry_spell_days: 5,
        vegetation_condition: "stressed",
      },
    },
    {
      area_id: 2,
      area_name: "Kota Dumai",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "MEDIUM",
      score: 0.52,
      factors: {
        hotspot_count_7d: 4,
        recent_trend: "stable",
        dry_spell_days: 3,
        vegetation_condition: "moderate",
      },
    },
    {
      area_id: 3,
      area_name: "Kab. Kampar",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "MEDIUM",
      score: 0.45,
      factors: {
        hotspot_count_7d: 3,
        recent_trend: "stable",
        dry_spell_days: 2,
        vegetation_condition: "moderate",
      },
    },
    {
      area_id: 4,
      area_name: "Kab. Pelalawan",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "HIGH",
      score: 0.82,
      factors: {
        hotspot_count_7d: 15,
        recent_trend: "increasing",
        dry_spell_days: 7,
        vegetation_condition: "stressed",
      },
    },
    {
      area_id: 5,
      area_name: "Kab. Siak",
      assessed_for: TWO_HOURS_AGO,
      horizon: "48h",
      model_version: "rules-v0.1",
      risk_level: "LOW",
      score: 0.22,
      factors: {
        hotspot_count_7d: 1,
        recent_trend: "decreasing",
        dry_spell_days: 1,
        vegetation_condition: "good",
      },
    },
  ],
  note: null,
};

// ---------------------------------------------------------------------------
// Air Quality History (24h of PM2.5 data for chart)
// ---------------------------------------------------------------------------

function generateAQHistory(hours: number): { observed_at: string; value: number; unit: string }[] {
  const now = Date.now();
  const points: { observed_at: string; value: number; unit: string }[] = [];
  // Simulate realistic PM2.5 fluctuations in Riau: baseline ~35, spikes up to 80+
  const baseValues = [32, 35, 38, 42, 45, 48, 52, 55, 60, 55, 50, 48, 45, 42, 40, 38, 35, 33, 35, 38, 42, 45, 40, 37];
  for (let i = 0; i < hours; i++) {
    const t = new Date(now - (hours - 1 - i) * 3600_000);
    const base = baseValues[i % baseValues.length];
    // Add small random variation
    const jitter = Math.sin(i * 0.7) * 5;
    points.push({
      observed_at: t.toISOString(),
      value: Math.round((base + jitter) * 10) / 10,
      unit: "ug/m3",
    });
  }
  return points;
}

export const mockAirQualityHistory: AirQualityHistoryResponse = {
  station_id: 1,
  pollutant: "pm25",
  unit: "ug/m3",
  points: generateAQHistory(24),
};

// ---------------------------------------------------------------------------
// Weather Forecast (24h hourly)
// ---------------------------------------------------------------------------

function generateForecast(hours: number): WeatherForecastResponse["forecast"] {
  const now = Date.now();
  const forecast: WeatherForecastResponse["forecast"] = [];
  for (let i = 1; i <= hours; i++) {
    const t = new Date(now + i * 3600_000);
    const hourOfDay = t.getHours();
    // Simulate daily temperature cycle: cooler at night, hotter midday
    const tempBase = 28 + Math.sin((hourOfDay - 6) * Math.PI / 12) * 4;
    const humidity = 75 - Math.sin((hourOfDay - 6) * Math.PI / 12) * 15;
    // Random afternoon thunderstorm chance
    const precipChance = hourOfDay >= 13 && hourOfDay <= 16 ? 0.4 : 0.1;
    const precip = Math.random() < precipChance ? Math.round(Math.random() * 8 * 10) / 10 : 0;
    forecast.push({
      valid_time: t.toISOString(),
      is_forecast: true,
      temperature_c: Math.round(tempBase * 10) / 10,
      humidity_pct: Math.round(humidity * 10) / 10,
      precipitation_mm: precip,
      wind_speed_kmh: Math.round((5 + Math.random() * 10) * 10) / 10,
      wind_direction_deg: Math.round(Math.random() * 360),
      age_seconds: null,
    });
  }
  return forecast;
}

export const mockWeatherForecast: WeatherForecastResponse = {
  area_id: 1,
  area_name: "Kab. Kampar",
  forecast: generateForecast(24),
};

// ---------------------------------------------------------------------------
// Administrative Areas — Simplified mock geometry for Riau kabupaten
// PROVENANCE: These are simplified bounding-box polygons for UI testing.
// Real hookup uses backend GeoJSON which comes from OSM/administrative boundaries.
// The shape here is NOT accurate survey data — it's illustrative only.
// ---------------------------------------------------------------------------

const RIUA_KABUPATEN: Array<{ id: number; name: string; bbox: number[][] }> = [
  { id: 1, name: "Kab. Rokan Hilir", bbox: [[100.8, 1.6], [102.0, 2.3]] },
  { id: 2, name: "Kota Dumai", bbox: [[101.1, 1.6], [101.5, 1.8]] },
  { id: 3, name: "Kab. Kampar", bbox: [[100.3, -0.1], [101.5, 1.0]] },
  { id: 4, name: "Kab. Pelalawan", bbox: [[101.5, -0.8], [102.5, 0.2]] },
  { id: 5, name: "Kab. Siak", bbox: [[101.5, 0.5], [102.5, 1.2]] },
  { id: 6, name: "Kab. Kuantan Singingi", bbox: [[100.8, -1.0], [101.8, -0.2]] },
  { id: 7, name: "Kab. Indragiri Hulu", bbox: [[101.8, -0.2], [102.8, 0.8]] },
  { id: 8, name: "Kab. Rokan Hulu", bbox: [[99.8, 0.0], [100.8, 0.8]] },
  { id: 9, name: "Kab. Bengkalis", bbox: [[101.5, 1.5], [102.5, 2.3]] },
  { id: 10, name: "Kab. Indragiri Hilir", bbox: [[102.0, -0.5], [103.2, 0.5]] },
  { id: 11, name: "Kab. Rokan Hilir", bbox: [[100.8, 1.6], [102.0, 2.3]] },
  { id: 12, name: "Kab. Kepulauan Meranti", bbox: [[102.5, 1.8], [103.5, 2.5]] },
  { id: 13, name: "Kab. Kepulauan Meranti", bbox: [[102.5, 1.8], [103.5, 2.5]] },
  { id: 14, name: "Kab. Siak", bbox: [[101.5, 0.5], [102.5, 1.2]] },
];

function bboxToMultiPolygon(bbox: number[][]): { type: "MultiPolygon"; coordinates: number[][][][] } {
  const [[west, south], [east, north]] = bbox;
  return {
    type: "MultiPolygon",
    coordinates: [[[ [west, south], [east, south], [east, north], [west, north], [west, south] ]]],
  };
}

export const mockAdminAreas: AdminAreasResponse = {
  type: "FeatureCollection",
  features: RIUA_KABUPATEN.map((k) => ({
    type: "Feature" as const,
    geometry: bboxToMultiPolygon(k.bbox),
    properties: {
      id: k.id,
      name: k.name,
      level: "kabupaten_kota",
      kode_bps: null,
      parent_id: null,
    },
  })),
};

// Lookup: find kabupaten by lat/lon (simple bbox containment)
function findArea(lat: number, lon: number): AdminAreaLookupResponse | null {
  for (const k of RIUA_KABUPATEN) {
    const [[west, south], [east, north]] = k.bbox;
    if (lat >= south && lat <= north && lon >= west && lon <= east) {
      return { id: k.id, name: k.name, level: "kabupaten_kota" };
    }
  }
  // Default to Rokan Hilir if outside all boxes (for mock demo)
  return { id: 1, name: "Kab. Rokan Hilir", level: "kabupaten_kota" };
}

export const mockAdminLookup: AdminAreaLookupResponse = findArea(0.5, 101.5)!;

// ---------------------------------------------------------------------------
// Data Sources
// ---------------------------------------------------------------------------

export const mockDataSources: MetaDataSourcesResponse = {
  sources: [
    {
      key: "firms_viirs",
      name: "NASA FIRMS VIIRS",
      provider_url: "https://firms.modaps.eosdis.nasa.gov/",
      license_note:
        "Data is in the public domain and may be freely downloaded, shared, and used without restriction. NASA requests attribution when possible.",
      attribution:
        "NASA FIRMS - Fire Information for Resource Management System",
      update_interval_seconds: 3600,
      active: true,
    },
    {
      key: "firms_modis",
      name: "NASA FIRMS MODIS",
      provider_url: "https://firms.modaps.eosdis.nasa.gov/",
      license_note:
        "Data is in the public domain and may be freely downloaded, shared, and used without restriction. NASA requests attribution when possible.",
      attribution:
        "NASA FIRMS - Fire Information for Resource Management System",
      update_interval_seconds: 3600,
      active: true,
    },
    {
      key: "openaq",
      name: "OpenAQ",
      provider_url: "https://openaq.org/",
      license_note:
        "OpenAQ data is provided under the Creative Commons Attribution 4.0 International License (CC BY 4.0).",
      attribution: "OpenAQ (openaq.org)",
      update_interval_seconds: 10800,
      active: true,
    },
    {
      key: "open_meteo",
      name: "Open-Meteo",
      provider_url: "https://open-meteo.com/",
      license_note:
        "Open-Meteo data is free for non-commercial use. Commercial use requires a license. Attribution appreciated but not required.",
      attribution: "Open-Meteo (open-meteo.com)",
      update_interval_seconds: 3600,
      active: true,
    },
    {
      key: "osm_boundaries",
      name: "OpenStreetMap Administrative Boundaries",
      provider_url: "https://www.openstreetmap.org/",
      license_note:
        "Map data is available under the Open Database License (ODbL). You are free to share and adapt with attribution.",
      attribution: "© OpenStreetMap contributors",
      update_interval_seconds: null,
      active: true,
    },
  ],
};
